package com.deutschflow.curriculum.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

/**
 * Seeds the learning-tree curriculum on startup (idempotent — only when {@code tree_topics} is empty),
 * so a fresh database renders a real tree without a manual admin call. Disable with
 * {@code app.curriculum.tree.seed-on-startup=false}.
 */
@Component
@Order(30)
@RequiredArgsConstructor
@Slf4j
public class TreeCurriculumSeederRunner implements ApplicationRunner {

    private final TreeCurriculumSeeder seeder;

    @Value("${app.curriculum.tree.seed-on-startup:true}")
    private boolean seedOnStartup;

    @Override
    public void run(ApplicationArguments args) {
        if (!seedOnStartup) {
            return;
        }
        try {
            int topics = seeder.seedIfEmpty();
            if (topics == 0) {
                log.debug("Tree curriculum already present — skipping seed.");
            }
        } catch (Exception ex) {
            log.error("Tree curriculum auto-seed failed.", ex);
        }
    }
}
