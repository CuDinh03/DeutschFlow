package com.deutschflow.speaking.service;

import com.deutschflow.speaking.ai.AiResponseDto;
import com.deutschflow.speaking.ai.ErrorItem;
import com.deutschflow.speaking.entity.UserErrorObservation;
import com.deutschflow.speaking.entity.UserErrorSkill;
import com.deutschflow.speaking.entity.UserGrammarError;
import com.deutschflow.speaking.metrics.SpeakingMetrics;
import com.deutschflow.speaking.repository.UserErrorObservationRepository;
import com.deutschflow.speaking.repository.UserErrorSkillRepository;
import com.deutschflow.speaking.repository.UserGrammarErrorRepository;
import com.deutschflow.user.entity.UserLearningProfile;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * Real-behavior unit tests for {@link GrammarPersistenceService}, extracted from the
 * {@code AiSpeakingServiceImpl} god-class. Verifies structured/legacy persistence paths,
 * dedup, the {@code upsertUserErrorSkill} branches (new / repeat / regression) and — most
 * importantly — the P1-8 guarantee that a failed persist is observable (metric) but never
 * rethrown into a live speaking turn.
 */
@ExtendWith(MockitoExtension.class)
class GrammarPersistenceServiceUnitTest {

    @Mock UserGrammarErrorRepository grammarErrorRepository;
    @Mock UserErrorObservationRepository userErrorObservationRepository;
    @Mock UserErrorSkillRepository userErrorSkillRepository;
    @Mock ReviewSchedulerService reviewSchedulerService;
    @Mock SpeakingMetrics speakingMetrics;

    @InjectMocks
    GrammarPersistenceService service;

    private static final long USER_ID = 7L;
    private static final long SESSION_ID = 42L;
    private static final long MESSAGE_ID = 100L;
    private static final String ERROR_CODE = "WORD_ORDER.V2_MAIN_CLAUSE";

    private static ErrorItem structuredError() {
        return new ErrorItem(
                ERROR_CODE,
                "MAJOR",
                0.9,
                "ich gestern ging",
                "ich ging gestern",
                "V2: das Verb steht an zweiter Stelle",
                "Gestern ging ich nach Hause.");
    }

    private static AiResponseDto withErrors(List<ErrorItem> errors) {
        return new AiResponseDto(
                "Sehr gut.", null, null, null, null, null,
                errors, "ON_TOPIC_NEEDS_IMPROVEMENT", null, null, null, null, null);
    }

    private static AiResponseDto legacy(String correction, String grammarPoint) {
        return new AiResponseDto(
                "Sehr gut.", correction, null, grammarPoint, null, null,
                List.of(), "ON_TOPIC_NEEDS_IMPROVEMENT", null, null, null, null, null);
    }

    private static UserLearningProfile profileWithLevel(UserLearningProfile.TargetLevel level) {
        return UserLearningProfile.builder().targetLevel(level).build();
    }

    // ---------------------------------------------------------------------
    // Structured path — happy path persistence
    // ---------------------------------------------------------------------

    @Test
    @DisplayName("persistGrammarFeedback with structured errors saves grammar error + observation, upserts skill, schedules review")
    void persistGrammarFeedback_structuredError_savesAllAndSchedulesReview() {
        // Arrange
        when(grammarErrorRepository.existsByMessageIdAndErrorCode(MESSAGE_ID, ERROR_CODE)).thenReturn(false);
        when(userErrorSkillRepository.findByUserIdAndErrorCode(USER_ID, ERROR_CODE)).thenReturn(Optional.empty());

        // Act
        service.persistGrammarFeedback(USER_ID, SESSION_ID, MESSAGE_ID, "ich gestern ging",
                withErrors(List.of(structuredError())), profileWithLevel(UserLearningProfile.TargetLevel.B1));

        // Assert
        ArgumentCaptor<UserGrammarError> grammarCaptor = ArgumentCaptor.forClass(UserGrammarError.class);
        verify(grammarErrorRepository).save(grammarCaptor.capture());
        UserGrammarError saved = grammarCaptor.getValue();
        assertThat(saved.getUserId()).isEqualTo(USER_ID);
        assertThat(saved.getMessageId()).isEqualTo(MESSAGE_ID);
        assertThat(saved.getErrorCode()).isEqualTo(ERROR_CODE);
        assertThat(saved.getCorrectedSpan()).isEqualTo("ich ging gestern");
        assertThat(saved.getRepairStatus()).isEqualTo("OPEN");
        assertThat(saved.getSeverity()).isEqualTo("MAJOR");
        assertThat(saved.getCefrLevel()).isEqualTo("B1");

        verify(userErrorObservationRepository).save(any(UserErrorObservation.class));
        verify(userErrorSkillRepository).save(any(UserErrorSkill.class));
        verify(reviewSchedulerService).onMajorObservation(USER_ID, ERROR_CODE, "MAJOR");
        verify(speakingMetrics, never()).recordGrammarPersistFailure(anyString());
    }

