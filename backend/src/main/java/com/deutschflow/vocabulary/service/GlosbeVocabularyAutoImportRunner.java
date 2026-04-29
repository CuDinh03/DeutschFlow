package com.deutschflow.vocabulary.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.Map;

@Component
@RequiredArgsConstructor
@Slf4j
public class GlosbeVocabularyAutoImportRunner {

    private final GlosbeVocabularyImportService glosbeVocabularyImportService;

    @Value("${app.vocabulary.glosbe.enabled:false}")
    private boolean enabled;

    @Scheduled(cron = "${app.vocabulary.glosbe.cron:0 0 3 * * *}")
    public void runScheduledImport() {
        if (!enabled) {
            return;
        }
        try {
            Map<String, Object> result = glosbeVocabularyImportService.importIncremental();
            log.info("Scheduled Glosbe import completed: {}", result);
        } catch (Exception ex) {
            log.warn("Scheduled Glosbe import failed: {}", ex.getMessage(), ex);
        }
    }
}
