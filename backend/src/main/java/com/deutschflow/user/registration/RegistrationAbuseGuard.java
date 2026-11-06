package com.deutschflow.user.registration;

import com.deutschflow.user.dto.RegisterRequest;
import com.deutschflow.user.registration.RegistrationVerificationException.Reason;
import io.micrometer.core.instrument.MeterRegistry;
import org.springframework.stereotype.Component;

/**
 * Cổng "người thật, không phải máy" cho MỌI đường tự đăng ký ({@code /register} cũ và
 * {@code /register/start}). Ba lớp rẻ → đắt, dừng ở lớp đầu tiên bắt được:
 * <ol>
 *   <li><b>Honeypot</b> — ô {@code website} ẩn khỏi người dùng; trình điền form tự động hay điền nó.</li>
 *   <li><b>Email hộp thư tạm</b> — máy đọc được mã PIN gửi tới đó.</li>
 *   <li><b>Cloudflare Turnstile</b> — một lượt gọi mạng, nên để cuối.</li>
 * </ol>
 * Rate-limit theo IP/email và bulkhead BCrypt nằm ở {@code AuthController}, chạy TRƯỚC cổng này
 * (chặn tràn trước khi tốn lượt gọi Turnstile).
 *
 * <p>Honeypot và Turnstile trả cùng một lỗi chung {@code HUMAN_CHECK_FAILED}, không nói lớp nào bắt —
 * nói rõ là chỉ cho bot biết phải sửa gì.
 */
@Component
public class RegistrationAbuseGuard {

    private final TurnstileVerifier turnstile;
    private final DisposableEmailDomains disposable;
    private final MeterRegistry meters;

    public RegistrationAbuseGuard(TurnstileVerifier turnstile, DisposableEmailDomains disposable, MeterRegistry meters) {
        this.turnstile = turnstile;
        this.disposable = disposable;
        this.meters = meters;
    }

    public void check(RegisterRequest req, String turnstileToken, String ip, boolean isMobile) {
        if (req.website() != null && !req.website().isBlank()) {
            throw blocked("HONEYPOT", Reason.HUMAN_CHECK_FAILED, humanCheckMessage());
        }
        if (disposable.isDisposable(req.email())) {
            throw blocked("DISPOSABLE_EMAIL", Reason.DISPOSABLE_EMAIL,
                    "Không đăng ký được bằng địa chỉ email tạm thời. Vui lòng dùng email bạn dùng hằng ngày.");
        }
        TurnstileVerifier.Outcome o = turnstile.verify(turnstileToken, ip, isMobile);
        if (o == TurnstileVerifier.Outcome.FAILED || o == TurnstileVerifier.Outcome.ERROR_BLOCKED) {
            throw blocked("TURNSTILE", Reason.HUMAN_CHECK_FAILED, humanCheckMessage());
        }
    }

    private RegistrationVerificationException blocked(String layer, Reason reason, String message) {
        meters.counter("registration.abuse.blocked", "layer", layer).increment();
        return new RegistrationVerificationException(reason, message);
    }

    private static String humanCheckMessage() {
        return "Chưa xác nhận được bạn là người dùng thật. Vui lòng tải lại trang và thử lại.";
    }
}
