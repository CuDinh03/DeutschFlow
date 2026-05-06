package com.deutschflow.vocabulary.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.core.annotation.Order;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;

/**
 * Nạp từ vựng Goethe A1–C1 vào DB sau khi Spring Boot đã hoàn tất khởi động.
 *
 * Chạy bất đồng bộ (importExecutor) để không block HTTP thread pool.
 * Lỗi trong quá trình import được log dưới dạng WARNING — không crash app.
 */
@Component
@Order(10)
@RequiredArgsConstructor
@Slf4j
public class GoetheVocabularyAutoImportRunner {

    private final GoetheVocabularyAutoImportService importService;

    @Value("${app.vocabulary.goethe.auto-import-on-startup:true}")
    private boolean autoImportOnStartup;

    @Async("importExecutor")
    @EventListener(ApplicationReadyEvent.class)
    public void onApplicationReady() {
        if (!autoImportOnStartup) {
            return;
        }
        log.info("Auto-import Goethe vocabulary on startup is enabled. Running in background...");
        try {
            importService.importGoetheVocabularyA1ToC1();
            log.info("Goethe vocabulary auto-import completed.");
        } catch (Exception ex) {
            log.warn("Goethe vocabulary auto-import failed (non-fatal, will retry next startup): {}", ex.getMessage());
        }
    }
}
