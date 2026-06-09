package com.deutschflow.speaking.service;

import com.deutschflow.common.quota.AiUsageLedgerService;
import com.deutschflow.common.quota.RequestContext;
import com.deutschflow.gamification.service.XpService;
import com.deutschflow.speaking.ai.AiChatCompletionResult;
import com.deutschflow.speaking.ai.AiResponseDto;
import com.deutschflow.speaking.contract.SpeakingSessionMode;
import com.deutschflow.speaking.entity.AiSpeakingSession;
import com.deutschflow.speaking.entity.AiSpeakingSession.SessionStatus;
import com.deutschflow.speaking.interview.InterviewAnswerAnalysis;
import com.deutschflow.speaking.interview.InterviewDirectiveType;
import com.deutschflow.speaking.interview.InterviewPhase;
import com.deutschflow.speaking.interview.InterviewSessionState;
import com.deutschflow.speaking.interview.InterviewStateCodec;
import com.deutschflow.speaking.interview.PhaseProgressionPolicy;
import com.deutschflow.speaking.metrics.SpeakingMetrics;
import com.deutschflow.speaking.repository.AiSpeakingSessionRepository;
import com.deutschflow.training.service.TrainingDatasetService;
import com.deutschflow.user.entity.UserLearningProfile;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.Locale;

/**
 * Post-AI-turn side-effects orchestrator extracted from {@code AiSpeakingServiceImpl}.
 *
 * <p>Runs all the persistence / progression / gamification work that follows a saved
 * assistant turn: grammar feedback, learning progress, accuracy metrics, token-usage
 * ledger, turn evaluation, training-dataset capture, interview-state advancement and the
 * session row update.
 *
 * <p><strong>Transaction boundary stays on the facade.</strong> {@code applyTurnSideEffects}
 * is invoked from {@code finalizeSpeakingChatPersistence}, which already runs inside the
 * facade's {@code transactionTemplate.execute(...)}. This service therefore does NOT start
 * its own {@code TransactionTemplate} — it participates in the caller's transaction.
 */
@Service
@Slf4j
public class TurnSideEffectsService {

    private final AiSpeakingSessionRepository sessionRepository;
    private final SpeakingMetrics speakingMetrics;
    private final GrammarPersistenceService grammarPersistenceService;
    private final LearningProgressService learningProgressService;
    private final TurnEvaluatorService turnEvaluatorService;
    private final AiUsageLedgerService aiUsageLedgerService;
    private final TrainingDatasetService trainingDatasetService;
    private final XpService xpService;
    private final InterviewStateCodec interviewStateCodec;
    private final com.deutschflow.interview.service.InterviewDomainCoordinator interviewDomainCoordinator;

    public TurnSideEffectsService(
            AiSpeakingSessionRepository sessionRepository,
            SpeakingMetrics speakingMetrics,
            GrammarPersistenceService grammarPersistenceService,
            LearningProgressService learningProgressService,
            TurnEvaluatorService turnEvaluatorService,
            AiUsageLedgerService aiUsageLedgerService,
            TrainingDatasetService trainingDatasetService,
            XpService xpService,
            InterviewStateCodec interviewStateCodec,
            com.deutschflow.interview.service.InterviewDomainCoordinator interviewDomainCoordinator) {
        this.sessionRepository = sessionRepository;
        this.speakingMetrics = speakingMetrics;
        this.grammarPersistenceService = grammarPersistenceService;
        this.learningProgressService = learningProgressService;
        this.turnEvaluatorService = turnEvaluatorService;
        this.aiUsageLedgerService = aiUsageLedgerService;
        this.trainingDatasetService = trainingDatasetService;
        this.xpService = xpService;
        this.interviewStateCodec = interviewStateCodec;
        this.interviewDomainCoordinator = interviewDomainCoordinator;
    }