    @Test
    @DisplayName("structured error uses exampleCorrectDe as correctionText when correctedSpan is null")
    void persistGrammarFeedback_nullCorrectedSpan_fallsBackToExample() {
        // Arrange
        ErrorItem err = new ErrorItem(ERROR_CODE, "MINOR", 0.5, "wrong", null, "rule", "Beispiel korrekt.");
        when(grammarErrorRepository.existsByMessageIdAndErrorCode(MESSAGE_ID, ERROR_CODE)).thenReturn(false);
        when(userErrorSkillRepository.findByUserIdAndErrorCode(USER_ID, ERROR_CODE)).thenReturn(Optional.empty());

        // Act
        service.persistGrammarFeedback(USER_ID, SESSION_ID, MESSAGE_ID, "x", withErrors(List.of(err)), null);

        // Assert
        ArgumentCaptor<UserGrammarError> captor = ArgumentCaptor.forClass(UserGrammarError.class);
        verify(grammarErrorRepository).save(captor.capture());
        assertThat(captor.getValue().getCorrectionText()).isEqualTo("Beispiel korrekt.");
        assertThat(captor.getValue().getCefrLevel()).isNull(); // null profile → no CEFR
    }

    // ---------------------------------------------------------------------
    // Dedup
    // ---------------------------------------------------------------------

    @Test
    @DisplayName("dedup: when error already exists for the message, nothing is saved or scheduled")
    void persistGrammarFeedback_duplicateError_skipsSave() {
        // Arrange
        when(grammarErrorRepository.existsByMessageIdAndErrorCode(MESSAGE_ID, ERROR_CODE)).thenReturn(true);

        // Act
        service.persistGrammarFeedback(USER_ID, SESSION_ID, MESSAGE_ID, "x",
                withErrors(List.of(structuredError())), null);

        // Assert
        verify(grammarErrorRepository, never()).save(any());
        verifyNoInteractions(userErrorObservationRepository);
        verifyNoInteractions(userErrorSkillRepository);
        verifyNoInteractions(reviewSchedulerService);
        verify(speakingMetrics, never()).recordGrammarPersistFailure(anyString());
    }

    // ---------------------------------------------------------------------
    // Legacy path
    // ---------------------------------------------------------------------

    @Test
    @DisplayName("legacy path: empty errors but correction + grammarPoint present saves a legacy grammar error")
    void persistGrammarFeedback_legacyCorrection_savesLegacyError() {
        // Act
        service.persistGrammarFeedback(USER_ID, SESSION_ID, MESSAGE_ID, "originaltext",
                legacy("Das ist falsch.", "Artikel"), profileWithLevel(UserLearningProfile.TargetLevel.A2));

        // Assert
        ArgumentCaptor<UserGrammarError> captor = ArgumentCaptor.forClass(UserGrammarError.class);
        verify(grammarErrorRepository).save(captor.capture());
        UserGrammarError saved = captor.getValue();
        assertThat(saved.getGrammarPoint()).isEqualTo("Artikel");
        assertThat(saved.getOriginalText()).isEqualTo("originaltext");
        assertThat(saved.getCorrectionText()).isEqualTo("Das ist falsch.");
        assertThat(saved.getRepairStatus()).isEqualTo("OPEN");
        assertThat(saved.getCefrLevel()).isEqualTo("A2");
        // "falsch" → BLOCKING per detectSeverity
        assertThat(saved.getSeverity()).isEqualTo("BLOCKING");

        // Legacy path does not touch the skill aggregate or schedule reviews
        verifyNoInteractions(userErrorObservationRepository);
        verifyNoInteractions(userErrorSkillRepository);
        verifyNoInteractions(reviewSchedulerService);
    }

