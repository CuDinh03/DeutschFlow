package com.deutschflow.examspeaking.session;

import com.deutschflow.examspeaking.entity.SpeakingExamSession;
import com.deutschflow.examspeaking.repository.SpeakingExamSessionRepository;
import lombok.extern.slf4j.Slf4j;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * Lưới đỡ cuối cho phiên thi kẹt GRADING. Đường chính là {@code ExamGradingJobHandler.onFailure}
 * (worker flip ngay khi job fail); sweep này vớt phần đường chính không với tới:
 *
 * <ul>
 *   <li>worker crash TRƯỚC khi kịp saveFailed/onFailure (job sau đó bị StaleAiJobExpirer đánh
 *       FAILED theo lease PROCESSING);</li>
 *   <li>job PENDING quá hạn bị expirer đêm đánh FAILED — expirer generic không biết gì về phiên
 *       thi;</li>
 *   <li>dữ liệu kẹt từ TRƯỚC bản vá: GRADING + job FAILED (→ GRADING_FAILED), và di chứng của
 *       persist không-atomic: GRADING + job COMPLETED + result đã nằm trong bảng (→ đẩy nốt sang
 *       RESULTS, vì kết quả là thật).</li>
 * </ul>
 *
 * <p>CỐ Ý mỗi entry point là MỘT method mang đủ @Scheduled + @SchedulerLock + @Transactional, trả
 * {@code void}, không tự-gọi method cùng bean — xem chú thích chống bẫy proxy ở
 * {@code StaleAiJobExpirer#expireStalePendingJobs()}.
 */
@Component
@Slf4j
public class ExamGradingStuckSweeper {

    private final SpeakingExamSessionRepository sessionRepository;
    private final boolean enabled;
    private final int minAgeMinutes;

    public ExamGradingStuckSweeper(
            SpeakingExamSessionRepository sessionRepository,
            @Value("${app.examspeaking.stuck-sweep-enabled:true}") boolean enabled,
            @Value("${app.examspeaking.stuck-sweep-min-age-minutes:5}") int minAgeMinutes) {
        this.sessionRepository = sessionRepository;
        this.enabled = enabled;
        this.minAgeMinutes = Math.max(1, minAgeMinutes);
    }

    @Scheduled(
            fixedDelayString = "${app.examspeaking.stuck-sweep-delay-ms:300000}",
            // initialDelay > 0: xem chú thích cùng lý do ở StaleAiJobExpirer#expireStaleProcessingJobs.
            initialDelayString = "${app.examspeaking.stuck-sweep-initial-delay-ms:60000}")
    @SchedulerLock(name = "examGradingStuckSweep", lockAtMostFor = "PT4M", lockAtLeastFor = "PT30S")
    @Transactional
    public void sweepStuckGradingSessions() {
        if (!enabled) {
            return;
        }
        List<SpeakingExamSession> dead = sessionRepository.findStuckGradingWithDeadJob(minAgeMinutes);
        for (SpeakingExamSession s : dead) {
            s.setState(SpeakingExamSession.STATE_GRADING_FAILED);
        }
        if (!dead.isEmpty()) {
            sessionRepository.saveAll(dead);
            log.warn("[ExamGradingStuckSweeper] {} phiên GRADING có job chết → GRADING_FAILED: {}",
                    dead.size(), dead.stream().map(SpeakingExamSession::getId).toList());
        }
        List<SpeakingExamSession> doneButStuck = sessionRepository.findStuckGradingWithCompletedResult();
        for (SpeakingExamSession s : doneButStuck) {
            s.setState(SpeakingExamSession.STATE_RESULTS);
        }
        if (!doneButStuck.isEmpty()) {
            sessionRepository.saveAll(doneButStuck);
            log.warn("[ExamGradingStuckSweeper] {} phiên GRADING đã có kết quả đầy đủ → RESULTS: {}",
                    doneButStuck.size(), doneButStuck.stream().map(SpeakingExamSession::getId).toList());
        }
    }
}
