package com.deutschflow.user.registration;

import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.user.dto.AuthResponse;
import com.deutschflow.user.dto.RegisterRequest;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.registration.RegistrationVerificationException.Reason;
import com.deutschflow.user.repository.UserRepository;
import com.deutschflow.user.service.AuthService;
import com.deutschflow.user.service.SelfRegistrationInputs;
import io.micrometer.core.instrument.MeterRegistry;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;

/**
 * Đăng ký có xác nhận mã PIN 6 số (plans/2026-11-05-thiet-ke-ma-pin-xac-nhan-dang-ky.md §4.3).
 *
 * <p>Điền form → CHƯA tạo {@code users}, chỉ ghi {@code pending_registrations} và gửi mã → nhập đúng mã
 * thì mới tạo tài khoản và cấp phiên. Email đã có tài khoản đi đường "im lặng": nhìn từ ngoài y hệt
 * (202), nhưng không ghi hồ sơ mà gửi thư "bạn đã có tài khoản".
 *
 * <p><b>Transaction cố ý KHÔNG dùng {@code @Transactional}</b> mà dùng {@link TransactionTemplate}:
 * <ul>
 *   <li>{@code start}: ghi hồ sơ trong một transaction ngắn, gửi thư SAU commit. Gửi trước rồi commit hỏng
 *       thì người dùng cầm một mã không ứng với hồ sơ nào.</li>
 *   <li>{@code verify}: lần nhập sai phải được COMMIT ({@code attempts++}) rồi mới báo lỗi; ném exception
 *       trong {@code @Transactional} là rollback luôn bộ đếm, tức dò mã không giới hạn.</li>
 * </ul>
 */
@Slf4j
@Service
public class RegistrationVerificationService {

    private final JdbcTemplate jdbc;
    private final TransactionTemplate tx;
    private final PasswordEncoder passwordEncoder;
    private final UserRepository userRepository;
    private final AuthService authService;
    private final RegistrationMailer mailer;
    private final RegistrationVerificationConfig config;
    private final MeterRegistry meters;

    public RegistrationVerificationService(JdbcTemplate jdbc,
                                           TransactionTemplate tx,
                                           PasswordEncoder passwordEncoder,
                                           UserRepository userRepository,
                                           AuthService authService,
                                           RegistrationMailer mailer,
                                           RegistrationVerificationConfig config,
                                           MeterRegistry meters) {
        this.jdbc = jdbc;
        this.tx = tx;
        this.passwordEncoder = passwordEncoder;
        this.userRepository = userRepository;
        this.authService = authService;
        this.mailer = mailer;
        this.config = config;
        this.meters = meters;
    }

    public record StartResult(String status, String email, long expiresInSeconds,
                              long resendAfterSeconds, int codeLength) {}

    // ─── start ────────────────────────────────────────────────────────────────

