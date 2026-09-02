package com.deutschflow.teacher.jobs;

import com.deutschflow.teacher.service.ClassScheduleService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Keeps every recurring class schedule's 12-week session window rolling forward (audit §7.5).
 *
 * <p>A "vô thời hạn" pattern (no end date) only generated sessions when it was created/edited. With no
 * job to extend it, a class that had been running fine for ~3 months suddenly had no more sessions and
 * disappeared from the weekly grid — while the pattern still existed and nobody was told. This runs once
 * a day and re-fills the window. {@code rollForwardActivePatterns} is idempotent and preserves
 * hand-edited (overridden) sessions, so re-running is harmless.
 *
 * <p>ShedLock guards against duplicate runs across instances.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class ClassScheduleRollForwardJob {

    private final ClassScheduleService classScheduleService;

    // 02:15 giờ VN (đêm thật). Container prod chạy UTC nên PHẢI ghim zone — comment cũ tưởng
    // "server TZ" là giờ VN, thực tế job chạy 09:15 sáng VN suốt thời gian qua.
    @Scheduled(cron = "0 15 2 * * *", zone = "Asia/Ho_Chi_Minh")
    @SchedulerLock(name = "classScheduleRollForward", lockAtMostFor = "PT30M", lockAtLeastFor = "PT0S")
    public void rollForward() {
        try {
            int created = classScheduleService.rollForwardActivePatterns();
            if (created > 0) {
                log.info("[schedule-roll] extended recurring schedules — {} session(s) created", created);
            }
        } catch (Exception e) {
            log.error("[schedule-roll] roll-forward run failed", e);
        }
    }
}
