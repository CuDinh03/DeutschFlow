package com.deutschflow.user.activation;

import com.deutschflow.common.WebRoutes;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

/**
 * Gửi email "kích hoạt tài khoản" cho học viên vừa được trung tâm nhập từ CSV (Q-09, 14/09/2026).
 * Cùng khuôn {@link JavaMailSender} + {@link SimpleMailMessage} với
 * {@code com.deutschflow.organization.service.OrgInvitationMailer}.
 *
 * <p><b>Không bao giờ ném.</b> Dòng CSV đã commit khi tới đây; một SMTP hỏng không được làm trung tâm
 * tưởng lượt nhập thất bại. Học viên không nhận được email vẫn còn đường "Quên mật khẩu".
 *
 * <p><b>Không log liên kết.</b> Nó mang token — ai đọc được log là đặt được mật khẩu cho tài khoản
 * của một học viên chưa từng đăng nhập. {@code OrgInvitationMailer} đã trả giá cho bài học này.
 *
 * <p>Nội dung CHỈ tiếng Việt: khuôn mailer hiện tại ({@code SimpleMailMessage}, chuỗi cứng) không có
 * tầng i18n nào, và cả hai mailer đang chạy đều vậy. Học viên pilot là người Việt. Đa ngữ cho email
 * là một đợt riêng, phải làm cho CẢ ba mailer cùng lúc chứ không riêng cái này.
 */
@Slf4j
@Service
public class AccountActivationMailer {

    private final JavaMailSender mailSender;
    private final String webUrl;
    private final boolean mailEnabled;
    private final int ttlDays;

    public AccountActivationMailer(
            JavaMailSender mailSender,
            // Cùng khoá `app.web-url` với OrgInvitationMailer — xem javadoc ở đó về việc vì sao
            // KHÔNG được dựng link từ origin đầu tiên của CORS_ALLOWED_ORIGINS.
            @Value("${app.web-url:http://localhost:3000}") String webUrl,
            @Value("${spring.mail.host:}") String mailHost,
            @Value("${app.activation.ttl-days:14}") int ttlDays) {
        this.mailSender = mailSender;
        this.webUrl = stripTrailingSlash(firstOrigin(webUrl));
        this.mailEnabled = mailHost != null && !mailHost.isBlank();
        this.ttlDays = ttlDays;
    }

    /**
     * @param token token THÔ từ {@link AccountActivationService#issue} — chỉ đi vào email, không đi
     *              vào log dù ở mức nào
     */
    public void sendActivation(String to, String displayName, String orgName, String token) {
        String link = webUrl + WebRoutes.ACCOUNT_ACTIVATE + "?token=" + token;

        if (!mailEnabled) {
            log.warn("[Activation] chưa cấu hình SMTP — tài khoản của {} đã tạo nhưng KHÔNG gửi được email kích hoạt", to);
            return;
        }

        String greeting = displayName == null || displayName.isBlank() ? "Xin chào," : "Xin chào " + displayName + ",";
        String from = orgName == null || orgName.isBlank() ? "Trung tâm của bạn" : orgName;
        try {
            var msg = new SimpleMailMessage();
            msg.setTo(to);
            msg.setSubject("DeutschFlow — Kích hoạt tài khoản học viên");
            msg.setText(
                    greeting + "\n\n" +
                    from + " đã tạo cho bạn một tài khoản học tiếng Đức trên DeutschFlow.\n\n" +
                    "Nhấn vào liên kết dưới đây để đặt mật khẩu và bắt đầu học:\n\n" +
                    "    " + link + "\n\n" +
                    "Liên kết có hiệu lực trong " + ttlDays + " ngày và chỉ dùng được một lần.\n" +
                    "Nếu liên kết đã hết hạn, bạn vẫn vào được bằng chức năng \"Quên mật khẩu\" trên trang đăng nhập.\n\n" +
                    "Nếu bạn không mong đợi email này, hãy bỏ qua nó.\n\n" +
                    "DeutschFlow Team"
            );
            mailSender.send(msg);
            log.info("[Activation] đã gửi email kích hoạt tới {} (org={})", to, orgName);
        } catch (Exception e) {
            log.warn("[Activation] không gửi được email kích hoạt tới {}: {}", to, e.getMessage());
        }
    }

    private static String firstOrigin(String value) {
        if (value == null || value.isBlank()) {
            return "http://localhost:3000";
        }
        int comma = value.indexOf(',');
        return (comma >= 0 ? value.substring(0, comma) : value).trim();
    }

    private static String stripTrailingSlash(String value) {
        return value.endsWith("/") ? value.substring(0, value.length() - 1) : value;
    }
}
