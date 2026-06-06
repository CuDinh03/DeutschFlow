package com.deutschflow.progress.service;

import com.deutschflow.gamification.repository.UserXpEventRepository;
import com.deutschflow.progress.entity.LearnerPhaseState;
import com.deutschflow.progress.entity.PhaseType;
import com.deutschflow.progress.repository.LearnerPhaseStateRepository;
import com.deutschflow.speaking.repository.AiSpeakingSessionRepository;
import com.deutschflow.srs.repository.VocabReviewRepository;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class PhaseEngineService {

    // Thresholds for phase transitions
    static final int FOUNDATION_VOCAB_THRESHOLD    = 50;
    static final int FOUNDATION_SESSIONS_THRESHOLD = 8;
    static final int PRODUCTION_VOCAB_THRESHOLD    = 250;
    static final int PRODUCTION_SESSIONS_THRESHOLD = 20;
    static final int FLUENCY_VOCAB_THRESHOLD       = 700;
    static final int FLUENCY_GRAMMAR_THRESHOLD     = 85;

    /**
     * Conservative per-session minutes estimate used to derive {@code speakingMinutesTotal}
     * from the ENDED-session count. Real per-session duration is not yet persisted; replace
     * this proxy with a summed duration once session start/end timestamps are tracked reliably.
     */
    static final int ESTIMATED_MINUTES_PER_SPEAKING_SESSION = 15;

    private final LearnerPhaseStateRepository phaseStateRepository;
    private final VocabReviewRepository vocabReviewRepository;
    private final UserXpEventRepository xpEventRepository;
    private final AiSpeakingSessionRepository speakingSessionRepository;
    private final UserRepository userRepository;

    @Transactional
    public LearnerPhaseState getOrCreatePhaseState(User user) {
        return phaseStateRepository.findByUserId(user.getId())
                .orElseGet(() -> createInitialPhaseState(user));
    }

    /**
     * Recompute phase progress from REAL learner signals (not caller-passed values) and advance
     * the phase if thresholds are met. This is the canonical progression entry point — call it
     * after any activity that changes progress (skill-tree node completion, speaking session end,
     * mock exam). Deriving the counts here closes the long-standing bug where the only caller
     * re-passed the existing (zero) values, so the learner could never leave FOUNDATION.
     */
    @Transactional
    public LearnerPhaseState recompute(Long userId) {
        return userRepository.findById(userId).map(this::recompute).orElse(null);
    }

    @Transactional
    public LearnerPhaseState recompute(User user) {
        Long uid = user.getId();
        int vocabMastered = (int) vocabReviewRepository.countMastered(uid);
        int sessionsCompleted = (int) (xpEventRepository.countSessionCompleteByUserId(uid)
                + xpEventRepository.countSatelliteCompleteByUserId(uid));
        int speakingMinutes = (int) (speakingSessionRepository.countEndedByUserId(uid)
                * ESTIMATED_MINUTES_PER_SPEAKING_SESSION);
        int grammarAccuracy = (int) Math.round(speakingSessionRepository.avgEndedScoreByUserId(uid));
        return updateProgress(user, vocabMastered, speakingMinutes, grammarAccuracy, sessionsCompleted);
    }

    @Transactional
    public LearnerPhaseState updateProgress(User user,
                                             int vocabMastered,
                                             int speakingMinutes,
                                             int grammarAccuracy,
                                             int sessionsCompleted) {
        LearnerPhaseState state = getOrCreatePhaseState(user);
        state.setVocabularyMasteredCount(vocabMastered);
        state.setSpeakingMinutesTotal(speakingMinutes);
        state.setGrammarAccuracyPercent(grammarAccuracy);
        state.setSessionsCompleted(sessionsCompleted);
        checkAndAdvancePhase(state);
        return phaseStateRepository.save(state);
    }

    @Transactional(readOnly = true)
    public boolean canAccessContent(LearnerPhaseState state, String contentPhase) {
        return switch (contentPhase.toUpperCase()) {
            case "FOUNDATION" -> true;
            case "PRODUCTION" -> state.getCurrentPhase() == PhaseType.PRODUCTION
                    || state.getCurrentPhase() == PhaseType.FLUENCY
                    || state.getCurrentPhase() == PhaseType.GRADUATED;
            case "FLUENCY" -> state.getCurrentPhase() == PhaseType.FLUENCY
                    || state.getCurrentPhase() == PhaseType.GRADUATED;
            default -> false;
        };
    }

    public List<String> getNextActions(LearnerPhaseState state) {
        return switch (state.getCurrentPhase()) {
            case FOUNDATION -> List.of("vocabulary_review", "beginner_speaking", "srs_review");
            case PRODUCTION -> List.of("vocabulary_review", "speaking_session", "grammar_practice", "srs_review");
            case FLUENCY    -> List.of("interview_practice", "mock_b1_exam", "speaking_session", "srs_review");
            case GRADUATED  -> List.of("speaking_session", "srs_review");
        };
    }

    public boolean isReadyToAdvance(LearnerPhaseState state) {
        return switch (state.getCurrentPhase()) {
            case FOUNDATION -> state.getVocabularyMasteredCount() >= FOUNDATION_VOCAB_THRESHOLD
                    && state.getSessionsCompleted() >= FOUNDATION_SESSIONS_THRESHOLD;
            case PRODUCTION -> state.getVocabularyMasteredCount() >= PRODUCTION_VOCAB_THRESHOLD
                    && state.getSessionsCompleted() >= PRODUCTION_SESSIONS_THRESHOLD;
            case FLUENCY    -> state.getVocabularyMasteredCount() >= FLUENCY_VOCAB_THRESHOLD
                    && state.getGrammarAccuracyPercent() >= FLUENCY_GRAMMAR_THRESHOLD;
            case GRADUATED  -> false;
        };
    }

    private void checkAndAdvancePhase(LearnerPhaseState state) {
        if (!isReadyToAdvance(state)) return;
        var now = LocalDateTime.now();
        switch (state.getCurrentPhase()) {
            case FOUNDATION -> {
                state.setFoundationCompletedAt(now);
                state.setCurrentPhase(PhaseType.PRODUCTION);
                state.setPhaseStartedAt(now);
                log.info("User {} advanced to PRODUCTION", state.getUser().getId());
            }
            case PRODUCTION -> {
                state.setProductionCompletedAt(now);
                state.setCurrentPhase(PhaseType.FLUENCY);
                state.setPhaseStartedAt(now);
                log.info("User {} advanced to FLUENCY", state.getUser().getId());
            }
            case FLUENCY -> {
                state.setFluencyCompletedAt(now);
                state.setCurrentPhase(PhaseType.GRADUATED);
                log.info("User {} GRADUATED", state.getUser().getId());
            }
            default -> { }
        }
    }

    private LearnerPhaseState createInitialPhaseState(User user) {
        var state = LearnerPhaseState.builder()
                .user(user)
                .currentPhase(PhaseType.FOUNDATION)
                .phaseStartedAt(LocalDateTime.now())
                .build();
        return phaseStateRepository.save(state);
    }
}
