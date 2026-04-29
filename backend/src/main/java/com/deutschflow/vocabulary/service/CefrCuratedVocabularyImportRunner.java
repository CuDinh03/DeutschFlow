package com.deutschflow.vocabulary.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

/**
 * Nạp wordlist CEFR (~10k) từ classpath: {@code cefr_a1_patsy.txt}, {@code goethe_sorted.txt}, {@code de_50k.txt} (pad).
 * Chạy sau Goethe bulk và sau {@link GoetheOfficialWordlistImportRunner}.
 */
@Component
@Order(30)
@RequiredArgsConstructor
@Slf4j
public class CefrCuratedVocabularyImportRunner implements ApplicationRunner {

    private final OfficialCefrVocabularyImportService officialCefrVocabularyImportService;

    @Value("${app.vocabulary.cefr-curated.auto-import-on-startup:true}")
    private boolean autoImportOnStartup;

    /**
     * {@code false} (mặc định) = chỉ upsert lemma + CEFR + tag, không gọi enrich (DeepL) — tránh khởi động chậm/tốn quota.
     */
    @Value("${app.vocabulary.cefr-curated.auto-import-enrich:false}")
    private boolean autoImportEnrich;

    @Override
    public void run(ApplicationArguments args) {
        if (!autoImportOnStartup) {
            return;
        }
        log.info(
                "Auto-import CEFR curated vocabulary on startup is enabled (enrich={}).",
                autoImportEnrich
        );
        try {
            var result = officialCefrVocabularyImportService.importCuratedCefrVocabulary(autoImportEnrich);
            log.info(
                    "CEFR curated import completed: pickedTotal={}, inserted={}, updated={}, enrich={}",
                    result.get("pickedTotal"),
                    result.get("inserted"),
                    result.get("updated"),
                    result.get("enrichAfterUpsertApplied")
            );
        } catch (Exception ex) {
            log.error("CEFR curated vocabulary auto-import failed.", ex);
        }
    }
}
