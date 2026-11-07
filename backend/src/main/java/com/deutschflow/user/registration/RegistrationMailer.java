package com.deutschflow.user.registration;

import com.deutschflow.common.mail.CodeMail;
import com.deutschflow.common.mail.TransactionalMail;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Hai thư của luồng mã PIN. KHÁC năm mailer cũ: <b>ném lỗi</b> chứ không nuốt — email là lối vào duy
 * nhất, báo "đã gửi" khi chưa gửi là khoá người dùng ngoài cửa. Người gọi quyết định trả 503 (start)
 * hay chỉ log (resend).
 *
 * <p>Mã nằm trên TIÊU ĐỀ để đọc được ngay trên thông báo (iOS còn tự gợi ý cho ô {@code oneTimeCode}).
 * Thư mã PIN không chứa link nào. Mỗi thư thuần một thứ tiếng theo {@code locale}. Nội dung và giao diện
 * (chữ thuần + HTML, mẫu "Thư B" 08/11/2026) nằm ở {@link CodeMail}.
 */
@Component
public class RegistrationMailer {

    private final TransactionalMail mail;
    private final String webUrl;

    public RegistrationMailer(TransactionalMail mail,
                              @Value("${app.web-url:http://localhost:3000}") String webUrl) {
        this.mail = mail;
        this.webUrl = webUrl == null ? "" : webUrl.split(",")[0].trim().replaceAll("/+$", "");
    }

    public void sendCode(String to, String code, String locale, int ttlMinutes) {
        var m = CodeMail.code(CodeMail.Purpose.REGISTRATION, locale, code, ttlMinutes);
        mail.sendRich("registration-code", to, m.subject(), m.text(), m.html());
    }

    public void sendAlreadyRegistered(String to, String locale) {
        var m = CodeMail.alreadyRegistered(locale, webUrl + "/v2/login", webUrl + "/v2/forgot-password");
        mail.sendRich("registration-existing", to, m.subject(), m.text(), m.html());
    }
}