    public StartResult start(RegisterRequest req, String ip) {
        requireEnabled();
        String email = normalizeEmail(req.email());
        String phone = normalizePhone(req.phoneNumber());
        String locale = req.locale() == null ? "vi" : req.locale();

        if (phone != null && userRepository.existsByPhoneNumber(phone)) {
            // Giữ hành vi /register hôm nay (SĐT là trường tuỳ chọn).
            throw new BadRequestException("Số điện thoại này đã được đăng ký, vui lòng dùng số khác.");
        }
        // Băm mật khẩu ở CẢ HAI nhánh: nhánh email đã có tài khoản không cần nó, nhưng bỏ qua BCrypt
        // thì nhánh đó nhanh hơn ~70ms — đủ để đo thời gian mà dò ra email nào có tài khoản.
        String passwordHash = passwordEncoder.encode(req.password());

        if (userRepository.existsByEmailIgnoreCase(email)) {
            try {
                mailer.sendAlreadyRegistered(email, locale);
                sent("existing_account");
            } catch (RuntimeException e) {
                // Không báo lỗi ra ngoài: 503 ở đây (mà nhánh thường trả 202) là lộ email có tài khoản.
                sent("fail");
                log.warn("[Registration] không gửi được thư 'đã có tài khoản': {}", e.getMessage());
            }
            return startResult(email);
        }

        String code = RegistrationCodes.generate();
        Long pendingId = tx.execute(status -> {
            closeOpen(email, "SUPERSEDED");
            Long id = jdbc.queryForObject("""
                    INSERT INTO pending_registrations
                        (email, phone_number, password_hash, display_name, locale, code_hash,
                         expires_at, created_ip)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    RETURNING id
                    """, Long.class,
                    email, phone, passwordHash, req.displayName(), locale,
                    // Hash cần id ⇒ ghi tạm chuỗi 64 số 0 rồi cập nhật ngay trong cùng transaction.
                    "0".repeat(64), Timestamp.from(expiry()), ip);
            jdbc.update("UPDATE pending_registrations SET code_hash = ? WHERE id = ?",
                    RegistrationCodes.hash(config.pepper(), id, code), id);
            return id;
        });

        try {
            mailer.sendCode(email, code, locale, config.codeTtlMinutes());
            sent("ok");
        } catch (RuntimeException e) {
            sent("fail");
            close(pendingId, "SEND_FAILED");
            log.warn("[Registration] gửi mã PIN hỏng (pending id={}): {}", pendingId, e.getMessage());
            throw new RegistrationVerificationException(Reason.SEND_FAILED,
                    "Chưa gửi được mã xác minh, vui lòng thử lại sau ít phút.");
        }
        return startResult(email);
    }

    // ─── verify ───────────────────────────────────────────────────────────────

    private record Pending(long id, String email, String phone, String passwordHash, String displayName,
                           String locale, String codeHash, int attempts, Instant expiresAt) {}

    private sealed interface Outcome permits Ok, Fail {}
    private record Ok(AuthResponse response) implements Outcome {}
    private record Fail(Reason reason, Integer remaining) implements Outcome {}

    public AuthResponse verify(String rawEmail, String code) {
        requireEnabled();
        String email = normalizeEmail(rawEmail);
        Outcome outcome;
        try {
            outcome = tx.execute(status -> verifyInTx(email, code == null ? "" : code.trim()));
        } catch (DataIntegrityViolationException e) {
            // UNIQUE của users nổ: ai đó vừa tạo đúng email/SĐT này giữa lúc kiểm và lúc ghi.
            throw accountExists();
        }
        if (outcome instanceof Ok ok) {
            meters.counter("registration.code.verified").increment();
            return ok.response();
        }
        Fail fail = (Fail) outcome;
        if (fail.reason() == Reason.ACCOUNT_EXISTS) throw accountExists();
        throw new RegistrationVerificationException(fail.reason(), message(fail.reason()), fail.remaining());
    }