    @Test
    @DisplayName("no errors and no legacy correction persists nothing")
    void persistGrammarFeedback_noErrorsNoCorrection_persistsNothing() {
        // Act
        service.persistGrammarFeedback(USER_ID, SESSION_ID, MESSAGE_ID, "x",
                withErrors(List.of()), null);

        // Assert
        verifyNoInteractions(grammarErrorRepository);
        verifyNoInteractions(userErrorObservationRepository);
        verifyNoInteractions(userErrorSkillRepository);
        verifyNoInteractions(reviewSchedulerService);
    }

    // ---------------------------------------------------------------------
    // upsertUserErrorSkill branches
    // ---------------------------------------------------------------------

    @Test
    @DisplayName("upsert: brand-new error saves a skill with totalCount=1 and openCount=1")
    void upsert_brandNewError_savesWithCountOne() {
        // Arrange
        when(grammarErrorRepository.existsByMessageIdAndErrorCode(MESSAGE_ID, ERROR_CODE)).thenReturn(false);
        when(userErrorSkillRepository.findByUserIdAndErrorCode(USER_ID, ERROR_CODE)).thenReturn(Optional.empty());

        // Act
        service.persistGrammarFeedback(USER_ID, SESSION_ID, MESSAGE_ID, "x",
                withErrors(List.of(structuredError())), null);

        // Assert
        ArgumentCaptor<UserErrorSkill> captor = ArgumentCaptor.forClass(UserErrorSkill.class);
        verify(userErrorSkillRepository).save(captor.capture());
        UserErrorSkill skill = captor.getValue();
        assertThat(skill.getErrorCode()).isEqualTo(ERROR_CODE);
        assertThat(skill.getTotalCount()).isEqualTo(1);
        assertThat(skill.getOpenCount()).isEqualTo(1);
        assertThat(skill.getResolvedCount()).isEqualTo(0);
        assertThat(skill.getLastSeverity()).isEqualTo("MAJOR");
    }

    @Test
    @DisplayName("upsert: normal repeat increments totalCount and openCount")
    void upsert_normalRepeat_incrementsCounts() {
        // Arrange — existing skill still open, seen recently (no regression)
        UserErrorSkill existing = UserErrorSkill.builder()
                .userId(USER_ID)
                .errorCode(ERROR_CODE)
                .totalCount(3)
                .openCount(2)
                .resolvedCount(1)
                .lastSeenAt(LocalDateTime.now().minusDays(1))
                .lastSeverity("MINOR")
                .build();
        when(grammarErrorRepository.existsByMessageIdAndErrorCode(MESSAGE_ID, ERROR_CODE)).thenReturn(false);
        when(userErrorSkillRepository.findByUserIdAndErrorCode(USER_ID, ERROR_CODE))
                .thenReturn(Optional.of(existing));

        // Act
        service.persistGrammarFeedback(USER_ID, SESSION_ID, MESSAGE_ID, "x",
                withErrors(List.of(structuredError())), null);

        // Assert — mutated in place then saved
        verify(userErrorSkillRepository).save(existing);
        assertThat(existing.getTotalCount()).isEqualTo(4);
        assertThat(existing.getOpenCount()).isEqualTo(3);
        assertThat(existing.getLastSeverity()).isEqualTo("MAJOR");
        // A normal repeat schedules exactly once (only the unconditional call in saveStructuredGrammarError);
        // the regression branch's extra scheduling does NOT fire here. Contrast with the regression test.
        verify(reviewSchedulerService, times(1)).onMajorObservation(USER_ID, ERROR_CODE, "MAJOR");
    }

