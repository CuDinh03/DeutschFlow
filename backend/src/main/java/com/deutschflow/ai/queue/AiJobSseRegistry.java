package com.deutschflow.ai.queue;

import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

/**
 * Registry lưu trữ SseEmitter theo jobId.
 * Khi Worker xử lý xong job, nó tìm emitter theo jobId và push kết quả về browser.
 */
@Service
@Slf4j
public class AiJobSseRegistry {

    private final ConcurrentMap<Long, SseEmitter> emitters = new ConcurrentHashMap<>();

    /**
     * Tạo SseEmitter cho jobId và đăng ký vào registry.
     * Timeout 120s — đủ cho Whisper + LLM chain.
     */
    public SseEmitter register(Long jobId) {
        SseEmitter emitter = new SseEmitter(120_000L);
        emitters.put(jobId, emitter);

        // Tự dọn khi kết nối đóng
        emitter.onCompletion(() -> emitters.remove(jobId));
        emitter.onTimeout(() -> {
            log.warn("[SSE] Timeout for jobId={}", jobId);
            emitters.remove(jobId);
        });
        emitter.onError(e -> {
            log.error("[SSE] Error for jobId={}: {}", jobId, e.getMessage());
            emitters.remove(jobId);
        });

        log.debug("[SSE] Registered emitter for jobId={}", jobId);
        return emitter;
    }

    /**
     * Push kết quả hoàn thành về browser và đóng SSE stream.
     */
    public void complete(Long jobId, Object result) {
        SseEmitter emitter = emitters.remove(jobId);
        if (emitter == null) {
            log.warn("[SSE] No emitter found for jobId={} (client may have disconnected)", jobId);
            return;
        }
        try {
            emitter.send(SseEmitter.event().name("result").data(result));
            emitter.complete();
            log.info("[SSE] Result pushed for jobId={}", jobId);
        } catch (IOException e) {
            log.warn("[SSE] Failed to send result for jobId={}: {}", jobId, e.getMessage());
            emitter.completeWithError(e);
        }
    }

    /**
     * Push lỗi về browser.
     */
    public void error(Long jobId, String errorMessage) {
        SseEmitter emitter = emitters.remove(jobId);
        if (emitter == null) return;
        try {
            emitter.send(SseEmitter.event().name("error").data(errorMessage));
            emitter.complete();
        } catch (IOException e) {
            emitter.completeWithError(e);
        }
    }

    public int activeCount() {
        return emitters.size();
    }
}