    private Outcome verifyInTx(String email, String code) {
        List<Pending> rows = jdbc.query("""
                SELECT id, email, phone_number, password_hash, display_name, locale, code_hash,
                       attempts, expires_at
                FROM pending_registrations
                WHERE email = ? AND closed_at IS NULL
                FOR UPDATE
                """, (rs, i) -> new Pending(
                rs.getLong("id"), rs.getString("email"), rs.getString("phone_number"),
                rs.getString("password_hash"), rs.getString("display_name"), rs.getString("locale"),
                rs.getString("code_hash"), rs.getInt("attempts"),
                rs.getTimestamp("expires_at").toInstant()), email);
        if (rows.isEmpty()) {
            return new Fail(Reason.INVALID_CODE, null);
        }
        Pending p = rows.get(0);
        if (!Instant.now().isBefore(p.expiresAt())) {
            closeInTx(p.id(), "EXPIRED");
            return new Fail(Reason.EXPIRED, null);
        }
        if (!RegistrationCodes.matches(config.pepper(), p.id(), code, p.codeHash())) {
            int attempts = p.attempts() + 1;
            if (attempts >= config.maxAttemptsPerCode()) {
                jdbc.update("UPDATE pending_registrations SET attempts = ? WHERE id = ?", attempts, p.id());
                closeInTx(p.id(), "LOCKED");
                return new Fail(Reason.LOCKED, null);
            }
            jdbc.update("UPDATE pending_registrations SET attempts = ? WHERE id = ?", attempts, p.id());
            return new Fail(Reason.INVALID_CODE, config.maxAttemptsPerCode() - attempts);
        }
        // Đúng mã. Kiểm lại users: đường /register cũ hoặc ADMIN tạo tay có thể đã chiếm chỗ.
        if (userRepository.existsByEmailIgnoreCase(p.email())
                || (p.phone() != null && userRepository.existsByPhoneNumber(p.phone()))) {
            return new Fail(Reason.ACCOUNT_EXISTS, null);
        }
        User user = authService.createSelfRegisteredStudent(
                p.email(), p.phone(), p.passwordHash(), p.displayName(), parseLocale(p.locale()));
        closeInTx(p.id(), "VERIFIED");
        return new Ok(authService.issueSession(user));
    }

    // ─── resend ───────────────────────────────────────────────────────────────

    /**
     * Luôn "thành công" với người gọi (controller trả 204 kể cả email lạ). Sinh mã mới khi:
     * <ul>
     *   <li>có hồ sơ MỞ đã qua cooldown — mã cũ chết ngay, {@code attempts} về 0, hạn tính lại; hoặc</li>
     *   <li>hồ sơ gần nhất vừa đóng vì {@code LOCKED}/{@code EXPIRED} trong 24 giờ qua — mở hồ sơ MỚI chép
     *       dữ liệu form, để "Nhập sai quá nhiều lần, hãy gửi mã mới" làm được mà không bắt gõ lại mật khẩu.
     *       Hồ sơ cũ giữ nguyên lý do đóng (phễu vẫn đếm đúng). Trần gửi theo email (controller) vẫn chặn
     *       tổng số lần thử ≤ 25/giờ/email.</li>
     * </ul>
     * Gửi hỏng chỉ log: đây là đường phụ, người dùng bấm lại được.
     */
    public void resend(String rawEmail, String ip) {
        if (!config.enabled()) return;
        String email = normalizeEmail(rawEmail);
        String code = RegistrationCodes.generate();
        record Target(long id, String locale) {}
        Target target = tx.execute(status -> {
            List<Object[]> open = jdbc.query("""
                    SELECT id, locale, last_sent_at FROM pending_registrations
                    WHERE email = ? AND closed_at IS NULL FOR UPDATE
                    """, (rs, i) -> new Object[]{rs.getLong(1), rs.getString(2), rs.getTimestamp(3).toInstant()},
                    email);
            if (!open.isEmpty()) {
                long id = (Long) open.get(0)[0];
                Instant lastSent = (Instant) open.get(0)[2];
                if (Instant.now().isBefore(lastSent.plusSeconds(config.resendCooldownSeconds()))) {
                    return null;
                }
                jdbc.update("""
                        UPDATE pending_registrations
                        SET code_hash = ?, attempts = 0, sends = sends + 1, last_sent_at = NOW(), expires_at = ?
                        WHERE id = ?
                        """, RegistrationCodes.hash(config.pepper(), id, code), Timestamp.from(expiry()), id);
                return new Target(id, (String) open.get(0)[1]);
            }
            List<Long> recent = jdbc.queryForList("""
                    SELECT id FROM pending_registrations
                    WHERE email = ? AND closed_reason IN ('LOCKED', 'EXPIRED')
                      AND closed_at > NOW() - INTERVAL '24 hours'
                    ORDER BY closed_at DESC LIMIT 1
                    """, Long.class, email);
            if (recent.isEmpty() || userRepository.existsByEmailIgnoreCase(email)) {
                return null;
            }
            Long id = jdbc.queryForObject("""
                    INSERT INTO pending_registrations
                        (email, phone_number, password_hash, display_name, locale, code_hash,
                         expires_at, created_ip)
                    SELECT email, phone_number, password_hash, display_name, locale, ?, ?, ?
                    FROM pending_registrations WHERE id = ?
                    RETURNING id
                    """, Long.class, "0".repeat(64), Timestamp.from(expiry()), ip, recent.get(0));
            jdbc.update("UPDATE pending_registrations SET code_hash = ? WHERE id = ?",
                    RegistrationCodes.hash(config.pepper(), id, code), id);
            String locale = jdbc.queryForObject(
                    "SELECT locale FROM pending_registrations WHERE id = ?", String.class, id);
            return new Target(id, locale);
        });
        if (target == null) return;
        try {
            mailer.sendCode(email, code, target.locale(), config.codeTtlMinutes());
            meters.counter("registration.code.sent", "outcome", "ok", "kind", "resend").increment();
        } catch (RuntimeException e) {
            meters.counter("registration.code.sent", "outcome", "fail", "kind", "resend").increment();
            log.warn("[Registration] gửi lại mã PIN hỏng (pending id={}): {}", target.id(), e.getMessage());
        }
    }

