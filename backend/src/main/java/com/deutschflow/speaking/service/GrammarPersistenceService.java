package com.deutschflow.speaking.service;

import com.deutschflow.speaking.ai.AiResponseDto;
import com.deutschflow.speaking.ai.ErrorItem;
import com.deutschflow.speaking.domain.GrammarErrorSeverity;
import com.deutschflow.speaking.domain.SpeakingPriority;
import com.deutschflow.speaking.entity.UserErrorObservation;
import com.deutschflow.speaking.entity.UserErrorSkill;
import com.deutschflow.speaking.entity.UserGrammarError;
import com.deutschflow.speaking.metrics.SpeakingMetrics;
import com.deutschflow.speaking.repository.UserErrorObservationRepository;
import com.deutschflow.speaking.repository.UserErrorSkillRepository;
import com.deutschflow.speaking.repository.UserGrammarErrorRepository;
import com.deutschflow.user.entity.UserLearningProfile;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.Optional;

@Service
@Slf4j
public class GrammarPersistenceService {

    private final UserGrammarErrorRepository grammarErrorRepository;
    private final UserErrorObservationRepository userErrorObservationRepository;
    private final UserErrorSkillRepository userErrorSkillRepository;
    private final ReviewSchedulerService reviewSchedulerService;
    private final SpeakingMetrics speakingMetrics;

    public GrammarPersistenceService(
            UserGrammarErrorRepository grammarErrorRepository,
            UserErrorObservationRepository userErrorObservationRepository,
            UserErrorSkillRepository userErrorSkillRepository,
            ReviewSchedulerService reviewSchedulerService,
            SpeakingMetrics speakingMetrics) {
        this.grammarErrorRepository = grammarErrorRepository;
        this.userErrorObservationRepository = userErrorObservationRepository;
        this.userErrorSkillRepository = userErrorSkillRepository;
        this.reviewSchedulerService = reviewSchedulerService;
        this.speakingMetrics = speakingMetrics;
    }

    public void persistGrammarFeedback(Long userId, Long sessionId, Long assistantMessageId,
                                        String userMessage, AiResponseDto parsed,
                                        UserLearningProfile profile) {
        if (!parsed.errors().isEmpty()) {
            for (ErrorItem err : parsed.errors()) {
                saveStructuredGrammarError(userId, sessionId, assistantMessageId, userMessage, err, profile);
            }
        } else if (parsed.correction() != null && parsed.grammarPoint() != null) {
            // Legacy fallback: only reached when the model emitted a correction but no structured error.
            // ChatCompletionService.applyInterviewPostProcessing nulls the correction whenever the
            // sanitized errors[] is empty, so a stale/hallucinated correction can no longer land here
            // and poison the weak-point ledger — this branch now persists only grounded corrections.
            saveLegacyGrammarError(userId, sessionId, assistantMessageId,
                    parsed.grammarPoint(), userMessage, parsed.correction(), profile);
        }
    }

    private void saveStructuredGrammarError(Long userId, Long sessionId, Long messageId,
                                            String userMessage, ErrorItem err,
                                            UserLearningProfile profile) {
        try {
            if (grammarErrorRepository.existsByMessageIdAndErrorCode(messageId, err.errorCode())) {
                return;
            }
            String cefrLevel = (profile != null && profile.getTargetLevel() != null)
                    ? profile.getTargetLevel().name() : null;
            String correctionText = err.correctedSpan() != null ? err.correctedSpan()
                    : err.exampleCorrectDe();
            String sev = GrammarErrorSeverity.normalizeToStored(
                    err.severity() != null ? err.severity() : GrammarErrorSeverity.MINOR.name());
            LocalDateTime now = LocalDateTime.now();
            grammarErrorRepository.save(UserGrammarError.builder()
                    .userId(userId)
                    .sessionId(sessionId)
                    .messageId(messageId)
                    .grammarPoint(err.errorCode())
                    .errorCode(err.errorCode())
                    .confidence(toStoredConfidence(err.confidence()))
                    .wrongSpan(err.wrongSpan())
                    .correctedSpan(err.correctedSpan())
                    .ruleViShort(err.ruleViShort())
                    .exampleCorrectDe(err.exampleCorrectDe())
                    .repairStatus("OPEN")
                    .originalText(userMessage)
                    .correctionText(correctionText)
                    .severity(sev)
                    .cefrLevel(cefrLevel)
                    .createdAt(now)
                    .build());

            userErrorObservationRepository.save(UserErrorObservation.builder()
                    .userId(userId)
                    .messageId(messageId)
                    .sessionId(sessionId)
                    .errorCode(err.errorCode())
                    .severity(sev)
                    .confidence(toStoredConfidence(err.confidence()))
                    .wrongSpan(err.wrongSpan())
                    .correctedSpan(err.correctedSpan())
                    .ruleViShort(err.ruleViShort())
                    .exampleCorrectDe(err.exampleCorrectDe())
                    .createdAt(now)
                    .build());

            upsertUserErrorSkill(userId, err.errorCode(), sev, now);
            reviewSchedulerService.onMajorObservation(userId, err.errorCode(), sev);
        } catch (Exception e) {
            // P1-8: a failed write here silently drops the learner's mistake — the SRS review signal
            // for this turn is lost. Make it observable (metric) and recoverable (full context + stack),
            // but do NOT rethrow: a live speaking turn must not 500 because a feedback persist failed.
            speakingMetrics.recordGrammarPersistFailure("structured");
            log.error("Grammar persist FAILED (SRS signal lost) userId={} sessionId={} messageId={} errorCode={} wrong='{}' corrected='{}'",
                    userId, sessionId, messageId, err.errorCode(), err.wrongSpan(), err.correctedSpan(), e);
        }
    }

