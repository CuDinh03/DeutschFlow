package com.deutschflow.user.registration;

import com.deutschflow.user.dto.RegisterRequest;
import com.deutschflow.user.registration.RegistrationVerificationException.Reason;
import com.sun.net.httpserver.HttpServer;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.Set;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Cổng "người thật" của đăng ký (chống bot 07/11/2026): honeypot, email hộp thư tạm, Cloudflare Turnstile.
 * Turnstile chạy trên máy chủ HTTP giả cục bộ thay cho {@code challenges.cloudflare.com}.
 */
class RegistrationAbuseGuardUnitTest {

    private HttpServer server;
    private final AtomicReference<String> reply = new AtomicReference<>("{\"success\":true,\"hostname\":\"mydeutschflow.com\"}");
    private final AtomicReference<String> lastForm = new AtomicReference<>("");
    private final SimpleMeterRegistry meters = new SimpleMeterRegistry();

    @BeforeEach
    void startStub() throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/siteverify", ex -> {
            lastForm.set(new String(ex.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
            byte[] body = reply.get().getBytes(StandardCharsets.UTF_8);
            ex.getResponseHeaders().add("Content-Type", "application/json");
            ex.sendResponseHeaders(200, body.length);
            ex.getResponseBody().write(body);
            ex.close();
        });
        server.start();
    }

    @AfterEach
    void stopStub() {
        server.stop(0);
    }

    private String url() {
        return "http://127.0.0.1:" + server.getAddress().getPort() + "/siteverify";
    }

    private TurnstileVerifier turnstile(boolean enabled, boolean requireForMobile, boolean failOpen, String siteverify) {
        return new TurnstileVerifier(enabled, enabled ? "secret-x" : "", requireForMobile, failOpen,
                "mydeutschflow.com", 1000, siteverify, meters);
    }

    private RegistrationAbuseGuard guard(TurnstileVerifier t) {
        return new RegistrationAbuseGuard(t, new DisposableEmailDomains(), meters);
    }

    private static RegisterRequest req(String email, String website) {
        return new RegisterRequest(email, "", "MatKhau123!", "Học viên", "vi", website);
    }

    @Test
    @DisplayName("người thật: email thường + token hợp lệ ⇒ qua; secret/token/IP được gửi tới siteverify")
    void humanPasses() {
        var g = guard(turnstile(true, false, true, url()));
        assertThatCode(() -> g.check(req("an@gmail.com", null), "tok-ok", "1.2.3.4", false)).doesNotThrowAnyException();
        assertThat(lastForm.get()).contains("secret=secret-x").contains("response=tok-ok").contains("remoteip=1.2.3.4");
    }

    @Test
    @DisplayName("honeypot có giá trị ⇒ HUMAN_CHECK_FAILED, không gọi Turnstile")
    void honeypotBlocks() {
        var g = guard(turnstile(true, false, true, url()));
        assertThatThrownBy(() -> g.check(req("an@gmail.com", "http://spam"), "tok-ok", "1.2.3.4", false))
                .isInstanceOf(RegistrationVerificationException.class)
                .extracting(e -> ((RegistrationVerificationException) e).getReason())
                .isEqualTo(Reason.HUMAN_CHECK_FAILED);
        assertThat(lastForm.get()).isEmpty();
    }

    @Test
    @DisplayName("email hộp thư tạm (kể cả tên miền con, chữ hoa) ⇒ DISPOSABLE_EMAIL")
    void disposableBlocks() {
        var g = guard(turnstile(false, false, true, url()));
        for (String email : new String[]{"x@mailinator.com", "x@EU.Mailinator.com", "x@yopmail.fr"}) {
            assertThatThrownBy(() -> g.check(req(email, null), null, "1.2.3.4", false))
                    .extracting(e -> ((RegistrationVerificationException) e).getReason())
                    .isEqualTo(Reason.DISPOSABLE_EMAIL);
        }
        assertThatCode(() -> g.check(req("x@gmail.com", null), null, "1.2.3.4", false)).doesNotThrowAnyException();
        assertThatCode(() -> g.check(req("x@notmailinator.com", null), null, "1.2.3.4", false))
                .as("chỉ khớp theo nhãn tên miền, không khớp chuỗi con").doesNotThrowAnyException();
    }

    @Test
    @DisplayName("Turnstile từ chối / thiếu token / token của hostname khác ⇒ HUMAN_CHECK_FAILED")
    void turnstileRejects() {
        var g = guard(turnstile(true, false, true, url()));
        reply.set("{\"success\":false,\"error-codes\":[\"invalid-input-response\"]}");
        assertThatThrownBy(() -> g.check(req("an@gmail.com", null), "tok-bad", "1.2.3.4", false))
                .extracting(e -> ((RegistrationVerificationException) e).getReason())
                .isEqualTo(Reason.HUMAN_CHECK_FAILED);

        assertThatThrownBy(() -> g.check(req("an@gmail.com", null), null, "1.2.3.4", false))
                .as("không gửi token").isInstanceOf(RegistrationVerificationException.class);

        reply.set("{\"success\":true,\"hostname\":\"evil.example\"}");
        assertThatThrownBy(() -> g.check(req("an@gmail.com", null), "tok", "1.2.3.4", false))
                .as("token sinh trên site khác").isInstanceOf(RegistrationVerificationException.class);
    }

    @Test
    @DisplayName("app mobile được miễn khi require-for-mobile=false (lỗ đã biết); bật true thì không miễn")
    void mobileExemption() {
        assertThatCode(() -> guard(turnstile(true, false, true, url()))
                .check(req("an@gmail.com", null), null, "1.2.3.4", true)).doesNotThrowAnyException();
        assertThatThrownBy(() -> guard(turnstile(true, true, true, url()))
                .check(req("an@gmail.com", null), null, "1.2.3.4", true))
                .isInstanceOf(RegistrationVerificationException.class);
    }

    @Test
    @DisplayName("Cloudflare không trả lời: fail-open cho qua (có đếm), fail-closed chặn")
    void transportError() {
        String dead = "http://127.0.0.1:1/siteverify";
        assertThatCode(() -> guard(turnstile(true, false, true, dead))
                .check(req("an@gmail.com", null), "tok", "1.2.3.4", false)).doesNotThrowAnyException();
        assertThat(meters.get("registration.human_check").tag("outcome", "error_allowed").counter().count()).isEqualTo(1.0);
        assertThatThrownBy(() -> guard(turnstile(true, false, false, dead))
                .check(req("an@gmail.com", null), "tok", "1.2.3.4", false))
                .isInstanceOf(RegistrationVerificationException.class);
    }

    @Test
    @DisplayName("tắt công tắc ⇒ không gọi Cloudflare; bật mà thiếu secret ⇒ không khởi động")
    void switchAndBootCheck() {
        assertThatCode(() -> guard(turnstile(false, false, true, url()))
                .check(req("an@gmail.com", null), null, "1.2.3.4", false)).doesNotThrowAnyException();
        assertThat(lastForm.get()).isEmpty();
        assertThatThrownBy(() -> new TurnstileVerifier(true, "", false, true, "", 1000, url(), meters))
                .isInstanceOf(IllegalStateException.class).hasMessageContaining("TURNSTILE_SECRET");
    }

    @Test
    @DisplayName("danh sách email tạm nạp được từ classpath và không chứa nhà cung cấp thật")
    void disposableListLoads() {
        var d = new DisposableEmailDomains();
        assertThat(d.size()).isGreaterThan(30);
        for (String real : Set.of("gmail.com", "outlook.com", "yahoo.com", "icloud.com", "proton.me", "gmx.de", "web.de")) {
            assertThat(d.isDisposable("a@" + real)).as(real).isFalse();
        }
    }
}
