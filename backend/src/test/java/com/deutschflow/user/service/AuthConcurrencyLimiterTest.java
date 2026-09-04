package com.deutschflow.user.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class AuthConcurrencyLimiterTest {

    @Test
    @DisplayName("cấp đủ số permit rồi từ chối cái tiếp theo")
    void allowsUpToPermitsThenRefuses() throws Exception {
        var limiter = new AuthConcurrencyLimiter(2, 50, true);

        assertTrue(limiter.tryAcquire(), "permit #1");
        assertTrue(limiter.tryAcquire(), "permit #2 (== max)");
        assertFalse(limiter.tryAcquire(), "permit #3 bị từ chối sau khi hết timeout");
    }

    @Test
    @DisplayName("release trả permit về — chốt chặn không rò rỉ theo thời gian")
    void releaseReturnsPermit() throws Exception {
        var limiter = new AuthConcurrencyLimiter(1, 50, true);

        assertTrue(limiter.tryAcquire());
        assertFalse(limiter.tryAcquire(), "hết permit");

        limiter.release();
        assertTrue(limiter.tryAcquire(), "sau release lại lấy được");
    }

    /**
     * Chốt chặn này chỉ có giá trị nếu nó TỪ CHỐI NHANH. Nếu request thừa nằm chờ lâu thì chúng vẫn
     * giữ Tomcat thread — đúng thứ mà bulkhead sinh ra để ngăn. Timeout phải là trần cứng.
     */
    @Test
    @DisplayName("từ chối trong khoảng timeout, không treo thread vô hạn")
    void refusesWithinTimeoutBudget() throws Exception {
        var limiter = new AuthConcurrencyLimiter(1, 100, true);
        assertTrue(limiter.tryAcquire());

        long start = System.nanoTime();
        assertFalse(limiter.tryAcquire());
        long elapsedMs = (System.nanoTime() - start) / 1_000_000;

        assertTrue(elapsedMs < 1_000,
                "phải bỏ cuộc quanh mốc 100ms, thực tế " + elapsedMs + "ms");
    }

    @Test
    @DisplayName("tắt qua cấu hình thì luôn cho qua (đường thoát khi chặn nhầm)")
    void disabledAlwaysAllows() throws Exception {
        var limiter = new AuthConcurrencyLimiter(1, 50, false);

        assertTrue(limiter.tryAcquire());
        assertTrue(limiter.tryAcquire(), "đã tắt → không giới hạn");
        assertTrue(limiter.tryAcquire());
    }

    @Test
    @DisplayName("cấu hình vô lý được kẹp về mức an toàn (permit>=1, timeout>=0)")
    void clampsNonsenseConfig() throws Exception {
        var limiter = new AuthConcurrencyLimiter(0, -5, true);

        assertTrue(limiter.tryAcquire(), "permit=0 bị kẹp lên 1, không được chặn sạch");
        assertFalse(limiter.tryAcquire());
    }

    /**
     * Điểm cốt lõi: dưới tải đồng thời, số luồng CÙNG LÚC vào được vùng đắt tiền không bao giờ
     * vượt số permit. Đây chính là thứ giữ cho phần còn lại của app còn thread mà chạy khi
     * /api/auth/login bị dội — thứ mà rate-limit theo IP không làm được với tấn công phân tán.
     */
    @Test
    @DisplayName("dưới tải đồng thời, số luồng vào vùng đắt không vượt quá số permit")
    void concurrentPeakNeverExceedsPermits() throws Exception {
        int permits = 4;
        int threads = 40;
        var limiter = new AuthConcurrencyLimiter(permits, 2_000, true);

        var inFlight = new AtomicInteger();
        var peak = new AtomicInteger();
        var admitted = new AtomicInteger();
        var startGate = new CountDownLatch(1);
        var done = new CountDownLatch(threads);

        for (int i = 0; i < threads; i++) {
            new Thread(() -> {
                try {
                    startGate.await();
                    if (limiter.tryAcquire()) {
                        admitted.incrementAndGet();
                        try {
                            int now = inFlight.incrementAndGet();
                            peak.accumulateAndGet(now, Math::max);
                            Thread.sleep(20);   // đóng vai một lần BCrypt
                            inFlight.decrementAndGet();
                        } finally {
                            limiter.release();
                        }
                    }
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                } finally {
                    done.countDown();
                }
            }).start();
        }

        startGate.countDown();
        assertTrue(done.await(30, TimeUnit.SECONDS), "mọi luồng phải kết thúc");

        assertTrue(peak.get() <= permits,
                "đỉnh đồng thời " + peak.get() + " vượt quá " + permits + " permit");
        assertTrue(admitted.get() > 0, "phải có luồng vào được, không phải chặn sạch");
        assertEquals(permits, limiter.availablePermits(),
                "mọi permit phải được trả lại — rò rỉ permit sẽ khoá cứng auth vĩnh viễn");
    }
}
