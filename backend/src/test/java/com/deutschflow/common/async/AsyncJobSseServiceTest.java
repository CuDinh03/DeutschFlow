package com.deutschflow.common.async;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotSame;

/**
 * GAP-11 (phần fan-out): một job có thể có nhiều emitter; đăng ký sau không được thay đăng ký trước.
 * Không cần Spring context — emitter chưa initialize sẽ đệm các lần send.
 */
class AsyncJobSseServiceTest {

    @Test
    @DisplayName("đăng ký hai lần cùng job giữ CẢ HAI emitter — lần sau không đá lần trước")
    void registerTwice_keepsBothEmitters() {
        var svc = new AsyncJobSseService();
        UUID job = UUID.randomUUID();

        SseEmitter first = svc.register(job);
        SseEmitter second = svc.register(job);

        assertNotSame(first, second);
        assertEquals(2, svc.activeEmitterCount(job));
    }

    @Test
    @DisplayName("completeJob phát cho mọi emitter của job rồi gỡ hết; job khác không bị đụng")
    void completeJob_broadcastsToAllAndClears() {
        var svc = new AsyncJobSseService();
        UUID job = UUID.randomUUID();
        UUID other = UUID.randomUUID();
        svc.register(job);
        svc.register(job);
        svc.register(other);

        svc.completeJob(job, "{\"ok\":true}");

        assertEquals(0, svc.activeEmitterCount(job));
        assertEquals(1, svc.activeEmitterCount(other));
    }

    @Test
    @DisplayName("failJob gỡ hết emitter của job; job không ai theo dõi là no-op")
    void failJob_clearsOrNoop() {
        var svc = new AsyncJobSseService();
        UUID job = UUID.randomUUID();
        svc.register(job);

        svc.failJob(job, "boom");
        assertEquals(0, svc.activeEmitterCount(job));
        assertDoesNotThrow(() -> svc.failJob(UUID.randomUUID(), "nobody listens"));
    }
}
