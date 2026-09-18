package com.deutschflow.user.activation;

import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.organization.repository.OrganizationRepository;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.RefreshTokenRepository;
import com.deutschflow.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Base64;
import java.util.Optional;

/**
 * Đặt mật khẩu LẦN ĐẦU cho tài khoản do trung tâm tạo từ CSV roster (Q-09, owner chốt 14/09/2026).
 *
 * <p><b>Lỗ mà lớp này vá.</b> {@code OrgRosterRowImporter} tạo tài khoản với mật khẩu ngẫu nhiên
 * ({@code UUID.randomUUID()}) mà không ai biết — kể cả trung tâm. Trước bản này tài khoản ấy không
 * nhận một email nào, nên đường vào duy nhất là học viên tự bấm "Quên mật khẩu". Với một lớp pilot
 * 20 em, đó là 20 lần hướng dẫn một thao tác mà các em không có lý do gì để đoán ra.
 *
 * <p><b>Token thô chỉ tồn tại một lần.</b> {@link #issue} trả nó về cho người gọi (để đưa vào email)
 * và lưu lại đúng SHA-256. Không có đường nào đọc lại token từ cơ sở dữ liệu — mất email thì phát
 * lời mời mới, không "tra cứu lại".
 *
 * <p><b>Đường "Quên mật khẩu" vẫn sống song song.</b> Hai sổ tách nhau (xem V331), nên một em không
 * nhận được email kích hoạt vẫn tự vào được bằng OTP như mọi người dùng khác — bản này THÊM một lối,
 * không thay lối nào.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AccountActivationService {

    /** 32 byte ngẫu nhiên → 43 ký tự base64url. Đủ để không ai dò được trong vòng đời nhiều ngày. */
    private static final int TOKEN_BYTES = 32;
    private static final SecureRandom RANDOM = new SecureRandom();

    private final AccountActivationTokenRepository tokenRepository;
    private final UserRepository userRepository;
    private final OrganizationRepository organizationRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final JdbcTemplate jdbcTemplate;

    /**
     * Bao lâu thì liên kết hết hạn. Mặc định 14 ngày: trung tâm thường nhập danh sách trước ngày khai
     * giảng một tuần, và một em đi vắng vài hôm vẫn phải dùng được. Ngắn hơn thì nửa lớp phải đi
     * đường "Quên mật khẩu" — tức là lại đúng vấn đề mà bản này vá.
     */
    @Value("${app.activation.ttl-days:14}")
    private int ttlDays;

    /** Trạng thái một liên kết, cho màn web quyết định hiện form hay hiện lời giải thích. */
    public enum State { VALID, EXPIRED, USED, UNKNOWN }

    /**
     * @param state       trạng thái liên kết
     * @param maskedEmail địa chỉ đã che ({@code ab***@tt.vn}) — đủ để học viên nhận ra tài khoản của
     *                    mình, không phơi địa chỉ đầy đủ cho ai nhặt được liên kết bị chuyển tiếp
     * @param orgName     trung tâm đã phát lời mời; rỗng nếu không còn
     */
    public record Preview(State state, String maskedEmail, String orgName) {
        static Preview unknown() {
            return new Preview(State.UNKNOWN, "", "");
        }
    }

    /**
     * Phát một liên kết mới và VÔ HIỆU mọi liên kết chưa dùng trước đó của cùng học viên — một tài
     * khoản chỉ nên có đúng một liên kết sống, nếu không thì thu hồi một cái chẳng có nghĩa gì.
     *
     * <p>Gọi TRONG giao dịch của dòng CSV (không phải sau commit): token là dữ liệu, nó phải cùng số
     * phận với dòng sinh ra nó. Việc gửi email mới là thứ phải đợi commit.
     *
     * @return token THÔ — giá trị này không quay lại cơ sở dữ liệu và không được ghi vào log
     */
    @Transactional
    public String issue(Long userId, Long orgId) {
        if (userId == null) {
            throw new BadRequestException("userId là bắt buộc");
        }
        tokenRepository.invalidateLiveTokens(userId);

        byte[] raw = new byte[TOKEN_BYTES];
        RANDOM.nextBytes(raw);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(raw);

        tokenRepository.save(AccountActivationToken.builder()
                .userId(userId)
                .orgId(orgId)
                .tokenHash(hash(token))
                .expiresAt(Instant.now().plus(ttlDays, ChronoUnit.DAYS))
                .build());
        log.info("[Activation] đã phát liên kết kích hoạt cho userId={} (org={}, hạn {} ngày)",
                userId, orgId, ttlDays);
        return token;
    }

    /** Học viên này còn liên kết sống không — để không gửi email đôi khi nhập lại cùng tệp CSV. */
    @Transactional(readOnly = true)
    public boolean hasLiveToken(Long userId) {
        return userId != null && tokenRepository.hasLiveToken(userId);
    }

    /**
     * Liên kết này dùng được không — cho màn web mở ra đã biết mình đang ở ca nào, thay vì để người
     * dùng gõ xong mật khẩu rồi mới báo "liên kết hết hạn".
     *
     * <p>Không phân biệt "không tồn tại" với "sai định dạng": cả hai đều là {@code UNKNOWN}. Một
     * thông điệp chi tiết hơn chỉ giúp người đang dò token.
     */
    @Transactional(readOnly = true)
    public Preview preview(String rawToken) {
        Optional<AccountActivationToken> found = lookup(rawToken);
        if (found.isEmpty()) {
            return Preview.unknown();
        }
        AccountActivationToken token = found.get();
        State state = stateOf(token);
        if (state != State.VALID) {
            // Hết hạn / đã dùng: nói đúng ca đó, nhưng KHÔNG kèm email — người cầm một liên kết chết
            // không cần biết nó từng thuộc về ai.
            return new Preview(state, "", "");
        }
        String email = userRepository.findById(token.getUserId()).map(User::getEmail).orElse(null);
        if (email == null) {
            return Preview.unknown();
        }
        String orgName = token.getOrgId() == null ? ""
                : organizationRepository.findById(token.getOrgId())
                        .map(o -> o.getName() == null ? "" : o.getName())
                        .orElse("");
        return new Preview(State.VALID, maskEmail(email), orgName);
    }

    /**
     * Đặt mật khẩu và đốt liên kết. Mật khẩu đã được {@code PasswordPolicy} kiểm ở controller, cùng
     * khuôn với {@code /api/auth/reset-password}.
     *
     * <p>Thu hồi mọi refresh token của tài khoản, cùng lý do với đường đặt lại mật khẩu (AUTH-1):
     * tài khoản này thường chưa từng đăng nhập, nhưng một lượt kích hoạt LẠI (trung tâm phát lời mời
     * mới vì em mất máy) phải cắt được phiên cũ.
     *
     * @throws BadRequestException liên kết không tồn tại, hết hạn, hoặc đã dùng
     */
    @Transactional
    public void activate(String rawToken, String newPassword) {
        AccountActivationToken token = lookup(rawToken)
                .orElseThrow(() -> new BadRequestException(
                        "Liên kết kích hoạt không hợp lệ. Hãy dùng chức năng \"Quên mật khẩu\" hoặc liên hệ trung tâm."));
        switch (stateOf(token)) {
            case EXPIRED -> throw new BadRequestException(
                    "Liên kết kích hoạt đã hết hạn. Hãy dùng chức năng \"Quên mật khẩu\" hoặc liên hệ trung tâm.");
            case USED -> throw new BadRequestException(
                    "Liên kết kích hoạt đã được dùng. Hãy đăng nhập, hoặc dùng \"Quên mật khẩu\" nếu bạn không nhớ mật khẩu.");
            default -> { /* VALID — đi tiếp */ }
        }

        User user = userRepository.findById(token.getUserId())
                .filter(User::isActive)
                .orElseThrow(() -> new BadRequestException("Không tìm thấy tài khoản."));

        // Đốt liên kết TRƯỚC khi đổi mật khẩu: hai câu cùng một giao dịch nên thứ tự không đổi kết
        // quả, nhưng nó giữ đúng bất biến "dùng rồi thì chết" ngay cả khi có ai thêm một lối thoát
        // sớm vào giữa sau này.
        token.setUsedAt(Instant.now());
        tokenRepository.save(token);

        jdbcTemplate.update("UPDATE users SET password_hash = ? WHERE id = ?",
                passwordEncoder.encode(newPassword), user.getId());
        refreshTokenRepository.revokeAllByUserId(user.getId());
        jdbcTemplate.update("UPDATE users SET push_token = NULL, push_platform = NULL WHERE id = ?",
                user.getId());

        log.info("[Activation] userId={} đã đặt mật khẩu lần đầu qua liên kết kích hoạt", user.getId());
    }

    private Optional<AccountActivationToken> lookup(String rawToken) {
        if (rawToken == null || rawToken.isBlank()) {
            return Optional.empty();
        }
        return tokenRepository.findByTokenHash(hash(rawToken.trim()));
    }

    private static State stateOf(AccountActivationToken token) {
        if (token.getUsedAt() != null) {
            return State.USED;
        }
        return Instant.now().isAfter(token.getExpiresAt()) ? State.EXPIRED : State.VALID;
    }

    /** SHA-256 hex. Không muối: token đã là 32 byte ngẫu nhiên, muối không thêm được gì. */
    static String hash(String token) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(token.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder(64);
            for (byte b : digest) {
                sb.append(Character.forDigit((b >> 4) & 0xF, 16)).append(Character.forDigit(b & 0xF, 16));
            }
            return sb.toString();
        } catch (NoSuchAlgorithmException ex) {
            // SHA-256 là bắt buộc trong mọi JRE — tới đây là môi trường hỏng, không phải đầu vào sai.
            throw new IllegalStateException("SHA-256 không khả dụng", ex);
        }
    }

    /** {@code nguyen.van.a@tt.vn} → {@code ngu***@tt.vn}. Giữ tối đa 3 ký tự đầu. */
    static String maskEmail(String email) {
        int at = email.indexOf('@');
        if (at <= 0) {
            return "***";
        }
        String local = email.substring(0, at);
        String keep = local.substring(0, Math.min(3, local.length()));
        return keep + "***" + email.substring(at);
    }
}
