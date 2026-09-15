package com.deutschflow.common.async;

import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.concurrent.CustomizableThreadFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import java.io.IOException;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

/**
 * Phát COMPLETED/FAILED của job nền tới các client SSE đang theo dõi.
 *
 * <p>Một job có thể có NHIỀU emitter cùng lúc (chủ job mở hai tab, hoặc mobile reconnect trước khi
 * emitter cũ timeout). Trước đây map {@code jobId → emitter} đơn khiến lần đăng ký sau THAY emitter
 * trước: client cũ mất luồng mà không biết, và ai đoán được UUID cũng chiếm được luồng của chủ job
 * (GAP-11). Quyền đăng ký được kiểm ở controller TRƯỚC khi gọi {@link #register}; lớp này chỉ fan-out.
 */
@Service
@Slf4j
public class AsyncJobSseService {

    /** 5 phút cho job dài (PPTX, chấm thi thử). */
    private static final long EMITTER_TIMEOUT_MS = 300_000L;

    private final ConcurrentMap<UUID, List<SseEmitter>> emitters = new ConcurrentHashMap<>();
    private ScheduledExecutorService pingScheduler;

    @PostConstruct
    void startPingScheduler() {
        pingScheduler = Executors.newSingleThreadScheduledExecutor(
                new CustomizableThreadFactory("async-job-sse-ping-"));
        // Ping every 20s to keep connection alive
        pingScheduler.scheduleAtFixedRate(this::heartbeatAllSafe, 20, 20, TimeUnit.SECONDS);
    }

    @PreDestroy
    void stopPingScheduler() {
        if (pingScheduler != null) {
            pingScheduler.shutdownNow();
        }
    }

    /** Đăng ký thêm một emitter cho job; KHÔNG thay emitter đang có của cùng job. */
    public SseEmitter register(UUID jobId) {
        SseEmitter emitter = new SseEmitter(EMITTER_TIMEOUT_MS);
        emitters.computeIfAbsent(jobId, k -> new CopyOnWriteArrayList<>()).add(emitter);

        emitter.onCompletion(() -> detach(jobId, emitter));
        emitter.onTimeout(() -> {
            log.warn("[SSE] Timeout for AsyncJob={}", jobId);
            detach(jobId, emitter);
        });
        emitter.onError(e -> {
            log.error("[SSE] Error for AsyncJob={}: {}", jobId, e.getMessage());
            detach(jobId, emitter);
        });

        log.debug("[SSE] Registered emitter for AsyncJob={} (active={})", jobId, activeEmitterCount(jobId));

        // Send an initial event so client knows connection is established
        try {
            emitter.send(SseEmitter.event().name("connected").data("SSE Established for Job " + jobId));
        } catch (IOException e) {
            log.warn("[SSE] Could not send initial event for Job {}", jobId);
            detach(jobId, emitter);
        }

        return emitter;
    }

    public void completeJob(UUID jobId, String resultPayload) {
        broadcastAndClose(jobId, "COMPLETED", resultPayload != null ? resultPayload : "");
    }

    public void failJob(UUID jobId, String errorMessage) {
        broadcastAndClose(jobId, "FAILED", errorMessage != null ? errorMessage : "Unknown Error");
    }

    /** Số emitter đang theo dõi một job — cho test và log. */
    int activeEmitterCount(UUID jobId) {
        List<SseEmitter> list = emitters.get(jobId);
        return list == null ? 0 : list.size();
    }

    private void broadcastAndClose(UUID jobId, String eventName, String data) {
        List<SseEmitter> list = emitters.remove(jobId);
        if (list == null || list.isEmpty()) {
            return;
        }
        int delivered = 0;
        for (SseEmitter emitter : list) {
            try {
                emitter.send(SseEmitter.event().name(eventName).data(data));
                emitter.complete();
                delivered++;
            } catch (IOException | IllegalStateException e) {
                log.warn("[SSE] Failed to send {} event for AsyncJob={}: {}", eventName, jobId, e.getMessage());
                emitter.completeWithError(e);
            }
        }
        log.info("[SSE] {} event pushed for AsyncJob={} to {}/{} emitter(s)", eventName, jobId, delivered, list.size());
    }

    private void detach(UUID jobId, SseEmitter emitter) {
        emitters.computeIfPresent(jobId, (k, list) -> {
            list.remove(emitter);
            return list.isEmpty() ? null : list;
        });
    }

    private void heartbeatAllSafe() {
        emitters.forEach((jobId, list) -> {
            for (SseEmitter emitter : list) {
                try {
                    emitter.send(SseEmitter.event().comment("hb"));
                } catch (IOException | IllegalStateException e) {
                    detach(jobId, emitter);
                }
            }
        });
    }
}
