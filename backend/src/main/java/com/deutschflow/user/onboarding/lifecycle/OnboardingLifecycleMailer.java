package com.deutschflow.user.onboarding.lifecycle;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Component;

/**
 * Email lifecycle (Đợt 6 §4.7) — cùng khuôn với {@code AccountActivationMailer}: text thuần, một
 * link về web, nuốt lỗi gửi (tin in-app/push đã đi trước, email chỉ là kênh phụ). Chỉ được gọi khi
 * {@code app.onboarding.lifecycle.email-enabled=true}; không có SMTP ⇒ log rồi thôi.
 */
@Component
@Slf4j
public class OnboardingLifecycleMailer {

    private final JavaMailSender mailSender;
    private final String webUrl;
    private final boolean mailEnabled;

    public OnboardingLifecycleMailer(JavaMailSender mailSender,
                                     @Value("${app.web-url:http://localhost:3000}") String webUrl,
                                     @Value("${spring.mail.host:}") String mailHost) {
        this.mailSender = mailSender;
        this.webUrl = webUrl == null ? "" : webUrl.split(",")[0].trim().replaceAll("/+$", "");
        this.mailEnabled = mailHost != null && !mailHost.isBlank();
    }

    public void send(String to, String displayName, String title, String body) {
        if (to == null || to.isBlank()) return;
        if (!mailEnabled) {
            log.info("[LIFECYCLE] chưa cấu hình SMTP — bỏ email \"{}\" tới {}", title, to);
            return;
        }
        String greeting = displayName == null || displayName.isBlank() ? "Xin chào," : "Xin chào " + displayName + ",";
        try {
            var msg = new SimpleMailMessage();
            msg.setTo(to);
            msg.setSubject("DeutschFlow — " + title);
            msg.setText(greeting + "\n\n" + body + "\n\n" + "Mở DeutschFlow: " + webUrl + "/v2/student/dashboard\n\n"
                    + "Bạn nhận email này vì đã bật nhắc học. Tắt trong Hồ sơ → Giờ nhắc học.\n\nDeutschFlow Team");
            mailSender.send(msg);
        } catch (Exception e) {
            log.warn("[LIFECYCLE] không gửi được email \"{}\" tới {}: {}", title, to, e.getMessage());
        }
    }
}
