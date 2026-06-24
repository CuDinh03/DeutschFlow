package com.deutschflow.vocabulary.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class VocabularyQualityDailyJob {

    private final WordQueryService wordQueryService;

    @Scheduled(cron = "${app.quality.daily-cron:0 15 2 * * *}")
    @SchedulerLock(name = "vocabularyQualityDaily", lockAtMostFor = "PT30M", lockAtLeastFor = "PT1M")
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
