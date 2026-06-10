package com.deutschflow.vocabulary.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Async;
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

    /**
     * Runs a one-time incremental import asynchronously after the application has fully started.
     * This catches any vocabulary added since the last cron run without blocking startup.
     */
    @Async("importExecutor")
    @EventListener(ApplicationReadyEvent.class)
    public void onApplicationReady() {
        runImport("startup");
    }

    @Scheduled(cron = "${app.vocabulary.glosbe.cron:0 0 3 * * *}")
    public void runScheduledImport() {
        runImport("scheduled");
    }

    private void runImport(String trigger) {
        if (!enabled) {
            return;
        }
        try {
            Map<String, Object> result = glosbeVocabularyImportService.importIncremental();
            log.info("Glosbe import ({}) completed: {}", trigger, result);
        } catch (Exception ex) {
            log.warn("Glosbe import ({}) failed: {}", trigger, ex.getMessage(), ex);
        }
    }
}