    public void applyTurnSideEffects(AiSpeakingServiceImpl.SpeakingChatPrep prep,
                                     String userMessage,
                                     AiResponseDto parsed,
                                     AiChatCompletionResult ai,
                                     Long assistantMessageId,
                                     UserLearningProfile effectiveProfile,
                                     UserLearningProfile profile,
                                     AiSpeakingSession session,
                                     String ledgerPurpose) {
        grammarPersistenceService.persistGrammarFeedback(prep.userId(), prep.sessionId(), assistantMessageId, userMessage, parsed, effectiveProfile);
        learningProgressService.updateUserLearningProgress(prep.userId(), parsed);
        recordAssistantTurnMetrics(parsed);

        try {
            if (ai.usage() != null) {
                aiUsageLedgerService.record(
                        prep.userId(),
                        ai.provider(),
                        ai.model(),
                        ai.usage().promptTokens(),
                        ai.usage().completionTokens(),
                        ai.usage().totalTokens(),
                        ledgerPurpose,
                        RequestContext.requestIdOrNull(),
                        prep.sessionId()
                );
            }
        } catch (Exception e) {
            log.warn("Skip token usage ledger due to error: {}", e.getMessage());
        }

        if (parsed.userInterestDetected() != null && !parsed.userInterestDetected().isBlank() && profile != null) {
            learningProgressService.mergeInterest(profile, parsed.userInterestDetected());
        }

        turnEvaluatorService.recordTurn(prep.userId(), prep.sessionId(), assistantMessageId, parsed, prep.policy());

        trainingDatasetService.recordConversationTurn(
                prep.userId(), prep.sessionId(), prep.cefrLevel(), prep.topic(),
                userMessage, parsed, prep.systemPrompt(), assistantMessageId, ai.provider()
        );

        session.setLastActivityAt(LocalDateTime.now());
        session.setMessageCount(prep.messageCountBaseline() + 2);

        if (prep.sessionMode() == SpeakingSessionMode.INTERVIEW && prep.interviewContext() != null) {
            InterviewSessionState state = prep.interviewContext().state();
            InterviewAnswerAnalysis analysis = prep.answerAnalysis() != null ? prep.answerAnalysis()
                    : new InterviewAnswerAnalysis(false, false, false, false, false, false, false);
            int prevPhaseNum = state.getPhase();
            InterviewPhase turnPhase = prep.interviewContext().plan().phase();
            state.applyAfterTurn(prep.interviewContext().plan(), analysis);

            // Content-aware progression: record whether this turn met its phase goal so the next
            // turn can advance early. Prefer the LLM's read; fall back to a deterministic heuristic.
            var interviewMeta = parsed != null ? parsed.interviewMeta() : null;
            var llmAnalysis = interviewMeta != null ? interviewMeta.analysis() : null;
            boolean phaseGoalMet = llmAnalysis != null
                    ? llmAnalysis.phaseGoalMet()
                    : PhaseProgressionPolicy.deterministicGoalMet(turnPhase, state);
            state.setLastPhaseGoalMet(phaseGoalMet);
            session.setInterviewStateJson(interviewStateCodec.encode(state));

            int turnIndex = prep.messageCountBaseline() / 2;
            String aiFollowUp = parsed != null ? parsed.aiSpeechDe() : null;
            int latencyMs = (int) Math.max(0L,
                    Duration.between(prep.turnStartedAt(), Instant.now()).toMillis());
            interviewDomainCoordinator.onTurnCompleted(
                    prep.sessionId(), prep.userId(), turnIndex,
                    prep.interviewContext().plan(), userMessage, aiFollowUp, analysis, latencyMs);

            // Phase transition fires on an actual phase change (was a buggy fromUserTurn recompute, §13.2).
            if (prevPhaseNum > 0 && prevPhaseNum != turnPhase.number()) {
                String industry = interviewDomainCoordinator.personaRegistry()
                        .industryFor(session.getPersona());
                interviewDomainCoordinator.onPhaseTransition(
                        prep.sessionId(), PhaseProgressionPolicy.fromNumber(prevPhaseNum).name(), industry, prep.cefrLevel());
            }
        }

        SpeakingSessionMode currentMode = SpeakingSessionMode.fromApi(session.getSessionMode());
        if (currentMode == SpeakingSessionMode.INTERVIEW
                && prep.interviewContext() != null
                && prep.interviewContext().plan().directiveType() == InterviewDirectiveType.CLOSING_FAREWELL) {
            log.info("Interview session {} ended via CLOSING_FAREWELL", prep.sessionId());
            session.setStatus(SessionStatus.ENDED);
            session.setEndedAt(LocalDateTime.now());
        }

        sessionRepository.save(session);

        try { xpService.awardSpeakingTurn(prep.userId(), prep.sessionId(), assistantMessageId); }
        catch (Exception xpEx) { log.debug("[XP] awardSpeakingTurn skipped: {}", xpEx.getMessage()); }
    }

    private void recordAssistantTurnMetrics(AiResponseDto parsed) {
        boolean noMajor = parsed.errors() == null || parsed.errors().stream().noneMatch(e -> {
            String s = e.severity() == null ? "" : e.severity().toUpperCase(Locale.ROOT);
            return s.contains("MAJOR") || s.contains("BLOCKING");
        });
        speakingMetrics.recordTurnAccuracy(noMajor);
        speakingMetrics.recordErrorsEmitted(parsed.errors());
    }
}
