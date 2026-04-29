package com.deutschflow.vocabulary.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

/**
 * Nạp {@code wordlists/goethe_official_wordlist.tsv} (sinh từ PDF) khi khởi động — tránh phải gọi API admin thủ công.
 */
@Component
@Order(20)
@RequiredArgsConstructor
@Slf4j
public class GoetheOfficialWordlistImportRunner implements ApplicationRunner {

    private final GoetheOfficialWordlistImportService goetheOfficialWordlistImportService;

    @Value("${app.vocabulary.goethe.official-wordlist.auto-import-on-startup:true}")
    private boolean autoImportOnStartup;

    @Override
    public void run(ApplicationArguments args) {
        if (!autoImportOnStartup) {
            return;
        }
        log.info("Auto-import Goethe official PDF wordlist (TSV) on startup is enabled.");
        try {
            var result = goetheOfficialWordlistImportService.importFromClasspathTsv();
            log.info(
                    "Goethe official wordlist import completed: insertedWords={}, examplesApplied={}, skippedRows={}",
                    result.get("insertedWords"),
                    result.get("examplesApplied"),
                    result.get("skippedRows")
            );
        } catch (Exception ex) {
            log.error("Goethe official wordlist auto-import failed.", ex);
        }
    }
}
