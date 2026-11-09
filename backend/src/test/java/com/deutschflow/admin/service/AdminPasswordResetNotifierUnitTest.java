package com.deutschflow.admin.service;

import com.deutschflow.common.mail.TransactionalMail;
import com.deutschflow.notification.NotificationType;
import com.deutschflow.notification.entity.NotificationOutbox;
import com.deutschflow.notification.repository.NotificationOutboxRepository;
import com.deutschflow.testsupport.SentMails;
import com.deutschflow.user.entity.User;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mail.javamail.JavaMailSender;

import java.time.Instant;
import java.time.ZoneId;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

/**
 * Đợt 2 admin (09/11/2026): người bị admin đặt lại mật khẩu được báo qua outbox + email — và
 * KHÔNG kênh nào mang lý do nội bộ hay danh tính admin.
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("AdminPasswordResetNotifier · báo người bị đặt lại mật khẩu")
class AdminPasswordResetNotifierUnitTest {

    private static final Instant AT = Instant.parse("2026-11-09T03:15:00Z");

    @Mock NotificationOutboxRepository outboxRepository;
    @Mock JavaMailSender mailSender;

    private AdminPasswordResetNotifier notifier(String smtpHost) {
        var mail = new TransactionalMail(mailSender, smtpHost,
                "support@mydeutschflow.com", "support@mydeutschflow.com", new SimpleMeterRegistry());
        // Executor chạy ngay; không có transaction nên afterCommit cũng chạy ngay.
        return new AdminPasswordResetNotifier(outboxRepository, mail, Runnable::run, "https://mydeutschflow.com/");
    }

    private static User user(User.Locale locale) {
        return User.builder().id(42L).email("hv@x.com").displayName("HV")
                .role(User.Role.STUDENT).locale(locale).notificationTimezone("Asia/Ho_Chi_Minh").build();
    }

    @Test
    @DisplayName("ghi outbox đúng người nhận + loại; payload chỉ có thời điểm")
    void enqueuesOutboxRow() {
        notifier("").notifyReset(user(User.Locale.vi), AT);

        ArgumentCaptor<NotificationOutbox> row = ArgumentCaptor.forClass(NotificationOutbox.class);
        verify(outboxRepository).save(row.capture());
        assertThat(row.getValue().getRecipientId()).isEqualTo(42L);
        assertThat(row.getValue().getNotificationType()).isEqualTo(NotificationType.PASSWORD_RESET_BY_ADMIN);
        assertThat(row.getValue().getPayload()).containsOnlyKeys("resetAt", "resetAtDisplay");
        assertThat(row.getValue().getPayload().get("resetAtDisplay")).isEqualTo("10:15 09/11/2026 (UTC+07:00)");
        assertThat(row.getValue().getDedupKey()).startsWith("admin-password-reset:42:");
        // SMTP chưa cấu hình ⇒ không đụng tới mail sender.
        verifyNoInteractions(mailSender);
    }

    @Test
    @DisplayName("SMTP bật: gửi email theo ngôn ngữ người nhận, không lý do, không danh tính admin")
    void sendsLocalizedEmail() {
        SentMails.stub(mailSender);
        notifier("smtp.example.com").notifyReset(user(User.Locale.de), AT);

        var sent = SentMails.all(mailSender);
        assertThat(sent).hasSize(1);
        assertThat(sent.get(0).to()).containsExactly("hv@x.com");
        assertThat(sent.get(0).subject()).contains("Passwort");
        assertThat(sent.get(0).text()).contains("09.11.2026 10:15").contains("/v2/forgot-password");
        assertThat(sent.get(0).text()).doesNotContainIgnoringCase("admin");
    }

    @Test
    @DisplayName("lỗi SMTP không lan ra (thông báo trong app đã nằm ở outbox)")
    void swallowsMailFailure() {
        SentMails.stub(mailSender);
        org.mockito.Mockito.doThrow(new org.springframework.mail.MailSendException("down"))
                .when(mailSender).send(any(jakarta.mail.internet.MimeMessage.class));

        notifier("smtp.example.com").notifyReset(user(User.Locale.vi), AT);

        verify(outboxRepository).save(any());
        verify(outboxRepository, never()).delete(any());
    }

    @Test
    @DisplayName("múi giờ lạ → về giờ Việt Nam")
    void badZoneFallsBack() {
        assertThat(AdminPasswordResetNotifier.display("en", AT, ZoneId.of("UTC"))).isEqualTo("2026-11-09 03:15 (UTC)");
        User u = user(User.Locale.en);
        u.setNotificationTimezone("Mars/Base");
        notifier("").notifyReset(u, AT);
        ArgumentCaptor<NotificationOutbox> row = ArgumentCaptor.forClass(NotificationOutbox.class);
        verify(outboxRepository).save(row.capture());
        assertThat(row.getValue().getPayload().get("resetAtDisplay")).isEqualTo("10:15 09/11/2026 (UTC+07:00)");
    }
}
