package com.deutschflow.speaking.service;

import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.gamification.entity.UserXpEvent.XpEventType;
import com.deutschflow.gamification.repository.UserXpEventRepository;
import com.deutschflow.progress.service.PhaseEngineService;
import com.deutschflow.speaking.entity.AiSpeakingSession;
import com.deutschflow.speaking.entity.AiSpeakingSession.SessionStatus;
import com.deutschflow.speaking.repository.AiSpeakingSessionRepository;
import com.deutschflow.gamification.service.XpService;
import com.deutschflow.user.service.LearningAnalyticsService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Objects;

/**
 * End-of-session lifecycle cluster extracted from {@code AiSpeakingServiceImpl}.
 *
 * <p>Owns closing the session row, generating the end-of-session report, persisting the
 * completion side effects (report JSON + XP award), and triggering teacher auto-grading.
 * The public entry point {@link #closeSession(Long, Long)} runs these steps in the same
 * order and with the same transaction boundaries as the original facade.
 */
@Service
@Slf4j
public class SessionLifecycleService {

    private final TransactionTemplate transactionTemplate;
    private final AiSpeakingSessionRepository sessionRepository;
    private final XpService xpService;
    private final InterviewEvaluationService interviewEvaluationService;
    private final ConversationEvaluationService conversationEvaluationService;
    private final com.deutschflow.interview.service.InterviewDomainCoordinator interviewDomainCoordinator;
    private final com.deutschflow.teacher.service.TeacherAiGradingService teacherAiGradingService;
    private final PhaseEngineService phaseEngineService;
    private final LearningAnalyticsService learningAnalyticsService;
    private final UserXpEventRepository xpEventRepository;

    // Fallback per-session minutes when a session lacks reliable timestamps — mirrors PhaseEngine.
    private static final int FALLBACK_MINUTES_PER_SESSION = 15;

    public SessionLifecycleService(
            TransactionTemplate transactionTemplate,
            AiSpeakingSessionRepository sessionRepository,
            XpService xpService,
            InterviewEvaluationService interviewEvaluationService,
            ConversationEvaluationService conversationEvaluationService,
            com.deutschflow.interview.service.InterviewDomainCoordinator interviewDomainCoordinator,
            com.deutschflow.teacher.service.TeacherAiGradingService teacherAiGradingService,
            PhaseEngineService phaseEngineService,
            LearningAnalyticsService learningAnalyticsService,
            UserXpEventRepository xpEventRepository) {
        this.transactionTemplate = transactionTemplate;
        this.sessionRepository = sessionRepository;
        this.xpService = xpService;
        this.interviewEvaluationService = interviewEvaluationService;
        this.conversationEvaluationService = conversationEvaluationService;
        this.interviewDomainCoordinator = interviewDomainCoordinator;
        this.teacherAiGradingService = teacherAiGradingService;
        this.phaseEngineService = phaseEngineService;
        this.learningAnalyticsService = learningAnalyticsService;
        this.xpEventRepository = xpEventRepository;
    }

    /**
     * Public entry point: close the session, generate its report, persist completion side
     * effects, and trigger teacher auto-grading — returning the final persisted session.
     */
    public AiSpeakingSession closeSession(Long userId, Long sessionId) {
        // R-M7 idempotency: a session can be ended more than once — the client retries "Kết thúc"
        // after a lost end-response, or ends manually after the CLOSING_FAREWELL auto-close. If it is
        // ALREADY ended AND a report was already produced, short-circuit: re-running would call the
        // end-of-session evaluation LLM again (re-debiting quota) and re-award XP/teacher-grading for
        // the same session. The report-present check matters because the auto-close sets ENDED at
        // chat time WITHOUT a report — that first real end still needs to generate one, and a first
        // end whose generation FAILED (report == null) is still allowed to retry.
        AiSpeakingSession existing = Objects.requireNonNull(transactionTemplate.execute(
                status -> loadSessionForUser(userId, sessionId)));
        // Đợt A (10/08): report EVAL_FAILED là trạng thái RETRYABLE — lần end kế được chấm lại.
        // Report thật và INSUFFICIENT_DATA vẫn short-circuit như cũ (phiên đã ENDED thì dữ liệu
        // không đổi, INSUFFICIENT chấm lại cũng chỉ tốn quota cho cùng kết quả).
        if (existing.getStatus() == SessionStatus.ENDED && existing.getInterviewReportJson() != null
                && !com.deutschflow.speaking.interview.InterviewReportValidator
                        .isRetryableFailure(existing.getInterviewReportJson())) {
            return existing;
        }

        AiSpeakingSession closedSession = Objects.requireNonNull(transactionTemplate.execute(
                status -> closeSpeakingSession(userId, sessionId)));

        // Authoritative "this session just completed for the first time" signal — the same one XP uses
        // for idempotency. Capture it BEFORE persistCompletionSideEffects awards SESSION_COMPLETE so a
        // client retry / auto-close-then-manual-end does not double-count progress metrics.
        boolean firstCompletion = sessionId == null
                || !xpEventRepository.existsByUserIdAndEventTypeAndRefSessionId(
                        userId, XpEventType.SESSION_COMPLETE, sessionId);

        String report = generateEndOfSessionReport(closedSession, userId, sessionId);
        AiSpeakingSession finalSession = persistCompletionSideEffects(userId, sessionId, report);
        triggerTeacherAutoGrading(sessionId);

        if (firstCompletion) {
            recordProgressMetrics(userId, finalSession);
        }

        return finalSession;
    }

