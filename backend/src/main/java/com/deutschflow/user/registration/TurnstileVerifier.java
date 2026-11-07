package com.deutschflow.user.registration;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import io.micrometer.core.instrument.MeterRegistry;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.web.client.RestClient;

import java.time.Duration;
import java.util.List;

/**
 * Kiểm "người thật" bằng Cloudflare Turnstile (owner chốt 07/11/2026): gọi {@code siteverify} với token
 * mà widget trên trang đăng ký sinh ra.
 *
 * <p><b>Công tắc mặc định TẮT</b> ({@code TURNSTILE_ENABLED}). Bật mà thiếu secret ⇒ không cho boot,
 * cùng luật với mã PIN: bật một cổng mà không có chìa là khoá cửa đăng ký với mọi người.
 *
 * <p><b>Cloudflare không trả lời được</b> (timeout, 5xx): mặc định cho qua ({@code fail-open=true}) và
 * đếm {@code registration.human_check{outcome=error}}. Lý do: đây là một lớp trong nhiều lớp (mã PIN qua
 * email, rate-limit theo IP/email, honeypot), còn chặn hết người thật mỗi khi Cloudflare chập chờn là
 * một sự cố tự gây. Đặt {@code TURNSTILE_FAIL_OPEN=false} khi đang bị tấn công thật.
 *
 * <p><b>App mobile</b> chưa có widget (cần {@code react-native-webview} ⇒ build native mới, để đợt sau).
 * Trong lúc đó {@code require-for-mobile=false} miễn kiểm cho request mang {@code X-Platform: ios|android}.
 * ⚠️ Header đó ai cũng giả được — đây là lỗ ĐÃ BIẾT, chặn tạm bằng mã PIN + rate-limit. Đặt
 * {@code TURNSTILE_REQUIRE_FOR_MOBILE=true} ngay khi bản app có widget phủ hết người dùng.
 */
@Slf4j
@Component
public class TurnstileVerifier {

    static final String SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

    public enum Outcome { PASSED, SKIPPED, FAILED, ERROR_ALLOWED, ERROR_BLOCKED }

    private final boolean enabled;
    private final String secret;
    private final boolean requireForMobile;
    private final boolean failOpen;
    private final String expectedHostname;
    private final RestClient http;
    private final MeterRegistry meters;

    public TurnstileVerifier(
            @Value("${app.security.turnstile.enabled:false}") boolean enabled,
            @Value("${app.security.turnstile.secret:}") String secret,
            @Value("${app.security.turnstile.require-for-mobile:false}") boolean requireForMobile,
            @Value("${app.security.turnstile.fail-open:true}") boolean failOpen,
            @Value("${app.security.turnstile.expected-hostname:}") String expectedHostname,
            @Value("${app.security.turnstile.timeout-ms:4000}") int timeoutMs,
            @Value("${app.security.turnstile.siteverify-url:" + SITEVERIFY_URL + "}") String siteverifyUrl,
            MeterRegistry meters) {
        if (enabled && (secret == null || secret.isBlank())) {
            throw new IllegalStateException("TURNSTILE_ENABLED=true nhưng TURNSTILE_SECRET rỗng");
        }
        this.enabled = enabled;
        this.secret = secret == null ? "" : secret.trim();
        this.requireForMobile = requireForMobile;
        this.failOpen = failOpen;
        this.expectedHostname = expectedHostname == null ? "" : expectedHostname.trim();
        var factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofMillis(Math.max(500, timeoutMs)));
        factory.setReadTimeout(Duration.ofMillis(Math.max(500, timeoutMs)));
        this.http = RestClient.builder().baseUrl(siteverifyUrl).requestFactory(factory).build();
        this.meters = meters;
    }

    public boolean enabled() {
        return enabled;
    }

    /**
     * @param token    giá trị header {@code X-Turnstile-Token} (null/rỗng = client không gửi)
     * @param ip       IP client đã qua {@code ClientIpResolver}
     * @param isMobile request mang {@code X-Platform: ios|android}
     */
    public Outcome verify(String token, String ip, boolean isMobile) {
        if (!enabled || (isMobile && !requireForMobile)) {
            return count(Outcome.SKIPPED);
        }
        if (token == null || token.isBlank() || token.length() > 2048) {
            return count(Outcome.FAILED);
        }
        try {
            var form = new LinkedMultiValueMap<String, String>();
            form.add("secret", secret);
            form.add("response", token);
            if (ip != null && !ip.isBlank()) form.add("remoteip", ip);
            SiteverifyResponse res = http.post()
                    .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                    .body(form)
                    .retrieve()
                    .body(SiteverifyResponse.class);
            if (res == null) {
                return transportError("rỗng");
            }
            if (!res.success()) {
                log.info("[Turnstile] từ chối: {}", res.errorCodes());
                return count(Outcome.FAILED);
            }
            if (!expectedHostname.isEmpty() && !expectedHostname.equalsIgnoreCase(res.hostname())) {
                log.warn("[Turnstile] token của hostname khác: {}", res.hostname());
                return count(Outcome.FAILED);
            }
            return count(Outcome.PASSED);
        } catch (RuntimeException e) {
            return transportError(e.getMessage());
        }
    }

    private Outcome transportError(String detail) {
        log.warn("[Turnstile] không gọi được siteverify ({}), fail-open={}", detail, failOpen);
        return count(failOpen ? Outcome.ERROR_ALLOWED : Outcome.ERROR_BLOCKED);
    }

    private Outcome count(Outcome o) {
        meters.counter("registration.human_check", "outcome", o.name().toLowerCase()).increment();
        return o;
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    record SiteverifyResponse(
            boolean success,
            String hostname,
            @JsonProperty("error-codes") List<String> errorCodes) {}
}
