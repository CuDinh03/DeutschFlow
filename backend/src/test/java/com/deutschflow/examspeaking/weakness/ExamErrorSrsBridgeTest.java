package com.deutschflow.examspeaking.weakness;

import com.deutschflow.examspeaking.api.model.BlueprintPart;
import com.deutschflow.examspeaking.api.model.Ergebnisbogen;
import com.deutschflow.examspeaking.api.model.ExamBlueprint;
import com.deutschflow.examspeaking.api.model.ExamProvider;
import com.deutschflow.examspeaking.api.model.PartFlow;
import com.deutschflow.examspeaking.api.model.TaskArchetype;
import com.deutschflow.examspeaking.entity.SpeakingExamErrorStat;
import com.deutschflow.examspeaking.repository.SpeakingExamErrorStatRepository;
import com.deutschflow.speaking.ai.ErrorItem;
import com.deutschflow.speaking.service.GrammarPersistenceService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class ExamErrorSrsBridgeTest {

    private GrammarPersistenceService grammarPersistence;
    private SpeakingExamErrorStatRepository statRepository;
    private ExamErrorSrsBridge bridge;

    private final ExamBlueprint bp = new ExamBlueprint(1L, ExamProvider.GOETHE, "A2", 1, "Goethe A2", 0,
            List.of(new BlueprintPart(1, TaskArchetype.CARD_QA, "Teil 1", 180, PartFlow.EXAMINER_LED, "NONE", "CARD", 2, 4, 4),
                    new BlueprintPart(2, TaskArchetype.ABOUT_ME, "Teil 2", 180, PartFlow.EXAMINER_LED, "NONE", "CARD", 1, 1, 2)),
            null);

    @BeforeEach
    void setUp() {
        grammarPersistence = mock(GrammarPersistenceService.class);
        statRepository = mock(SpeakingExamErrorStatRepository.class);
        when(statRepository.findByUserIdAndProviderAndLevelAndTeilNoAndErrorCode(anyLong(), anyString(), anyString(), anyInt(), anyString()))
                .thenReturn(Optional.empty());
        bridge = new ExamErrorSrsBridge(grammarPersistence, statRepository);
    }

    @Test
    void mockErrorsFlowIntoSrsAndStats() {
        bridge.ingestMockErrors(7L, bp, List.of(
                new Ergebnisbogen.ErrorItem("VERB_POSITION", "ich morgen gehe", "ich gehe morgen", "MAJOR", 1)));

        ArgumentCaptor<ErrorItem> err = ArgumentCaptor.forClass(ErrorItem.class);
        verify(grammarPersistence).persistExamError(eq(7L), err.capture(), eq("A2"));
        assertThat(err.getValue().errorCode()).isEqualTo("VERB_POSITION");
        assertThat(err.getValue().severity()).isEqualTo("MAJOR");
        assertThat(err.getValue().wrongSpan()).isEqualTo("ich morgen gehe");

        ArgumentCaptor<SpeakingExamErrorStat> stat = ArgumentCaptor.forClass(SpeakingExamErrorStat.class);
        verify(statRepository).save(stat.capture());
        assertThat(stat.getValue().getArchetype()).isEqualTo("CARD_QA");
        assertThat(stat.getValue().getTeilNo()).isEqualTo(1);
        assertThat(stat.getValue().getSeenCount()).isEqualTo(1);
        assertThat(stat.getValue().getLastCorrection()).isEqualTo("ich gehe morgen");
    }

    @Test
    void otherAndBlankCodesAreSkipped() {
        bridge.ingestMockErrors(7L, bp, List.of(
                new Ergebnisbogen.ErrorItem("OTHER", "x", "y", "MINOR", 1),
                new Ergebnisbogen.ErrorItem("", "x", "y", "MINOR", 1),
                new Ergebnisbogen.ErrorItem(null, "x", "y", "MINOR", 1)));
        verifyNoInteractions(grammarPersistence);
        verify(statRepository, never()).save(any());
    }

    @Test
    void drillEvalCorrectionsAreIngestedWithSeverity() {
        Map<String, Object> eval = Map.of("score", 6, "corrections", List.of(
                Map.of("code", "ARTICLE_GENDER", "original", "der Buch", "correction", "das Buch", "severity", "MINOR")));

        bridge.ingestDrillEval(7L, bp, 2, eval);

        ArgumentCaptor<ErrorItem> err = ArgumentCaptor.forClass(ErrorItem.class);
        verify(grammarPersistence).persistExamError(eq(7L), err.capture(), eq("A2"));
        assertThat(err.getValue().severity()).isEqualTo("MINOR");
        ArgumentCaptor<SpeakingExamErrorStat> stat = ArgumentCaptor.forClass(SpeakingExamErrorStat.class);
        verify(statRepository).save(stat.capture());
        assertThat(stat.getValue().getArchetype()).isEqualTo("ABOUT_ME");
        assertThat(stat.getValue().getTeilNo()).isEqualTo(2);
    }

    @Test
    void existingStatIsIncrementedNotDuplicated() {
        SpeakingExamErrorStat existing = SpeakingExamErrorStat.builder()
                .userId(7L).provider("GOETHE").level("A2").teilNo(1).archetype("CARD_QA")
                .errorCode("VERB_POSITION").seenCount(3).lastSeenAt(LocalDateTime.now().minusDays(1)).build();
        existing.setId(99L);
        when(statRepository.findByUserIdAndProviderAndLevelAndTeilNoAndErrorCode(7L, "GOETHE", "A2", 1, "VERB_POSITION"))
                .thenReturn(Optional.of(existing));

        bridge.ingestMockErrors(7L, bp, List.of(
                new Ergebnisbogen.ErrorItem("VERB_POSITION", "a", "b", "MAJOR", 1)));

        ArgumentCaptor<SpeakingExamErrorStat> stat = ArgumentCaptor.forClass(SpeakingExamErrorStat.class);
        verify(statRepository).save(stat.capture());
        assertThat(stat.getValue().getId()).isEqualTo(99L);
        assertThat(stat.getValue().getSeenCount()).isEqualTo(4);
    }

    @Test
    void ingestNeverThrows() {
        doThrow(new RuntimeException("db down")).when(grammarPersistence)
                .persistExamError(anyLong(), any(), anyString());
        bridge.ingestMockErrors(7L, bp, List.of(
                new Ergebnisbogen.ErrorItem("VERB_POSITION", "a", "b", "MAJOR", 1)));
        // không ném — lượt thi/job chấm không được hỏng vì ingest
    }

    @Test
    void drillEvalWithoutCorrectionsIsNoop() {
        bridge.ingestDrillEval(7L, bp, 1, Map.of("error", "AI trả kết quả không hợp lệ"));
        bridge.ingestDrillEval(7L, bp, 1, null);
        verifyNoInteractions(grammarPersistence);
    }
}
