package com.deutschflow.interview.service;

import com.deutschflow.interview.entity.InterviewTurn;
import com.deutschflow.speaking.entity.AiSpeakingSession;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * Emits interview analytics events for KPI tracking (section 11 of the spec).
 *
 * <p>Currently logs structured events. In production these would be forwarded to
 * PostHog (already wired in the frontend) or an analytics pipeline.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class InterviewAnalyticsService {

    public void trackSessionStarted(AiSpeakingSession session, String promptVariant) {
        log.info("[interview.analytics] session_started sessionId={} userId={} persona={} position='{}' experienceLevel={} promptVariant={}",
                session.getId(),
                session.getUserId(),
                session.getPersona(),
                session.getInterviewPosition(),
                session.getExperienceLevel(),
                promptVariant);
    }

    public void trackTurnCompleted(Long sessionId, Long userId, int turnIndex, String phase,
                                    String directiveType, Integer latencyMs) {
        log.info("[interview.analytics] turn_completed sessionId={} userId={} turnIndex={} phase={} directive={} latencyMs={}",
                sessionId, userId, turnIndex, phase, directiveType, latencyMs);
    }

    public void trackSessionEnded(AiSpeakingSession session, String verdict, double overallScore,
                                   int totalTurns, String dropOffPhase) {
        log.info("[interview.analytics] session_ended sessionId={} userId={} verdict={} score={} turns={} dropOff={}",
                session.getId(), session.getUserId(), verdict, overallScore, totalTurns, dropOffPhase);
    }

    public void trackSessionAbandoned(Long sessionId, Long userId, String lastPhase, int turnCount) {
        log.info("[interview.analytics] session_abandoned sessionId={} userId={} lastPhase={} turns={}",
                sessionId, userId, lastPhase, turnCount);
    }

    /** Identifies the phase where the user stopped responding or the session dropped. */
    public String identifyDropOffPhase(List<InterviewTurn> turns) {
        if (turns.isEmpty()) return "NONE";
        return turns.stream()
                .filter(t -> t.getUserAnswer() == null || t.getUserAnswer().isBlank())
                .findFirst()
                .map(InterviewTurn::getPhase)
                .orElse(turns.get(turns.size() - 1).getPhase());
    }
}
