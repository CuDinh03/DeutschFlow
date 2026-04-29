package com.deutschflow.vocabulary.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.Map;

/**
 * Tự động chạy Wiktionary enrich batch theo lịch.
 * Mặc định: mỗi 5 phút, 50 từ/lần → ~600 từ/giờ → ~9,800 từ trong ~16 giờ.
 * Dừng tự động khi không còn từ cần enrich (status=IDLE).
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class WiktionaryEnrichmentScheduler {

    private final WiktionaryEnrichmentBatchService wiktionaryEnrichmentBatchService;

    @Value("${app.vocabulary.wiktionary-scheduler.enabled:true}")
    private boolean enabled;

    @Value("${app.vocabulary.wiktionary-scheduler.batch-size:50}")
    private int batchSize;

    // Chạy mỗi 5 phút (rate limit 1 req/s × 50 từ = ~50s/batch, nghỉ 4 phút)
    @Scheduled(fixedDelayString = "${app.vocabulary.wiktionary-scheduler.delay-ms:5000}")
    public void runEnrichBatch() {
        if (!enabled) return;

        try {
            Map<String, Object> result = wiktionaryEnrichmentBatchService.runBatch(batchSize, false);
            String status = String.valueOf(result.getOrDefault("status", "UNKNOWN"));

            if ("IDLE".equals(status)) {
                // Cursor đã hết — reset để chạy lại từ đầu (nhiều từ vẫn chưa có data)
                log.info("Wiktionary enrich: cursor exhausted, resetting to re-enrich missing words.");
                wiktionaryEnrichmentBatchService.resetCursor();
                return;
            }

            log.info("Wiktionary enrich batch: processed={} ipa={} en={} failed={} lastId={}",
                    result.get("processedRows"), result.get("ipaFilled"),
                    result.get("enUpserts"), result.get("failed"),
                    result.get("lastProcessedWordId"));
        } catch (Exception e) {
            log.warn("Wiktionary enrich scheduler error: {}", e.getMessage());
        }
    }

    private int toInt(Object v) {
        if (v instanceof Number n) return n.intValue();
        return 0;
    }
}
