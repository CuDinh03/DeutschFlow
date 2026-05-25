package com.deutschflow.speaking.service;

import com.deutschflow.speaking.dto.ErrorSkillDto;
import com.deutschflow.speaking.entity.UserGrammarError;
import com.deutschflow.speaking.metrics.SpeakingMetrics;
import com.deutschflow.speaking.repository.UserGrammarErrorRepository;
import com.deutschflow.speaking.repository.UserErrorSkillRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class ErrorSkillsServiceTest {

    @Mock
    private UserGrammarErrorRepository grammarErrorRepository;

    @Mock
    private UserErrorSkillRepository userErrorSkillRepository;

    @Mock
    private ReviewSchedulerService reviewSchedulerService;

    @Mock
    private SpeakingMetrics speakingMetrics;

    @Mock
    private AdaptivePolicyService adaptivePolicyService;

    private ErrorSkillsService service;

    @BeforeEach
    void setUp() {
        service = new ErrorSkillsService(
                grammarErrorRepository,
                userErrorSkillRepository,
                reviewSchedulerService,
                speakingMetrics,
                adaptivePolicyService);
        org.mockito.Mockito.when(userErrorSkillRepository.countByUserId(org.mockito.ArgumentMatchers.anyLong()))
                .thenReturn(0L);
        org.mockito.Mockito.when(grammarErrorRepository.updateRepairStatusForOpenErrors(
                        org.mockito.ArgumentMatchers.anyLong(),
                        org.mockito.ArgumentMatchers.anyString(),
                        org.mockito.ArgumentMatchers.anyString()))
                .thenReturn(1);
    }

    @Test
    void getSkills_mapsAggregateRows_sortedByDescendingPriorityScore() {
        long userId = 42;
        LocalDateTime lastA = LocalDateTime.now().minusDays(2);
        LocalDateTime lastB = LocalDateTime.now().minusDays(1);

        UserGrammarError highLatest = UserGrammarError.builder()
                .userId(userId)
                .grammarPoint("VERB.CONJ_PERSON_ENDING")
                .errorCode("VERB.CONJ_PERSON_ENDING")
                .severity("HIGH")
                .originalText("ich gehst")
                .correctionText("ich gehst ich gehe")
                .ruleViShort("chia động từ")
                .repairStatus("OPEN")
                .createdAt(lastA)
                .build();

        UserGrammarError minorLatest = UserGrammarError.builder()
                .userId(userId)
                .grammarPoint("CASE.PREP_DAT_MIT")
                .errorCode("CASE.PREP_DAT_MIT")
                .severity("MINOR")
                .originalText("mit dem Haus")
                .correctionText("mit dem Haus")
                .ruleViShort("mit + Dat")
                .repairStatus("OPEN")
                .createdAt(lastB)
                .build();

        when(grammarErrorRepository.aggregateErrorGroups(eq(userId), any(LocalDateTime.class))).thenAnswer(inv -> {
            LocalDateTime s = inv.getArgument(1);
            assertThat(s).isBeforeOrEqualTo(LocalDateTime.now());
            return List.<Object[]>of(
                    new Object[]{"CASE.PREP_DAT_MIT", 5L, lastB},
                    new Object[]{"VERB.CONJ_PERSON_ENDING", 5L, lastA});
        });

        when(grammarErrorRepository.findFirstByUserIdAndErrorCodeOrderByCreatedAtDesc(eq(userId),
                eq("VERB.CONJ_PERSON_ENDING")))
                .thenReturn(Optional.of(highLatest));
        when(grammarErrorRepository.findFirstByUserIdAndErrorCodeOrderByCreatedAtDesc(eq(userId),
                eq("CASE.PREP_DAT_MIT")))
                .thenReturn(Optional.of(minorLatest));

        List<ErrorSkillDto> skills = service.getSkills(userId, 30);

        assertThat(skills).hasSize(2);
        assertThat(skills.get(0).priorityScore()).isGreaterThan(skills.get(1).priorityScore());

        ErrorSkillDto first = skills.get(0);
        assertThat(first.errorCode()).isEqualTo("VERB.CONJ_PERSON_ENDING");
        assertThat(first.count()).isEqualTo(5);
        assertThat(first.sampleWrong()).isEqualTo("ich gehst");
        assertThat(first.sampleCorrected()).isEqualTo("ich gehst ich gehe");
        assertThat(first.ruleViShort()).isEqualTo("chia động từ");
    }

    @Test
    void getSkills_blankCodeSkipped() {
        when(grammarErrorRepository.aggregateErrorGroups(eq(1L), any(LocalDateTime.class)))
                .thenReturn(List.<Object[]>of(new Object[]{"", 1L, LocalDateTime.now()}));

        assertThat(service.getSkills(1L, 7)).isEmpty();
        verify(grammarErrorRepository, never()).findFirstByUserIdAndErrorCodeOrderByCreatedAtDesc(any(), any());
    }

    @Test
    void recordRepairAttempt_callsRepository_whenCodePresent() {
        service.recordRepairAttempt(9L, " VERB.PARTIZIP_II_FORM ");
        ArgumentCaptor<String> status = ArgumentCaptor.forClass(String.class);
        verify(grammarErrorRepository).updateRepairStatusForOpenErrors(eq(9L), eq("VERB.PARTIZIP_II_FORM"), status.capture());
        assertThat(status.getValue()).isEqualTo("RESOLVED");
        verify(reviewSchedulerService).onRepairRecorded(9L, "VERB.PARTIZIP_II_FORM", 1);
        verify(speakingMetrics).recordRepairAttempt(1);
    }

    @Test
    void recordRepairAttempt_noRepositoryCall_whenBlank() {
        service.recordRepairAttempt(1L, "   ");
        service.recordRepairAttempt(1L, null);
        verify(grammarErrorRepository, never()).updateRepairStatusForOpenErrors(any(), any(), any());
    }
}
