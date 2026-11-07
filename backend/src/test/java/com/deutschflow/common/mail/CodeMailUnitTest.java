package com.deutschflow.common.mail;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/** Mẫu "Thư B" (08/11/2026) cho thư mã đăng ký, mã đặt lại mật khẩu và thư "bạn đã có tài khoản". */
class CodeMailUnitTest {

    @Test
    @DisplayName("mã đăng ký: mã ở đầu tiêu đề, 6 ô số trong HTML, mã liền trong chữ thuần, đúng số phút")
    void registrationCode_vi() {
        var m = CodeMail.code(CodeMail.Purpose.REGISTRATION, "vi", "482913", 60);
        assertThat(m.subject()).isEqualTo("482913 là mã xác minh myDeutschFlow của bạn");
        assertThat(m.text()).contains("    482913").contains("60 phút").contains("Bạn không đăng ký?");
        for (char c : "482913".toCharArray()) assertThat(m.html()).contains(">" + c + "</td>");
        assertThat(m.html()).contains("lang=\"vi\"").contains("Hết hạn sau 60 phút");
    }

    @Test
    @DisplayName("đặt lại mật khẩu theo tiếng Đức; ngôn ngữ lạ rơi về tiếng Việt")
    void resetCode_localeFallback() {
        var de = CodeMail.code(CodeMail.Purpose.PASSWORD_RESET, "de", "703561", 15);
        assertThat(de.subject()).startsWith("703561 ist dein Code");
        assertThat(de.html()).contains("lang=\"de\"").contains("15 Minuten");
        var fr = CodeMail.code(CodeMail.Purpose.PASSWORD_RESET, "fr", "703561", 15);
        assertThat(fr.subject()).isEqualTo("703561 là mã đặt lại mật khẩu myDeutschFlow");
    }

    @Test
    @DisplayName("HTML hợp luật thư: không ảnh, không SVG, không script; URL cấu hình được escape")
    void htmlIsEmailSafe() {
        var m = CodeMail.alreadyRegistered("en", "https://x.example/v2/login?a=1&b=\"2\"", "https://x.example/v2/forgot-password");
        assertThat(m.subject()).doesNotContainPattern("\\d{6}");
        assertThat(m.text()).contains("/v2/login").contains("/v2/forgot-password");
        assertThat(m.html()).doesNotContain("<img").doesNotContain("<svg").doesNotContain("<script")
                .contains("a=1&amp;b=&quot;2&quot;").doesNotContain("b=\"2\"");
    }
}
