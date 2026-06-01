package com.deutschflow.interview.service;

import com.deutschflow.interview.entity.InterviewTurn;
import com.deutschflow.interview.prompt.InterviewPromptBuilder;
import com.deutschflow.speaking.entity.AiSpeakingSession;
import com.deutschflow.speaking.interview.InterviewAnswerAnalysis;
import com.deutschflow.speaking.interview.InterviewSessionState;
import com.deutschflow.speaking.interview.InterviewTurnPlan;
import com.deutschflow.speaking.persona.SpeakingPersona;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * Single facade over all interview domain services.
 * Injected into {@link com.deutschflow.speaking.service.AiSpeakingServiceImpl} as one bean
 * to avoid adding multiple constructor parameters to the already large service.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class InterviewDomainCoordinator {

    private final InterviewExperimentService experimentService;
    private final InterviewTurnPersistenceService turnPersistenceService;
    private final InterviewPhaseEvaluationService phaseEvalService;
    private final InterviewReportService reportService;
    private final InterviewAnalyticsService analyticsService;
    private final InterviewPromptBuilder promptBuilder;
    private final PersonaRegistryService personaRegistryService;
    private final InterviewRubricService rubricService;

    /**
     * Called at interview session creation. Assigns experiments, tracks analytics,
     * and stores versioning metadata on the session entity.
     *
     * @return the prompt variant key for the session
     */
    public String onSessionCreated(AiSpeakingSession session) {
        try {
            String promptVariant = experimentService.assignAndRecord(session.getUserId(), session.getId());
            analyticsService.trackSessionStarted(session, promptVariant);

            // Store versioning metadata — fixes the versioning gap from the design critique
            personaRegistryService.findByCode(session.getPersona()).ifPresent(p -> {
                session.setInterviewPersonaVersion(p.getVersion());
            });
            rubricService.snapshotForIndustry(personaRegistryService.industryFor(session.getPersona()))
                    .ifPresent(s -> session.setInterviewRubricTemplateId(s.templateId()));
            session.setInterviewExperimentKey("interview_prompt_v1");
            session.setInterviewPromptVariant(promptVariant);

            return promptVariant;
        } catch (Exception e) {
            log.warn("[interview] onSessionCreated failed for session {}: {}", session.getId(), e.getMessage());
            return "control";
        }
    }

    /**
     * Called after each interview turn is saved. Persists turn data and emits analytics.
     */
    public void onTurnCompleted(Long sessionId, Long userId,
                                int turnIndex,
                                InterviewTurnPlan plan,
                                String userAnswer,
                                String aiFollowUp,
                                InterviewAnswerAnalysis analysis,
                                Integer latencyMs) {
        try {
            turnPersistenceService.saveTurn(sessionId, turnIndex, plan, userAnswer, aiFollowUp, analysis, latencyMs);
            analyticsService.trackTurnCompleted(sessionId, userId, turnIndex,
                    plan.phase().name(), plan.directive().name(), latencyMs);
        } catch (Exception e) {
            log.warn("[interview] onTurnCompleted failed for session {}/{}: {}", sessionId, turnIndex, e.getMessage());
        }
    }

    /**
     * Called when a phase transitions. Evaluates the phase using rule-based scoring.
     */
    public void onPhaseTransition(Long sessionId, String phase, String industry, String cefrLevel) {
        try {
            List<InterviewTurn> phaseTurns = turnPersistenceService.getTurnsForSession(sessionId).stream()
                    .filter(t -> phase.equals(t.getPhase()))
                    .toList();
            phaseEvalService.evaluatePhase(sessionId, phase, industry, cefrLevel, phaseTurns);
        } catch (Exception e) {
            log.warn("[interview] onPhaseTransition failed for session {}/{}: {}", sessionId, phase, e.getMessage());
        }
    }

    /**
     * Called when the interview session ends. Emits analytics and returns the structured report.
     */
    public void onSessionEnded(AiSpeakingSession session, String verdict, double overallScore) {
        try {
            List<InterviewTurn> turns = turnPersistenceService.getTurnsForSession(session.getId());
            String dropOffPhase = analyticsService.identifyDropOffPhase(turns);
            analyticsService.trackSessionEnded(session, verdict, overallScore, turns.size(), dropOffPhase);
        } catch (Exception e) {
            log.warn("[interview] onSessionEnded failed for session {}: {}", session.getId(), e.getMessage());
        }
    }

    /**
     * Builds the layered system prompt for an interview turn.
     */
    public String buildPrompt(SpeakingPersona persona,
                              String cefrLevel,
                              InterviewSessionState state,
                              InterviewTurnPlan plan,
                              String position,
                              String experienceLevel,
                              String industry,
                              String promptVariant) {
        return promptBuilder.build(persona, cefrLevel, state, plan, position, experienceLevel, industry, promptVariant);
    }

    public PersonaRegistryService personaRegistry() { return personaRegistryService; }
    public InterviewRubricService rubricService() { return rubricService; }
}
