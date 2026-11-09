package com.deutschflow.admin.service;

import com.deutschflow.common.mail.CodeMail;
import com.deutschflow.common.mail.TransactionalMail;
import com.deutschflow.notification.NotificationType;
import com.deutschflow.notification.entity.NotificationOutbox;
import com.deutschflow.notification.repository.NotificationOutboxRepository;
import com.deutschflow.user.entity.User;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.time.DateTimeException;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.Executor;

/**
 * Báo cho người bị admin đặt lại mật khẩu (đợt 2 admin, 09/11/2026).
 *
 * <p>Trước đây {@code PATCH /api/admin/users/{id}/password} hoàn toàn im lặng với người bị đổi: đó là
 * đường ĐÓNG VAI (đặt mật khẩu rồi đăng nhập là mang đúng danh tính người đó) mà nạn nhân không có
 * cách nào biết. Giờ hai kênh:
 * <ul>
 *   <li><b>thông báo trong app</b> — ghi qua {@code notification_outbox} TRONG giao dịch đặt lại (G2):
 *       rollback thì không có thông báo, commit thì worker gửi qua
 *       {@code UserNotificationService.deliverToUser} và tự thử lại khi lỗi;</li>
 *   <li><b>email</b> — chỉ khi SMTP bật, gửi SAU commit trên {@code taskExecutor} (cùng khuôn
 *       {@code PasswordResetService}): request không chờ SMTP, và thư không bao giờ rời máy cho một
 *       lần đặt lại đã rollback.</li>
 * </ul>
 *
 * <p>⛔ Cả hai kênh KHÔNG mang lý do nội bộ và KHÔNG mang danh tính admin — chỉ "đội hỗ trợ" + thời
 * điểm. Lý do nằm ở vết audit cho admin đọc, không đi ra ngoài.
 */
@Slf4j
@Component
public class AdminPasswordResetNotifier {

    private static final ZoneId FALLBACK_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");

    private final NotificationOutboxRepository outboxRepository;
    private final TransactionalMail mail;
    private final Executor mailExecutor;
    private final String webUrl;

    public AdminPasswordResetNotifier(NotificationOutboxRepository outboxRepository,
                                      TransactionalMail mail,
                                      @Qualifier("taskExecutor") Executor mailExecutor,
                                      @Value("${app.web-url:http://localhost:3000}") String webUrl) {
        this.outboxRepository = outboxRepository;
        this.mail = mail;
        this.mailExecutor = mailExecutor;
        this.webUrl = webUrl == null ? "" : webUrl.split(",")[0].trim().replaceAll("/+$", "");
    }

    /** Gọi TRONG giao dịch đặt lại mật khẩu, sau khi đã lưu mật khẩu mới. */
    public void notifyReset(User user, Instant at) {
        ZoneId zone = zoneOf(user);
        String locale = user.getLocale() == null ? "vi" : user.getLocale().name();

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("resetAt", at.toString());
        payload.put("resetAtDisplay", display("vi", at, zone));
        outboxRepository.save(NotificationOutbox.builder()
                .dedupKey("admin-password-reset:" + user.getId() + ":" + at.toEpochMilli())
                .notificationType(NotificationType.PASSWORD_RESET_BY_ADMIN)
                .recipientId(user.getId())
                .payload(payload)
                .build());

        if (!mail.isEnabled() || user.getEmail() == null || user.getEmail().isBlank()) {
            return;
        }
        String to = user.getEmail().trim();
        String when = display(locale, at, zone);
        afterCommit(() -> mailExecutor.execute(() -> sendEmail(to, locale, when)));
    }

    private void sendEmail(String to, String locale, String when) {
        try {
            var m = CodeMail.passwordResetByAdmin(locale, when, webUrl + "/v2/forgot-password");
            mail.sendRich("admin-password-reset", to, m.subject(), m.text(), m.html());
        } catch (Exception e) {
            // Thư là kênh phụ (thông báo trong app đã nằm trong outbox) — log, không ném.
            log.warn("[AdminPasswordReset] failed to send notice email to {}***: {}",
                    to.substring(0, Math.min(3, to.length())), e.getMessage());
        }
    }

    static String display(String locale, Instant at, ZoneId zone) {
        String pattern = switch (locale == null ? "vi" : locale) {
            case "en" -> "yyyy-MM-dd HH:mm";
            case "de" -> "dd.MM.yyyy HH:mm";
            default -> "HH:mm dd/MM/yyyy";
        };
        String offset = at.atZone(zone).getOffset().getId();
        String suffix = "Z".equals(offset) ? " (UTC)" : " (UTC" + offset + ")";
        return DateTimeFormatter.ofPattern(pattern).format(at.atZone(zone)) + suffix;
    }

    private static ZoneId zoneOf(User user) {
        String tz = user.getNotificationTimezone();
        if (tz == null || tz.isBlank()) return FALLBACK_ZONE;
        try {
            return ZoneId.of(tz.trim());
        } catch (DateTimeException e) {
            return FALLBACK_ZONE;
        }
    }

    /** Chạy sau khi giao dịch commit; không có giao dịch thì chạy ngay. */
    private static void afterCommit(Runnable task) {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    task.run();
                }
            });
        } else {
            task.run();
        }
    }
}