    // ─── helpers ──────────────────────────────────────────────────────────────

    private void requireEnabled() {
        if (!config.enabled()) {
            throw new RegistrationVerificationException(Reason.DISABLED,
                    "Xác minh email khi đăng ký chưa bật.");
        }
    }

    private StartResult startResult(String email) {
        return new StartResult("CODE_SENT", email, config.codeTtlMinutes() * 60L,
                config.resendCooldownSeconds(), RegistrationCodes.CODE_LENGTH);
    }

    private Instant expiry() {
        return Instant.now().plus(config.codeTtlMinutes(), ChronoUnit.MINUTES);
    }

    private void closeOpen(String email, String reason) {
        int n = jdbc.update("""
                UPDATE pending_registrations SET closed_at = NOW(), closed_reason = ?
                WHERE email = ? AND closed_at IS NULL
                """, reason, email);
        for (int i = 0; i < n; i++) closed(reason);
    }

    private void close(long id, String reason) {
        tx.executeWithoutResult(s -> closeInTx(id, reason));
    }

    private void closeInTx(long id, String reason) {
        int n = jdbc.update("""
                UPDATE pending_registrations SET closed_at = NOW(), closed_reason = ?
                WHERE id = ? AND closed_at IS NULL
                """, reason, id);
        if (n > 0) closed(reason);
    }

    private void closed(String reason) {
        meters.counter("registration.closed", "reason", reason).increment();
    }

    private void sent(String outcome) {
        meters.counter("registration.code.sent", "outcome", outcome, "kind", "start").increment();
    }

    private static RegistrationVerificationException accountExists() {
        return new RegistrationVerificationException(Reason.ACCOUNT_EXISTS,
                "Email hoặc số điện thoại này vừa được dùng để tạo tài khoản. Hãy đăng nhập, "
                        + "hoặc dùng \"Quên mật khẩu\" nếu bạn không nhớ mật khẩu.");
    }

    private static String message(Reason reason) {
        return switch (reason) {
            case LOCKED -> "Nhập sai quá nhiều lần, hãy gửi mã mới.";
            case EXPIRED -> "Mã đã hết hạn, hãy gửi mã mới.";
            default -> "Mã không đúng hoặc đã hết hạn.";
        };
    }

    static String normalizeEmail(String email) {
        return SelfRegistrationInputs.normalizeEmail(email);
    }

    static String normalizePhone(String phone) {
        return SelfRegistrationInputs.normalizePhone(phone);
    }

    private static User.Locale parseLocale(String locale) {
        try {
            return User.Locale.valueOf(locale);
        } catch (RuntimeException e) {
            return User.Locale.vi;
        }
    }
}
