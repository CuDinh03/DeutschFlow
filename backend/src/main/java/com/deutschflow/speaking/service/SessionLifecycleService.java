package com.deutschflow.speaking.service;

import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.speaking.entity.AiSpeakingSession;
import com.deutschflow.speaking.entity.AiSpeakingSession.SessionStatus;
import com.deutschflow.speaking.repository.AiSpeakingSessionRepository;
import com.deutschflow.gamification.service.XpService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

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

    public SessionLifecycleService(
            TransactionTemplate transactionTemplate,
            AiSpeakingSessionRepository sessionRepository,
            XpService xpService,
            InterviewEvaluationService interviewEvaluationService,
            ConversationEvaluationService conversationEvaluationService,
            com.deutschflow.interview.service.InterviewDomainCoordinator interviewDomainCoordinator,
            com.deutschflow.teacher.service.TeacherAiGradingService teacherAiGradingService) {
        this.transactionTemplate = transactionTemplate;
        this.sessionRepository = sessionRepository;
        this.xpService = xpService;
        this.interviewEvaluationService = interviewEvaluationService;
        this.conversationEvaluationService = conversationEvaluationService;
        this.interviewDomainCoordinator = interviewDomainCoordinator;
        this.teacherAiGradingService = teacherAiGradingService;
    }

    /**
     * Public entry point: close the session, generate its report, persist completion side
     * effects, and trigger teacher auto-grading — returning the final persisted session.
     */
    public AiSpeakingSession closeSession(Long userId, Long sessionId) {
        AiSpeakingSession closedSession = Objects.requireNonNull(transactionTemplate.execute(
                status -> closeSpeakingSession(userId, sessionId)));

        String report = generateEndOfSessionReport(closedSession, userId, sessionId);
        AiSpeakingSession finalSession = persistCompletionSideEffects(userId, sessionId, report);
        triggerTeacherAutoGrading(sessionId);

        return finalSession;
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
