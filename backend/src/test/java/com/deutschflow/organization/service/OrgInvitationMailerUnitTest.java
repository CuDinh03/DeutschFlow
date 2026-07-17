package com.deutschflow.organization.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

/**
 * Link nhận lời mời là mắt xích B2B dễ vỡ nhất: người nhận đến từ EMAIL, thường CHƯA có tài khoản, và
 * token nằm trong query string. Email ĐÃ GỬI thì không sửa được nữa — link sai là mất hẳn người đó.
 */
class OrgInvitationMailerUnitTest {

    private static final String WEB = "https://mydeutschflow.com";

    /** mailHost rỗng = SMTP chưa cấu hình → mailer im lặng bỏ qua (hành vi sẵn có). */
    private static OrgInvitationMailer mailerWithMail(JavaMailSender sender) {
        return new OrgInvitationMailer(sender, WEB, "smtp.example.com");
    }

    @Test
    @DisplayName("link mời trỏ vào trang nhận lời mời của giao diện v2, giữ nguyên token")
    void inviteLinkPointsAtV2AcceptPage() {
        JavaMailSender sender = mock(JavaMailSender.class);
        var captor = ArgumentCaptor.forClass(SimpleMailMessage.class);

        mailerWithMail(sender).sendInvite("teacher@example.com", "Trung tâm A", "TEACHER", "tok-123");

        verify(sender).send(captor.capture());
        String body = captor.getValue().getText();
        assertThat(body).isNotNull();
        assertThat(body)
                .as("phải là đường dẫn v2 — /org/accept của cây v1 sắp bị xoá")
                .contains(WEB + "/v2/org/accept?token=tok-123");
        assertThat(body)
                .as("không được còn sót đường dẫn v1")
                .doesNotContain(WEB + "/org/accept");
    }

    @Test
    @DisplayName("chưa cấu hình SMTP thì không gửi và cũng KHÔNG được ném lỗi (không chặn việc tạo lời mời)")
    void doesNotSendNorThrowWhenMailDisabled() {
        JavaMailSender sender = mock(JavaMailSender.class);
        var mailer = new OrgInvitationMailer(sender, WEB, "");

        mailer.sendInvite("teacher@example.com", "Trung tâm A", "TEACHER", "tok-123");

        verify(sender, never()).send(any(SimpleMailMessage.class));
    }

    @Test
    @DisplayName("base URL nhận cả danh sách kiểu CORS thì lấy origin đầu tiên và bỏ dấu / thừa")
    void normalisesBaseUrl() {
        JavaMailSender sender = mock(JavaMailSender.class);
        var captor = ArgumentCaptor.forClass(SimpleMailMessage.class);
        // Đúng hình dạng của CORS_ALLOWED_ORIGINS khi WEB_URL không được đặt (fallback trong yml).
        var mailer = new OrgInvitationMailer(
                sender, "https://mydeutschflow.com/,https://www.mydeutschflow.com", "smtp.example.com");

        mailer.sendInvite("teacher@example.com", "Trung tâm A", "MANAGER", "tok-9");

        verify(sender).send(captor.capture());
        assertThat(captor.getValue().getText())
                .contains("https://mydeutschflow.com/v2/org/accept?token=tok-9")
                .doesNotContain("//v2/org/accept");
    }
}
