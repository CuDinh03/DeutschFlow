package com.deutschflow.marketing.service;

import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.common.exception.RateLimitExceededException;
import com.deutschflow.marketing.dto.SchoolDemoRequestDto;
import com.deutschflow.marketing.dto.SchoolDemoRequestPayload;
import com.deutschflow.marketing.entity.SchoolDemoRequest;
import com.deutschflow.marketing.repository.SchoolDemoRequestRepository;
import com.deutschflow.notification.service.UserNotificationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Duration;
import java.time.Instant;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Form "Đặt lịch demo 20 phút" của trang trung tâm (đợt 3a): lưu yêu cầu rồi báo owner — thông báo
 * trong chuông của admin (luôn có) và email tới {@code app.leads.notify-email} (khi đã cấu hình).
 *
 * <p>Endpoint công khai, không đăng nhập ⇒ chống lạm dụng như lead magnet chấm thử: honeypot, giới
 * hạn độ dài, trần theo IP (đã hash) và trần toàn hệ thống mỗi 24 giờ. Bộ lọc
 * {@code PublicApiRateLimitFilter} (30 lượt/phút/IP cho {@code /api/public/**}) vẫn đứng trước.
 *
 * <p>Thông điệp lỗi bằng tiếng Việt cho log/API; trang web hiển thị câu theo ngôn ngữ của nó dựa trên
 * mã HTTP (400/429), không in nguyên văn thông điệp này.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class SchoolDemoRequestService {

    static final int MAX_NAME = 160;
    static final int MAX_ORGANIZATION = 200;
    static final int MAX_COUNTRY = 80;
    static final int MAX_CONTACT = 255;
    static final int MAX_MESSAGE = 1000;
    /** Một trung tâm gửi lại vài lần (sửa số điện thoại…) là bình thường; hơn thế là spam. */
    static final int PER_IP_DAILY_LIMIT = 5;
    /** Trần toàn hệ thống / 24h — chặn bot làm ngập hộp thư owner. */
    static final int GLOBAL_DAILY_LIMIT = 100;
    private static final Duration WINDOW = Duration.ofHours(24);
    private static final int RETRY_AFTER_SECONDS = 3_600;

    private static final Set<String> STUDENT_COUNTS = Set.of("LT20", "S20_50", "S50_200", "GT200");
    private static final Set<String> CHANNELS = Set.of("EMAIL", "ZALO", "WHATSAPP", "PHONE");
    private static final Set<String> LOCALES = Set.of("vi", "en", "de");
    private static final Pattern EMAIL = Pattern.compile("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$");
    private static final Pattern PHONE = Pattern.compile("^\\+?[0-9][0-9\\s.\\-()]{6,22}$");

    private final SchoolDemoRequestRepository repository;
    private final UserNotificationService userNotificationService;
    private final SchoolDemoRequestMailer mailer;

    /**
     * Không mở transaction quanh cả hàm: lưu tự commit, rồi mới báo — gửi email chậm không được giữ
     * một connection DB của endpoint công khai.
     */
    public SchoolDemoRequest submit(SchoolDemoRequestPayload req, String clientIp) {
        // 1) Honeypot: người thật để trống; bot điền → loại sớm, không lưu, không báo.
        if (req.website() != null && !req.website().isBlank()) {
            log.info("[SchoolDemo] honeypot tripped — dropping request from ipHash={}", hashIp(clientIp));
            throw new BadRequestException("Yêu cầu không hợp lệ.");
        }

        String name = required(req.name(), MAX_NAME, "Vui lòng nhập tên của bạn.");
        String organization = required(req.organization(), MAX_ORGANIZATION, "Vui lòng nhập tên trung tâm.");
        String country = required(req.country(), MAX_COUNTRY, "Vui lòng nhập nước.");
        String studentCount = oneOf(req.studentCount(), STUDENT_COUNTS, "Vui lòng chọn số học viên.");
        String channel = oneOf(req.contactChannel(), CHANNELS, "Vui lòng chọn kênh liên hệ.");
        String contact = required(req.contact(), MAX_CONTACT, "Vui lòng nhập thông tin liên hệ.");
        boolean contactOk = "EMAIL".equals(channel) ? EMAIL.matcher(contact).matches() : PHONE.matcher(contact).matches();
        if (!contactOk) {
            throw new BadRequestException("EMAIL".equals(channel)
                    ? "Email không hợp lệ."
                    : "Số liên hệ không hợp lệ.");
        }
        String message = optional(req.message(), MAX_MESSAGE);
        String locale = req.locale() != null && LOCALES.contains(req.locale()) ? req.locale() : "vi";
        String ipHash = hashIp(clientIp);

        // 2) Trần theo IP và toàn hệ thống, trước khi ghi.
        Instant since = Instant.now().minus(WINDOW);
        if (ipHash != null && repository.countByIpHashAndCreatedAtAfter(ipHash, since) >= PER_IP_DAILY_LIMIT) {
            throw new RateLimitExceededException("Bạn đã gửi nhiều yêu cầu hôm nay. Chúng tôi sẽ liên hệ lại sớm.", RETRY_AFTER_SECONDS);
        }
        if (repository.countByCreatedAtAfter(since) >= GLOBAL_DAILY_LIMIT) {
            throw new RateLimitExceededException("Hệ thống đang nhận quá nhiều yêu cầu. Vui lòng thử lại sau.", RETRY_AFTER_SECONDS);
        }

        SchoolDemoRequest saved = repository.save(SchoolDemoRequest.builder()
                .name(name)
                .organization(organization)
                .country(country)
                .studentCount(studentCount)
                .contactChannel(channel)
                .contact(contact)
                .message(message)
                .locale(locale)
                .ipHash(ipHash)
                .build());
        log.info("[SchoolDemo] captured request id={} country={} students={} channel={}",
                saved.getId(), country, studentCount, channel);

        // 3) Báo owner. Cả hai đường đều best-effort: yêu cầu đã nằm an toàn trong DB.
        try {
            userNotificationService.onSystemAlert(
                    "SCHOOL_DEMO",
                    "Đặt lịch demo: " + organization,
                    name + " (" + organization + ", " + country + ", " + studentCount + " học viên) muốn đặt lịch demo — liên hệ qua "
                            + channel + ": " + contact,
                    Map.of("schoolDemoRequestId", saved.getId()));
        } catch (Exception e) {
            log.warn("[SchoolDemo] could not emit admin alert for request id={}: {}", saved.getId(), e.toString());
        }
        mailer.notifyOwner(saved);
        return saved;
    }

    /** Yêu cầu mới nhất cho admin liên hệ lại (mặc định 30 ngày). */
    @Transactional(readOnly = true)
    public List<SchoolDemoRequestDto> listRecent(int days, int limit) {
        int safeDays = Math.max(1, Math.min(days, 365));
        int safeLimit = Math.max(1, Math.min(limit, 500));
        return repository.findRecentSince(Instant.now().minus(Duration.ofDays(safeDays)), PageRequest.of(0, safeLimit))
                .stream().map(SchoolDemoRequestDto::from).toList();
    }

    private static String required(String raw, int max, String message) {
        String v = raw == null ? "" : raw.trim();
        if (v.isEmpty() || v.length() > max) {
            throw new BadRequestException(message);
        }
        return v;
    }

    private static String optional(String raw, int max) {
        String v = raw == null ? "" : raw.trim();
        if (v.isEmpty()) return null;
        return v.length() > max ? v.substring(0, max) : v;
    }

    private static String oneOf(String raw, Set<String> allowed, String message) {
        String v = raw == null ? "" : raw.trim();
        if (!allowed.contains(v)) {
            throw new BadRequestException(message);
        }
        return v;
    }

    /** SHA-256 của IP — cùng cách {@code LeadMagnetService} (không lưu IP thô). */
    static String hashIp(String ip) {
        if (ip == null || ip.isBlank()) {
            return null;
        }
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(md.digest(ip.trim().getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            return null;
        }
    }
}
