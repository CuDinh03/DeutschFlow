package com.deutschflow.beginner.service;

import com.deutschflow.beginner.entity.BeginnerJourneyItem;
import com.deutschflow.beginner.repository.BeginnerJourneyItemRepository;
import com.deutschflow.progress.entity.LearnerPhaseState;
import com.deutschflow.progress.entity.PhaseType;
import com.deutschflow.progress.service.PhaseEngineService;
import com.deutschflow.user.entity.User;
import com.deutschflow.vocabulary.entity.Word;
import com.deutschflow.vocabulary.repository.WordRepository;
import com.deutschflow.vocabulary.service.SpacedRepetitionService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class BeginnerJourneyServiceTest {

    @Mock
    BeginnerJourneyItemRepository itemRepository;

    @Mock
    SpacedRepetitionService srsService;

    @Mock
    PhaseEngineService phaseEngineService;

    @Mock
    WordRepository wordRepository;

    @InjectMocks
    BeginnerJourneyService beginnerJourneyService;

    private User user;

    @BeforeEach
    void setUp() {
        user = User.builder().id(1L).email("test@test.com").build();
    }

    @Test
    @DisplayName("first session returns week-1 items")
    void getFirstSession_returnsWeek1Items() {
        var item = BeginnerJourneyItem.builder()
                .sequenceOrder(1)
                .itemType("VOCABULARY")
                .titleDe("Hallo")
                .titleVi("Xin chào")
                .exampleDe("Hallo! Wie geht es Ihnen?")
                .exampleVi("Xin chào!")
                .audioHint("ha-lo")
                .phase("FOUNDATION")
                .weekNumber(1)
                .build();
        when(itemRepository.findByWeekNumberOrderBySequenceOrderAsc(1)).thenReturn(List.of(item));

        var session = beginnerJourneyService.getFirstSession();

        assertThat(session.items()).hasSize(1);
        assertThat(session.items().get(0).titleDe()).isEqualTo("Hallo");
        assertThat(session.welcomeMessage()).isNotBlank();
        assertThat(session.firstSpeakingPrompt()).isNotBlank();
    }

    @Test
    @DisplayName("zero-knowledge learner gets understandable first session")
    void getFirstSession_itemsAreBeginnerSafe() {
        when(itemRepository.findByWeekNumberOrderBySequenceOrderAsc(1)).thenReturn(List.of());

        var session = beginnerJourneyService.getFirstSession();

        assertThat(session.items()).isEmpty();
        assertThat(session.welcomeMessage()).isNotBlank();
    }

    @Test
    @DisplayName("completing first session increments sessions count")
    void recordFirstSessionCompletion_incrementsSessionCount() {
        var phaseState = LearnerPhaseState.builder()
                .user(user)
                .currentPhase(PhaseType.FOUNDATION)
                .phaseStartedAt(LocalDateTime.now())
                .sessionsCompleted(0)
                .build();
        when(phaseEngineService.getOrCreatePhaseState(user)).thenReturn(phaseState);
        when(phaseEngineService.updateProgress(eq(user), anyInt(), anyInt(), anyInt(), eq(1)))
                .thenReturn(phaseState);
        when(itemRepository.findByWeekNumberOrderBySequenceOrderAsc(1)).thenReturn(List.of());

        beginnerJourneyService.recordFirstSessionCompletion(user);

        verify(phaseEngineService).updateProgress(user, 0, 0, 0, 1);
    }

    @Test
    @DisplayName("vocabulary items get scheduled in SRS on first session completion")
    void recordFirstSessionCompletion_schedulesVocabInSrs() {
        var vocabItem = BeginnerJourneyItem.builder()
                .sequenceOrder(1).itemType("VOCABULARY").titleDe("Hallo").titleVi("Xin chào")
                .exampleDe("Hallo!").exampleVi("Xin chào!").audioHint("ha-lo")
                .phase("FOUNDATION").weekNumber(1).build();
        var dialogueItem = BeginnerJourneyItem.builder()
                .sequenceOrder(2).itemType("DIALOGUE_PROMPT").titleDe("Wie geht es Ihnen?").titleVi("Bạn khỏe không?")
                .exampleDe("").exampleVi("").audioHint("")
                .phase("FOUNDATION").weekNumber(1).build();
        var word = Word.builder().id(42L).word("Hallo").build();
        var phaseState = LearnerPhaseState.builder()
                .user(user).currentPhase(PhaseType.FOUNDATION)
                .phaseStartedAt(LocalDateTime.now()).sessionsCompleted(0).build();

        when(phaseEngineService.getOrCreatePhaseState(user)).thenReturn(phaseState);
        when(phaseEngineService.updateProgress(eq(user), anyInt(), anyInt(), anyInt(), eq(1))).thenReturn(phaseState);
        when(itemRepository.findByWeekNumberOrderBySequenceOrderAsc(1)).thenReturn(List.of(vocabItem, dialogueItem));
        when(wordRepository.findByWord("Hallo")).thenReturn(Optional.of(word));

        beginnerJourneyService.recordFirstSessionCompletion(user);

        verify(srsService).scheduleWord(user, 42L);
        verify(srsService, times(1)).scheduleWord(any(), any());
    }

    @Test
    @DisplayName("missing vocab in word table is skipped without error")
    void recordFirstSessionCompletion_missingWordSkippedGracefully() {
        var vocabItem = BeginnerJourneyItem.builder()
                .sequenceOrder(1).itemType("VOCABULARY").titleDe("UnknownWord").titleVi("?")
                .exampleDe("").exampleVi("").audioHint("")
                .phase("FOUNDATION").weekNumber(1).build();
        var phaseState = LearnerPhaseState.builder()
                .user(user).currentPhase(PhaseType.FOUNDATION)
                .phaseStartedAt(LocalDateTime.now()).sessionsCompleted(0).build();

        when(phaseEngineService.getOrCreatePhaseState(user)).thenReturn(phaseState);
        when(phaseEngineService.updateProgress(eq(user), anyInt(), anyInt(), anyInt(), eq(1))).thenReturn(phaseState);
        when(itemRepository.findByWeekNumberOrderBySequenceOrderAsc(1)).thenReturn(List.of(vocabItem));
        when(wordRepository.findByWord("UnknownWord")).thenReturn(Optional.empty());

        beginnerJourneyService.recordFirstSessionCompletion(user);

        verify(srsService, never()).scheduleWord(any(), any());
    }
}
