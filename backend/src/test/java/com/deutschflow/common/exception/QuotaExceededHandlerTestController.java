package com.deutschflow.common.exception;

import com.deutschflow.common.quota.QuotaExceededException;
import com.deutschflow.common.quota.QuotaSnapshot;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;

@RestController
class QuotaExceededHandlerTestController {

    @GetMapping("/api/test/quota-exceeded")
    public String quotaExceeded() {
        QuotaSnapshot snap = new QuotaSnapshot(
                "FREE",
                false,
                Instant.parse("2026-05-01T17:00:00Z"),
                Instant.parse("2026-05-02T17:00:00Z"),
                50000L,
                50000L,
                0L,
                0L,
                0L,
                Instant.parse("2026-01-01T00:00:00Z"),
                Instant.parse("2026-12-31T23:59:59Z")
        );
        throw new QuotaExceededException("Monthly AI token quota exceeded.", snap);
    }
}