    /**
     * Feed the two progress ledgers that the speaking flow previously never updated (QA F-3):
     * <ul>
     *   <li>{@link PhaseEngineService#recompute} — pull-based, idempotent; drives the dashboard
     *       "Giai đoạn học" block, the first-session CTA gate, and B1 readiness.</li>
     *   <li>{@link LearningAnalyticsService#recordDailyStats} — increments today's row that powers
     *       the Thống kê page (speaking minutes + sessions completed).</li>
     * </ul>
     * Best-effort: a failure here must never fail the learner's session close (XP + report already
     * persisted). Only called on the first completion of a session so the increment cannot double-count.
     */
    private void recordProgressMetrics(Long userId, AiSpeakingSession session) {
        try {
            phaseEngineService.recompute(userId);
        } catch (Exception e) {
            log.warn("[Progress] phase recompute skipped for user {}: {}", userId, e.getMessage());
        }
        try {
            int minutes = estimateSessionMinutes(session);
            double accuracy = session.getAiScore() != null ? session.getAiScore() : 0.0;
            learningAnalyticsService.recordDailyStats(userId, 0, 0, minutes, 1, accuracy, 0.0);
        } catch (Exception e) {
            log.warn("[Progress] analytics record skipped for user {}: {}", userId, e.getMessage());
        }
    }

    /** Real elapsed minutes when both timestamps exist (min 1), else the conservative fallback. */
    private int estimateSessionMinutes(AiSpeakingSession session) {
        if (session.getStartedAt() != null && session.getEndedAt() != null) {
            long minutes = Duration.between(session.getStartedAt(), session.getEndedAt()).toMinutes();
            return (int) Math.max(1, Math.min(minutes, 180));
        }
        return FALLBACK_MINUTES_PER_SESSION;
    }

    private AiSpeakingSession closeSpeakingSession(Long userId, Long sessionId) {
        AiSpeakingSession s = loadSessionForUser(userId, sessionId);
        if (s.getStatus() == SessionStatus.ENDED) {
            // Session was already ended (e.g. by CLOSING_FAREWELL auto-close).
            // Return as-is so report generation and XP award still run.
            return s;
        }
        s.setStatus(SessionStatus.ENDED);
        s.setEndedAt(LocalDateTime.now());
        return sessionRepository.save(s);
    }

    private String generateEndOfSessionReport(AiSpeakingSession closedSession, Long userId, Long sessionId) {
        try {
            if ("INTERVIEW".equals(closedSession.getSessionMode())) {
                String report = interviewEvaluationService.generateReport(closedSession, userId);
                interviewDomainCoordinator.onSessionEnded(closedSession, "COMPLETED", 0.0);
                return report;
            }
            // COMMUNICATION / LESSON: encouraging conversational evaluation summary.
            return conversationEvaluationService.generateReport(closedSession, userId);
        } catch (Exception e) {
            log.warn("Failed to generate end-of-session report for session {}: {}", sessionId, e.getMessage());
            return null;
        }
    }

    private AiSpeakingSession persistCompletionSideEffects(Long userId, Long sessionId, String report) {
        return Objects.requireNonNull(transactionTemplate.execute(status -> {
            AiSpeakingSession s = sessionRepository.findById(sessionId)
                    .orElseThrow(() -> new NotFoundException("Session not found: " + sessionId));
            if (report != null) {
                s.setInterviewReportJson(report);
                s = sessionRepository.save(s);
            }
            try { xpService.awardSessionComplete(userId, sessionId); }
            catch (Exception xpEx) { log.debug("[XP] awardSessionComplete skipped: {}", xpEx.getMessage()); }
            return s;
        }));
    }

    private void triggerTeacherAutoGrading(Long sessionId) {
        try {
            teacherAiGradingService.autoGradeSession(sessionId);
        } catch (Exception e) {
            log.warn("Failed to auto-grade session {}: {}", sessionId, e.getMessage());
        }
    }

    private AiSpeakingSession loadSessionForUser(Long userId, Long sessionId) {
        AiSpeakingSession session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new NotFoundException("Session not found: " + sessionId));
        if (!session.getUserId().equals(userId)) {
            throw new NotFoundException("Session not found: " + sessionId);
        }
        return session;
    }
}
