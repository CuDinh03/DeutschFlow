package com.deutschflow.practice.service;

import com.deutschflow.gamification.service.XpService;
import com.deutschflow.practice.dto.PracticeSubmitRequest;
import com.deutschflow.practice.entity.PracticeExercise;
import com.deutschflow.practice.entity.PracticeHistory;
import com.deutschflow.practice.repository.PracticeExerciseRepository;
import com.deutschflow.practice.repository.PracticeHistoryRepository;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * QA F-12: the practice score must be re-derived server-side from the stored answer key, never
 * trusted from the client. Guards against the XP-farming hole where a direct POST of scorePercent=100
 * awarded full XP without answering.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class PracticeServiceGradingTest {

    @Mock PracticeExerciseRepository exerciseRepository;
    @Mock PracticeHistoryRepository historyRepository;
    @Mock UserRepository userRepository;
    @Mock XpService xpService;

    private final ObjectMapper objectMapper = new ObjectMapper();

    private static final Long USER = 1L;

    private PracticeService service() {
        return new PracticeService(exerciseRepository, historyRepository, userRepository, xpService, objectMapper);
    }

    private PracticeExercise gradableExercise() {
        // Two gradable questions with a known answer key.
        String content = "{\"questions\":[" +
                "{\"id\":\"q1\",\"correctAnswer\":\"Richtig\"}," +
                "{\"id\":\"q2\",\"correctAnswer\":\"das\"}]}";
        return PracticeExercise.builder()
                .id(10L).cefrLevel("A1").skillType("READING").xpReward(100).contentJson(content).build();
    }

    private void stubCommon(PracticeExercise ex) {
        when(userRepository.findById(USER)).thenReturn(Optional.of(User.builder()
                .email("g@test.com").passwordHash("x").displayName("G").role(User.Role.STUDENT).build()));
        when(exerciseRepository.findById(ex.getId())).thenReturn(Optional.of(ex));
    }

    private int savedScore() {
        ArgumentCaptor<PracticeHistory> cap = ArgumentCaptor.forClass(PracticeHistory.class);
        verify(historyRepository).save(cap.capture());
        return cap.getValue().getScorePercent();
    }

    @Test
    void lyingClientScoreIsIgnored_serverGradesFromAnswerKey() {
        PracticeExercise ex = gradableExercise();
        stubCommon(ex);

        // Client claims 100 but only 1 of 2 answers is correct.
        PracticeSubmitRequest req = new PracticeSubmitRequest();
        req.setPracticeId(10L);
        req.setScorePercent(100);
        req.setAnswerDataJson("{\"answers\":{\"q1\":\"Richtig\",\"q2\":\"der\"}}");

        service().submitPracticeResult(USER, req);

        assertThat(savedScore()).isEqualTo(50); // 1/2 correct — NOT the client's 100
        verify(xpService).awardCustomPractice(eq(USER), eq(50), anyString()); // 50% of 100 XP
    }

    @Test
    void allCorrect_scoresHundred() {
        PracticeExercise ex = gradableExercise();
        stubCommon(ex);

        PracticeSubmitRequest req = new PracticeSubmitRequest();
        req.setPracticeId(10L);
        req.setScorePercent(0); // client under-reports; server still grades truthfully
        req.setAnswerDataJson("{\"answers\":{\"q1\":\" richtig! \",\"q2\":\"DAS\"}}"); // case/punct-insensitive

        service().submitPracticeResult(USER, req);

        assertThat(savedScore()).isEqualTo(100);
    }

    @Test
    void externalResourceWithoutAnswerKey_honoursClampedClientScore() {
        // No questions → external resource (source_url only): self-confirmation is allowed but clamped.
        PracticeExercise ex = PracticeExercise.builder()
                .id(11L).cefrLevel("B1").skillType("READING").xpReward(50).contentJson("{}").build();
        stubCommon(ex);

        PracticeSubmitRequest req = new PracticeSubmitRequest();
        req.setPracticeId(11L);
        req.setScorePercent(100);
        req.setAnswerDataJson(null);

        service().submitPracticeResult(USER, req);

        assertThat(savedScore()).isEqualTo(100);
    }

    @Test
    void gradableExerciseWithNoAnswersSubmitted_scoresZero_noXp() {
        PracticeExercise ex = gradableExercise();
        stubCommon(ex);

        PracticeSubmitRequest req = new PracticeSubmitRequest();
        req.setPracticeId(10L);
        req.setScorePercent(100); // lying client
        req.setAnswerDataJson("{\"answers\":{}}");

        service().submitPracticeResult(USER, req);

        assertThat(savedScore()).isZero();
        verify(xpService, never()).awardCustomPractice(anyLong(), anyInt(), anyString()); // 0 XP → no award
    }
}