    @Test
    @DisplayName("upsert REGRESSION: fully-resolved error recurring after >=7 days reopens WITHOUT incrementing totalCount and schedules a fresh review")
    void upsert_regression_reopensWithoutIncrementAndReschedules() {
        // Arrange — fully resolved (openCount<=0, resolvedCount>0), last seen 10 days ago
        UserErrorSkill resolved = UserErrorSkill.builder()
                .userId(USER_ID)
                .errorCode(ERROR_CODE)
                .totalCount(5)
                .openCount(0)
                .resolvedCount(2)
                .lastSeenAt(LocalDateTime.now().minusDays(10))
                .lastSeverity("MINOR")
                .build();
        when(grammarErrorRepository.existsByMessageIdAndErrorCode(MESSAGE_ID, ERROR_CODE)).thenReturn(false);
        when(userErrorSkillRepository.findByUserIdAndErrorCode(USER_ID, ERROR_CODE))
                .thenReturn(Optional.of(resolved));

        // Act
        service.persistGrammarFeedback(USER_ID, SESSION_ID, MESSAGE_ID, "x",
                withErrors(List.of(structuredError())), null);

        // Assert — totalCount unchanged, reopened, resolvedCount decremented
        verify(userErrorSkillRepository).save(resolved);
        assertThat(resolved.getTotalCount()).isEqualTo(5); // NOT incremented
        assertThat(resolved.getOpenCount()).isEqualTo(1);
        assertThat(resolved.getResolvedCount()).isEqualTo(1);
        assertThat(resolved.getLastSeverity()).isEqualTo("MAJOR");
        // A regression schedules an EXTRA review task: onMajorObservation fires twice for this turn —
        // once unconditionally in saveStructuredGrammarError, once more inside the regression branch.
        // That second scheduling is the defining behavior of a regression vs a normal repeat.
        verify(reviewSchedulerService, times(2)).onMajorObservation(USER_ID, ERROR_CODE, "MAJOR");
    }

    @Test
    @DisplayName("upsert: resolved error recurring within 7 days is a normal repeat, not a regression")
    void upsert_resolvedButRecent_isNormalRepeat() {
        // Arrange — fully resolved but seen only 3 days ago → below the 7-day regression threshold
        UserErrorSkill resolved = UserErrorSkill.builder()
                .userId(USER_ID)
                .errorCode(ERROR_CODE)
                .totalCount(5)
                .openCount(0)
                .resolvedCount(2)
                .lastSeenAt(LocalDateTime.now().minusDays(3))
                .lastSeverity("MINOR")
                .build();
        when(grammarErrorRepository.existsByMessageIdAndErrorCode(MESSAGE_ID, ERROR_CODE)).thenReturn(false);
        when(userErrorSkillRepository.findByUserIdAndErrorCode(USER_ID, ERROR_CODE))
                .thenReturn(Optional.of(resolved));

        // Act
        service.persistGrammarFeedback(USER_ID, SESSION_ID, MESSAGE_ID, "x",
                withErrors(List.of(structuredError())), null);

        // Assert — counted as a repeat: totalCount incremented, resolvedCount untouched
        verify(userErrorSkillRepository).save(resolved);
        assertThat(resolved.getTotalCount()).isEqualTo(6);
        assertThat(resolved.getOpenCount()).isEqualTo(1);
        assertThat(resolved.getResolvedCount()).isEqualTo(2);
    }

    // ---------------------------------------------------------------------
    // P1-8 FAILURE handling — the most important guarantee
    // ---------------------------------------------------------------------

    @Test
    @DisplayName("P1-8: structured-path save failure does NOT rethrow and records a 'structured' persist-failure metric")
    void persistGrammarFeedback_structuredSaveThrows_swallowsAndRecordsMetric() {
        // Arrange — the very first save blows up
        when(grammarErrorRepository.existsByMessageIdAndErrorCode(MESSAGE_ID, ERROR_CODE)).thenReturn(false);
        when(grammarErrorRepository.save(any(UserGrammarError.class)))
                .thenThrow(new RuntimeException("DB down"));

        // Act + Assert — no exception escapes into the live turn
        assertThatCode(() -> service.persistGrammarFeedback(USER_ID, SESSION_ID, MESSAGE_ID, "x",
                withErrors(List.of(structuredError())), null))
                .doesNotThrowAnyException();

        // Metric records the lost SRS signal, classified as "structured"
        verify(speakingMetrics).recordGrammarPersistFailure("structured");
        // Downstream side effects never reached
        verify(reviewSchedulerService, never()).onMajorObservation(anyLong(), anyString(), anyString());
    }