    private void upsertUserErrorSkill(Long userId, String errorCode, String severity, LocalDateTime now) {
        if (errorCode == null || errorCode.isBlank()) {
            return;
        }
        String code = errorCode.trim();
        Optional<UserErrorSkill> opt = userErrorSkillRepository.findByUserIdAndErrorCode(userId, code);
        if (opt.isEmpty()) {
            // Brand new error
            userErrorSkillRepository.save(UserErrorSkill.builder()
                    .userId(userId)
                    .errorCode(code)
                    .totalCount(1)
                    .lastSeenAt(now)
                    .lastSeverity(severity)
                    .openCount(1)
                    .resolvedCount(0)
                    .priorityScore(BigDecimal.valueOf(SpeakingPriority.skillScore(1, now, severity)))
                    .build());
        } else {
            UserErrorSkill s = opt.get();
            boolean wasFullyResolved = s.getOpenCount() <= 0 && s.getResolvedCount() > 0;
            long daysSinceLastSeen = s.getLastSeenAt() != null
                    ? java.time.temporal.ChronoUnit.DAYS.between(s.getLastSeenAt().toLocalDate(), now.toLocalDate())
                    : 0;

            if (wasFullyResolved && daysSinceLastSeen >= 7) {
                // REGRESSION: error recurs after being resolved for ≥7 days
                // Do NOT increment totalCount — this is not a "new" error
                s.setLastSeenAt(now);
                s.setLastSeverity(severity);
                s.setOpenCount(1);
                s.setResolvedCount(Math.max(0, s.getResolvedCount() - 1));
                s.setPriorityScore(BigDecimal.valueOf(
                        SpeakingPriority.skillScore(s.getTotalCount(), now, severity)));
                userErrorSkillRepository.save(s);
                // Schedule a new review task for this regression
                reviewSchedulerService.onMajorObservation(userId, code, severity);
                log.info("[REGRESSION] User {} error {} reopened after {} days", userId, code, daysSinceLastSeen);
            } else {
                // Normal: error still open or recurs quickly — count as repeat
                int total = s.getTotalCount() + 1;
                s.setTotalCount(total);
                s.setLastSeenAt(now);
                s.setLastSeverity(severity);
                s.setOpenCount(s.getOpenCount() + 1);
                s.setPriorityScore(BigDecimal.valueOf(SpeakingPriority.skillScore(total, now, severity)));
                userErrorSkillRepository.save(s);
            }
        }
    }

    private void saveLegacyGrammarError(Long userId, Long sessionId, Long messageId,
                                        String grammarPoint, String originalText,
                                        String correctionText, UserLearningProfile profile) {
        try {
            String cefrLevel = (profile != null && profile.getTargetLevel() != null)
                    ? profile.getTargetLevel().name() : null;
            grammarErrorRepository.save(UserGrammarError.builder()
                    .userId(userId)
                    .sessionId(sessionId)
                    .messageId(messageId)
                    .grammarPoint(grammarPoint)
                    .originalText(originalText)
                    .correctionText(correctionText)
                    .severity(detectSeverity(correctionText))
                    .cefrLevel(cefrLevel)
                    .repairStatus("OPEN")
                    .createdAt(LocalDateTime.now())
                    .build());
        } catch (Exception e) {
            // P1-8: see saveStructuredGrammarError — observable + recoverable, never rethrow into a live turn.
            speakingMetrics.recordGrammarPersistFailure("legacy");
            log.error("Legacy grammar persist FAILED (SRS signal lost) userId={} sessionId={} messageId={} grammarPoint={}",
                    userId, sessionId, messageId, grammarPoint, e);
        }
    }

    private static BigDecimal toStoredConfidence(Double c) {
        if (c == null) return null;
        return BigDecimal.valueOf(c).setScale(3, RoundingMode.HALF_UP);
    }

    private String detectSeverity(String correction) {
        if (correction == null || correction.isBlank()) {
            return GrammarErrorSeverity.MINOR.name();
        }
        String lower = correction.toLowerCase();
        if (lower.contains("falsch") || lower.contains("incorrect") || lower.contains("never")) {
            return GrammarErrorSeverity.BLOCKING.name();
        }
        return GrammarErrorSeverity.MAJOR.name();
    }
}
