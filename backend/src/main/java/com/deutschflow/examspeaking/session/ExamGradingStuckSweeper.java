package com.deutschflow.examspeaking.session;

import lombok.RequiredArgsConstructor;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Entry point LỊCH cho lưới đỡ cuối chống phiên thi kẹt GRADING — logic thật (và lý do tách bean)
 * ở {@link ExamGradingStuckSweepService}. Method mang @SchedulerLock phải trả {@code void};
 * initialDelay > 0 để không chạy ngay lúc boot.
 */
@Component
@RequiredArgsConstructor
public class ExamGradingStuckSweeper {

    private final ExamGradingStuckSweepService sweepService;

    @Scheduled(
            fixedDelayString = "${app.examspeaking.stuck-sweep-delay-ms:300000}",
            initialDelayString = "${app.examspeaking.stuck-sweep-initial-delay-ms:60000}")
    @SchedulerLock(name = "examGradingStuckSweep", lockAtMostFor = "PT4M", lockAtLeastFor = "PT30S")
    public void sweepStuckGradingSessions() {
        sweepService.sweepStuckGradingSessions();
    }
}
