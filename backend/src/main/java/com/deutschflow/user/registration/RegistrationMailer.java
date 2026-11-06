package com.deutschflow.user.registration;

import com.deutschflow.common.mail.TransactionalMail;
import com.deutschflow.user.service.I18n;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Hai thư của luồng mã PIN. KHÁC năm mailer cũ: <b>ném lỗi</b> chứ không nuốt — email là lối vào duy
 * nhất, báo "đã gửi" khi chưa gửi là khoá người dùng ngoài cửa. Người gọi quyết định trả 503 (start)
 * hay chỉ log (resend).
 *
 * <p>Mã nằm trên TIÊU ĐỀ để đọc được ngay trên thông báo (iOS còn tự gợi ý cho ô {@code oneTimeCode}).
 * Thư mã PIN không chứa link nào. Mỗi thư thuần một thứ tiếng theo {@code locale}.
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
        var msg = mail.newMessage();
        msg.setTo(to);
        msg.setSubject(I18n.pick(locale,
                code + " là mã xác minh DeutschFlow của bạn",
                code + " is your DeutschFlow verification code",
                code + " ist dein DeutschFlow-Bestätigungscode"));
        msg.setText(I18n.pick(locale,
                "Xin chào,\n\n"
                        + "Mã xác minh để hoàn tất đăng ký DeutschFlow của bạn là:\n\n"
                        + "    " + code + "\n\n"
                        + "Mã hết hạn sau " + ttlMinutes + " phút.\n"
                        + "Nếu bạn không đăng ký, hãy bỏ qua thư này. Sẽ không có tài khoản nào được tạo.\n\n"
                        + "DeutschFlow Team",
                "Hello,\n\n"
                        + "Your verification code to finish signing up for DeutschFlow is:\n\n"
                        + "    " + code + "\n\n"
                        + "The code expires in " + ttlMinutes + " minutes.\n"
                        + "If you did not sign up, please ignore this email. No account will be created.\n\n"
                        + "The DeutschFlow Team",
                "Hallo,\n\n"
                        + "dein Bestätigungscode für die Registrierung bei DeutschFlow lautet:\n\n"
                        + "    " + code + "\n\n"
                        + "Der Code ist " + ttlMinutes + " Minuten gültig.\n"
                        + "Wenn du dich nicht registriert hast, ignoriere diese E-Mail. Es wird kein Konto angelegt.\n\n"
                        + "Dein DeutschFlow-Team"));
        mail.send("registration-code", msg);
    }

    public void sendAlreadyRegistered(String to, String locale) {
        String login = webUrl + "/v2/login";
        String forgot = webUrl + "/v2/forgot-password";
        var msg = mail.newMessage();
        msg.setTo(to);
        msg.setSubject(I18n.pick(locale,
                "Bạn đã có tài khoản DeutschFlow",
                "You already have a DeutschFlow account",
                "Du hast bereits ein DeutschFlow-Konto"));
        msg.setText(I18n.pick(locale,
                "Xin chào,\n\n"
                        + "Có người vừa dùng địa chỉ email này để đăng ký DeutschFlow, nhưng email này đã có tài khoản.\n\n"
                        + "Đăng nhập: " + login + "\n"
                        + "Quên mật khẩu: " + forgot + "\n\n"
                        + "Nếu không phải bạn, hãy bỏ qua thư này. Tài khoản của bạn không thay đổi gì.\n\n"
                        + "DeutschFlow Team",
                "Hello,\n\n"
                        + "Someone just tried to sign up for DeutschFlow with this email address, but it already has an account.\n\n"
                        + "Log in: " + login + "\n"
                        + "Forgot your password: " + forgot + "\n\n"
                        + "If this was not you, please ignore this email. Nothing has changed in your account.\n\n"
                        + "The DeutschFlow Team",
                "Hallo,\n\n"
                        + "jemand hat gerade versucht, sich mit dieser E-Mail-Adresse bei DeutschFlow zu registrieren, aber dafür gibt es bereits ein Konto.\n\n"
                        + "Anmelden: " + login + "\n"
                        + "Passwort vergessen: " + forgot + "\n\n"
                        + "Wenn du das nicht warst, ignoriere diese E-Mail. An deinem Konto hat sich nichts geändert.\n\n"
                        + "Dein DeutschFlow-Team"));
        mail.send("registration-existing", msg);
    }
}
