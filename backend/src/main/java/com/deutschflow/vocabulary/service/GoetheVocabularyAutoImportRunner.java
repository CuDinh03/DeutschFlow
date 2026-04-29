package com.deutschflow.vocabulary.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

@Component
@Order(10)
@RequiredArgsConstructor
@Slf4j
public class GoetheVocabularyAutoImportRunner implements ApplicationRunner {
    private final GoetheVocabularyAutoImportService importService;

    @Value("${app.vocabulary.goethe.auto-import-on-startup:true}")
    private boolean autoImportOnStartup;

    @Override
    public void run(ApplicationArguments args) {
        if (!autoImportOnStartup) {
            return;
        }
        log.info("Auto-import Goethe vocabulary on startup is enabled.");
        try {
            importService.importGoetheVocabularyA1ToC1();
            log.info("Goethe vocabulary auto-import completed.");
        } catch (Exception ex) {
            log.error("Goethe vocabulary auto-import failed.", ex);
        }
    }
}

