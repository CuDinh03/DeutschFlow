package com.deutschflow.feedback.jobs;

import com.deutschflow.feedback.service.FeedbackOrphanCleanupService;
import lombok.extern.slf4j.Slf4j;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Instant;

/**
 * Vỏ lịch chạy của {@link FeedbackOrphanCleanupService}: 05:15 giờ Việt Nam, sau các job dọn đêm khác
 * (03:30, 04:00, 04:30, 05:00). {@code zone} bắt buộc vì container chạy giờ UTC; {@code @SchedulerLock}
 * đòi phương thức trả {@code void}.
 */
@Slf4j
@Component
public class FeedbackOrphanCleanupJob {

    private final FeedbackOrphanCleanupService service;
    private final boolean enabled;

    public FeedbackOrphanCleanupJob(
            FeedbackOrphanCleanupService service,
            @Value("${app.feedback.orphan-cleanup.enabled:true}") boolean enabled) {
        this.service = service;
        this.enabled = enabled;
    }

    @Scheduled(cron = "${app.feedback.orphan-cleanup.cron:0 15 5 * * *}", zone = "Asia/Ho_Chi_Minh")
    @SchedulerLock(name = "feedbackOrphanCleanup", lockAtMostFor = "PT30M", lockAtLeastFor = "PT1M")
    public void purgeUnattachedScreenshots() {
        if (!enabled) {
            return;
        }
        try {
            service.purgeOnce(Instant.now());
        } catch (RuntimeException e) {
            log.warn("[FeedbackOrphanCleanupJob] lượt dọn thất bại: {}", e.getMessage(), e);
        }
    }
}
