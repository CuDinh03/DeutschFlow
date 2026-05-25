package com.deutschflow.common.async;

import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.concurrent.CustomizableThreadFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import java.io.IOException;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

@Service
@Slf4j
public class AsyncJobSseService {

    private final ConcurrentMap<UUID, SseEmitter> emitters = new ConcurrentHashMap<>();
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

    public SseEmitter register(UUID jobId) {
        // 5 minutes timeout for long running jobs like PPTX generation
        SseEmitter emitter = new SseEmitter(300_000L);
        emitters.put(jobId, emitter);

        emitter.onCompletion(() -> emitters.remove(jobId));
        emitter.onTimeout(() -> {
            log.warn("[SSE] Timeout for AsyncJob={}", jobId);
            emitters.remove(jobId);
        });
        emitter.onError(e -> {
            log.error("[SSE] Error for AsyncJob={}: {}", jobId, e.getMessage());
            emitters.remove(jobId);
        });

        log.debug("[SSE] Registered emitter for AsyncJob={}", jobId);
        
        // Send an initial event so client knows connection is established
        try {
            emitter.send(SseEmitter.event().name("connected").data("SSE Established for Job " + jobId));
        } catch (IOException e) {
            log.warn("[SSE] Could not send initial event for Job {}", jobId);
            emitters.remove(jobId);
        }

        return emitter;
    }

    public void completeJob(UUID jobId, String resultPayload) {
        SseEmitter emitter = emitters.remove(jobId);
        if (emitter == null) return;
        try {
            emitter.send(SseEmitter.event().name("COMPLETED").data(resultPayload != null ? resultPayload : ""));
            emitter.complete();
            log.info("[SSE] COMPLETED event pushed for AsyncJob={}", jobId);
        } catch (IOException e) {
            log.warn("[SSE] Failed to send COMPLETED event for AsyncJob={}: {}", jobId, e.getMessage());
            emitter.completeWithError(e);
        }
    }

    public void failJob(UUID jobId, String errorMessage) {
        SseEmitter emitter = emitters.remove(jobId);
        if (emitter == null) return;
        try {
            emitter.send(SseEmitter.event().name("FAILED").data(errorMessage != null ? errorMessage : "Unknown Error"));
            emitter.complete();
            log.info("[SSE] FAILED event pushed for AsyncJob={}", jobId);
        } catch (IOException e) {
            emitter.completeWithError(e);
        }
    }

    private void heartbeatAllSafe() {
        emitters.forEach((jobId, emitter) -> {
            try {
                emitter.send(SseEmitter.event().comment("hb"));
            } catch (IOException | IllegalStateException e) {
                emitters.remove(jobId);
            }
        });
    }
}
