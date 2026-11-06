package com.deutschflow.user.onboarding.lifecycle;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import com.deutschflow.common.mail.TransactionalMail;
import org.springframework.stereotype.Component;

/**
 * Email lifecycle (Đợt 6 §4.7) — cùng khuôn với {@code AccountActivationMailer}: text thuần, một
 * link về web, nuốt lỗi gửi (tin in-app/push đã đi trước, email chỉ là kênh phụ). Chỉ được gọi khi
 * {@code app.onboarding.lifecycle.email-enabled=true}; không có SMTP ⇒ log rồi thôi.
 */
@Component
@Slf4j
public class OnboardingLifecycleMailer {

    private final TransactionalMail mail;
    private final String webUrl;

    public OnboardingLifecycleMailer(TransactionalMail mail,
                                     @Value("${app.web-url:http://localhost:3000}") String webUrl) {
        this.mail = mail;
        this.webUrl = webUrl == null ? "" : webUrl.split(",")[0].trim().replaceAll("/+$", "");
    }

    public void send(String to, String displayName, String title, String body) {
        if (to == null || to.isBlank()) return;
        if (!mail.isEnabled()) {
            log.info("[LIFECYCLE] chưa cấu hình SMTP — bỏ email \"{}\" tới {}", title, to);
            return;
        }
        String greeting = displayName == null || displayName.isBlank() ? "Xin chào," : "Xin chào " + displayName + ",";
        try {
            var msg = mail.newMessage();
            msg.setTo(to);
            msg.setSubject("DeutschFlow — " + title);
            msg.setText(greeting + "\n\n" + body + "\n\n" + "Mở DeutschFlow: " + webUrl + "/v2/student/dashboard\n\n"
                    + "Bạn nhận email này vì đã bật nhắc học. Tắt trong Hồ sơ → Giờ nhắc học.\n\nDeutschFlow Team");
            mail.send("onboarding-lifecycle", msg);
        } catch (Exception e) {
            log.warn("[LIFECYCLE] không gửi được email \"{}\" tới {}: {}", title, to, e.getMessage());
        }
    }
}
