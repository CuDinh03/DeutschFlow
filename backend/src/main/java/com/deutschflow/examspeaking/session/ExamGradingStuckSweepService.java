package com.deutschflow.examspeaking.session;

import com.deutschflow.examspeaking.entity.SpeakingExamSession;
import com.deutschflow.examspeaking.repository.SpeakingExamSessionRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * Logic vớt phiên thi kẹt GRADING — TÁCH khỏi entry point @Scheduled của
 * {@link ExamGradingStuckSweeper} (cùng lý do với {@code StaleAiJobMaintenance}: ShedLock trên
 * entry point + DB Testcontainers dùng chung giữa các Spring context làm test gọi tay bị skip
 * im lặng; test gọi thẳng bean này, wrapper gọi qua proxy nên @Transactional giữ hiệu lực).
 *
 * <p>Đường chính là {@code ExamGradingJobHandler.onFailure} (worker flip ngay khi job fail); sweep
 * này vớt phần đường chính không với tới:
 * <ul>
 *   <li>worker crash TRƯỚC khi kịp saveFailed/onFailure (job sau đó bị lease PROCESSING đánh
 *       FAILED);</li>
 *   <li>job PENDING quá hạn bị expirer đêm đánh FAILED — expirer generic không biết gì về phiên
 *       thi;</li>
 *   <li>dữ liệu kẹt từ TRƯỚC bản vá: GRADING + job FAILED (→ GRADING_FAILED), và di chứng của
 *       persist không-atomic: GRADING + job COMPLETED + result đã nằm trong bảng (→ đẩy nốt sang
 *       RESULTS, vì kết quả là thật).</li>
 * </ul>
 */
@Component
@Slf4j
public class ExamGradingStuckSweepService {

    private final SpeakingExamSessionRepository sessionRepository;
    private final boolean enabled;
    private final int minAgeMinutes;

    public ExamGradingStuckSweepService(
            SpeakingExamSessionRepository sessionRepository,
            @Value("${app.examspeaking.stuck-sweep-enabled:true}") boolean enabled,
            @Value("${app.examspeaking.stuck-sweep-min-age-minutes:5}") int minAgeMinutes) {
        this.sessionRepository = sessionRepository;
        this.enabled = enabled;
        this.minAgeMinutes = Math.max(1, minAgeMinutes);
    }

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
            log.warn("[ExamGradingStuckSweep] {} phiên GRADING có job chết → GRADING_FAILED: {}",
                    dead.size(), dead.stream().map(SpeakingExamSession::getId).toList());
        }
        List<SpeakingExamSession> doneButStuck = sessionRepository.findStuckGradingWithCompletedResult();
        for (SpeakingExamSession s : doneButStuck) {
            s.setState(SpeakingExamSession.STATE_RESULTS);
        }
        if (!doneButStuck.isEmpty()) {
            sessionRepository.saveAll(doneButStuck);
            log.warn("[ExamGradingStuckSweep] {} phiên GRADING đã có kết quả đầy đủ → RESULTS: {}",
                    doneButStuck.size(), doneButStuck.stream().map(SpeakingExamSession::getId).toList());
        }
    }
}
