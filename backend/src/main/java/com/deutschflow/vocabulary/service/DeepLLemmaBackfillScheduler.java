package com.deutschflow.vocabulary.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.Map;

/**
 * Chạy liên tục {@link DeepLLemmaBackfillService} để làm đầy EN/VI cho từ thiếu nghĩa (quota DeepL).
 * Wiktionary + Glosbe VI vẫn chạy song song; luồng này tăng tốc khi có {@code app.deepl.api-key}.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class DeepLLemmaBackfillScheduler {

    private final DeepLLemmaBackfillService deepLLemmaBackfillService;
    private final DeepLTranslationService deepLTranslationService;
    private final EnrichmentSuspendGate enrichmentSuspendGate;

    @Value("${app.vocabulary.deepl-lemma-backfill.enabled:true}")
    private boolean enabled;

    @Scheduled(fixedDelayString = "${app.vocabulary.deepl-lemma-backfill.delay-ms:8000}")
    public void tick() {
        if (!enabled || !deepLTranslationService.isConfigured() || enrichmentSuspendGate.isEnrichmentSuspended()) {
            return;
        }
        try {
            Map<String, Object> result = deepLLemmaBackfillService.runBatch(null, false);
            String status = String.valueOf(result.getOrDefault("status", ""));
            if ("IDLE".equals(status)) {
                log.info("DeepL lemma backfill: cursor exhausted, resetting.");
                deepLLemmaBackfillService.resetCursor();
                return;
            }
            if ("CAP".equals(status)) {
                log.warn("DeepL lemma backfill: monthly DeepL FREE char budget exhausted (deeplMonthlyCapReached={}), skipping until next UTC month.",
                        Boolean.TRUE.equals(result.get("deeplMonthlyCapReached")));
                return;
            }
            log.info("DeepL lemma backfill: en={} vi={} chars≈{} lastId={}",
                    result.get("enUpserts"), result.get("viUpserts"),
                    result.get("charsUsedEstimate"), result.get("lastProcessedWordId"));
        } catch (Exception e) {
            log.warn("DeepL lemma backfill scheduler error: {}", e.getMessage());
        }
    }
}
