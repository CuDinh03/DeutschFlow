package com.deutschflow.vocabulary.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class VocabularyQualityDailyJob {

    private final WordQueryService wordQueryService;

    @Scheduled(cron = "${app.quality.daily-cron:0 15 2 * * *}")
    public void runDailySnapshot() {
        var nounCoverage = wordQueryService.coverage();
        var translationCoverage = wordQueryService.translationCoverage();
        log.info(
                "quality-daily snapshot completed: nounCoverage={}%, translationAllLocales={}%",
                nounCoverage.nounCoveragePercent(),
                translationCoverage.allLocalesCoveragePercent()
        );
    }
}
