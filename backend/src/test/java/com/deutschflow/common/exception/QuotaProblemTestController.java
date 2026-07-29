package com.deutschflow.common.exception;

import com.deutschflow.common.quota.QuotaExceededException;
import com.deutschflow.common.quota.QuotaSnapshot;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;

/**
 * Test-only controller (chỉ nằm trong test-classes, được component-scan nhặt khi chạy
 * {@code @SpringBootTest}) — cho {@link QuotaExceededHandlerIntegrationTest} bắn
 * {@code QuotaExceededException} thật xuyên qua {@code GlobalExceptionHandler}.
 * Endpoint {@code /api/test/quota-exceeded} từng được test tham chiếu nhưng CHƯA TỪNG tồn tại
 * (test chết 404 từ commit "backup file") — giờ có chỗ đứng tường minh, kèm 2 đường mã org
 * của thiết kế 2 kênh token (26/07).
 */
@RestController
class QuotaProblemTestController {

    @GetMapping("/api/test/quota-exceeded")
    String quotaExceeded() {
        Instant now = Instant.parse("2026-05-15T00:00:00Z");
        throw new QuotaExceededException("AI token quota exceeded.", new QuotaSnapshot(
                "FREE", false, now, now.plusSeconds(86_400),
                10_000L, 10_000L, 0L, 0L, 0L, now.minusSeconds(86_400), null));
    }

    @GetMapping("/api/test/org-budget-exhausted")
    String orgBudgetExhausted() {
        throw QuotaExceededException.orgBudgetExhausted(null);
    }

    @GetMapping("/api/test/org-budget-not-configured")
    String orgBudgetNotConfigured() {
        throw QuotaExceededException.orgBudgetNotConfigured(null);
    }
}
