package com.deutschflow.user.mfa;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.time.Duration;

/**
 * Chính sách 2FA cho ADMIN.
 *
 * <ul>
 *   <li>{@code app.security.admin-mfa.enforced} ({@code ADMIN_MFA_ENFORCED}, mặc định {@code true}) — mọi
 *       ADMIN phải qua 2FA; access token ADMIN thiếu claim {@code mfa} bị {@code JwtAuthFilter} trả 401
 *       {@code MFA_REQUIRED}. Đặt {@code false} CHỈ trong sự cố khoá ngoài (runbook): khi đó admin CHƯA đăng
 *       ký được đăng nhập bằng mật khẩu, admin ĐÃ đăng ký vẫn phải qua 2FA.</li>
 *   <li>{@code app.security.admin-mfa.max-session-hours} (mặc định 12) — tuổi tối đa của một lần qua 2FA:
 *       refresh của ADMIN có {@code mfa_verified_at} cũ hơn mốc này bị từ chối, phải đăng nhập lại.</li>
 * </ul>
 */
@Slf4j
@Component
public class AdminMfaPolicy {

    private final boolean enforced;
    private final Duration maxSessionAge;

    public AdminMfaPolicy(@Value("${app.security.admin-mfa.enforced:true}") boolean enforced,
                          @Value("${app.security.admin-mfa.max-session-hours:12}") long maxSessionHours) {
        this.enforced = enforced;
        this.maxSessionAge = Duration.ofHours(Math.max(1, maxSessionHours));
        if (!enforced) {
            log.warn("[MFA] app.security.admin-mfa.enforced=false — 2FA KHÔNG bắt buộc cho ADMIN. Chỉ dùng khi gỡ "
                    + "khoá ngoài theo docs/RUNBOOK_2FA_ADMIN.md, bật lại ngay sau khi xong.");
        }
    }

    public boolean enforced() {
        return enforced;
    }

    public Duration maxSessionAge() {
        return maxSessionAge;
    }
}