    @Test
    @DisplayName("P1-8: failure in upsertUserErrorSkill (after saves succeed) is still swallowed and recorded")
    void persistGrammarFeedback_skillUpsertThrows_swallowsAndRecordsMetric() {
        // Arrange — grammar + observation save OK, but the skill lookup throws inside the try block
        when(grammarErrorRepository.existsByMessageIdAndErrorCode(MESSAGE_ID, ERROR_CODE)).thenReturn(false);
        when(userErrorSkillRepository.findByUserIdAndErrorCode(USER_ID, ERROR_CODE))
                .thenThrow(new RuntimeException("skill table locked"));

        // Act + Assert
        assertThatCode(() -> service.persistGrammarFeedback(USER_ID, SESSION_ID, MESSAGE_ID, "x",
                withErrors(List.of(structuredError())), null))
                .doesNotThrowAnyException();

        verify(speakingMetrics).recordGrammarPersistFailure("structured");
        verify(grammarErrorRepository).save(any(UserGrammarError.class));
        verify(userErrorObservationRepository).save(any(UserErrorObservation.class));
    }

    @Test
    @DisplayName("P1-8: legacy-path save failure does NOT rethrow and records a 'legacy' persist-failure metric")
    void persistGrammarFeedback_legacySaveThrows_swallowsAndRecordsLegacyMetric() {
        // Arrange
        when(grammarErrorRepository.save(any(UserGrammarError.class)))
                .thenThrow(new RuntimeException("DB down"));

        // Act + Assert
        assertThatCode(() -> service.persistGrammarFeedback(USER_ID, SESSION_ID, MESSAGE_ID, "x",
                legacy("Das ist falsch.", "Artikel"), null))
                .doesNotThrowAnyException();

        verify(speakingMetrics).recordGrammarPersistFailure("legacy");
        verify(speakingMetrics, never()).recordGrammarPersistFailure("structured");
    }

    // ---------------------------------------------------------------------
    // Multiple errors in one turn
    // ---------------------------------------------------------------------

    @Test
    @DisplayName("multiple structured errors are each persisted independently")
    void persistGrammarFeedback_multipleErrors_eachPersisted() {
        // Arrange
        ErrorItem second = new ErrorItem("VERB_CONJUGATION.PRESENT", "MINOR", 0.7,
                "du gehst falsch", "du gehst", "rule", "Du gehst.");
        when(grammarErrorRepository.existsByMessageIdAndErrorCode(eq(MESSAGE_ID), anyString())).thenReturn(false);
        when(userErrorSkillRepository.findByUserIdAndErrorCode(eq(USER_ID), anyString()))
                .thenReturn(Optional.empty());

        // Act
        service.persistGrammarFeedback(USER_ID, SESSION_ID, MESSAGE_ID, "x",
                withErrors(List.of(structuredError(), second)), null);

        // Assert — two grammar errors, two observations, two skill upserts, two reviews
        verify(grammarErrorRepository, times(2)).save(any(UserGrammarError.class));
        verify(userErrorObservationRepository, times(2)).save(any(UserErrorObservation.class));
        verify(userErrorSkillRepository, times(2)).save(any(UserErrorSkill.class));
        verify(reviewSchedulerService).onMajorObservation(USER_ID, ERROR_CODE, "MAJOR");
        verify(reviewSchedulerService).onMajorObservation(USER_ID, "VERB_CONJUGATION.PRESENT", "MINOR");
    }

    // anyLong helper for static import readability
    private static long anyLong() {
        return org.mockito.ArgumentMatchers.anyLong();
    }
}
