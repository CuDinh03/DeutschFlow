package com.deutschflow.teacher.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import java.time.Instant;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

/**
 * In-memory store cho PPTX bytes.
 *
 * Vòng đời:
 *   1. Backend tạo xong PPTX → lưu vào store (put)
 *   2. Frontend gọi GET /download/{jobId} → lấy bytes (getAndRemove) → xóa ngay
 *   3. Nếu sau TTL_MINUTES phút không ai download → auto-expire (cleanup scheduler)
 *
 * Không lưu vào DB → tiết kiệm storage, không để lại dữ liệu nhạy cảm.
 */
@Component
@Slf4j
public class PptxStore {

    /** Thời gian giữ file trong memory nếu không được download (phút). */
    private static final int TTL_MINUTES = 10;

    private record Entry(byte[] bytes, String fileName, Instant expiresAt) {}

    private final ConcurrentHashMap<UUID, Entry> store = new ConcurrentHashMap<>();
    private ScheduledExecutorService cleaner;

    @PostConstruct
    void startCleaner() {
        cleaner = Executors.newSingleThreadScheduledExecutor(r -> {
            Thread t = new Thread(r, "pptx-store-cleaner");
            t.setDaemon(true);
            return t;
        });
        // Chạy cleanup mỗi 2 phút
        cleaner.scheduleAtFixedRate(this::evictExpired, 2, 2, TimeUnit.MINUTES);
        log.info("[PptxStore] Started — TTL={}min, cleanup every 2min", TTL_MINUTES);
    }

    @PreDestroy
    void stopCleaner() {
        if (cleaner != null) cleaner.shutdownNow();
    }

    /** Lưu PPTX bytes vào store. Ghi đè nếu jobId đã tồn tại. */
    public void put(UUID jobId, byte[] bytes, String fileName) {
        Instant expiresAt = Instant.now().plusSeconds(TTL_MINUTES * 60L);
        store.put(jobId, new Entry(bytes, fileName, expiresAt));
        log.debug("[PptxStore] Stored {} bytes for job {} (expires {})", bytes.length, jobId, expiresAt);
    }

    /** Lấy bytes và XÓA ngay khỏi store (one-time download). */
    public record PptxFile(byte[] bytes, String fileName) {}

    public PptxFile getAndRemove(UUID jobId) {
        Entry entry = store.remove(jobId);
        if (entry == null) return null;
        log.debug("[PptxStore] Served and removed {} bytes for job {}", entry.bytes().length, jobId);
        return new PptxFile(entry.bytes(), entry.fileName());
    }

    /** Kiểm tra job có sẵn để download không. */
    public boolean contains(UUID jobId) {
        return store.containsKey(jobId);
    }

    private void evictExpired() {
        Instant now = Instant.now();
        store.entrySet().removeIf(e -> {
            boolean expired = e.getValue().expiresAt().isBefore(now);
            if (expired) log.info("[PptxStore] Evicted expired entry for job {}", e.getKey());
            return expired;
        });
    }
}
