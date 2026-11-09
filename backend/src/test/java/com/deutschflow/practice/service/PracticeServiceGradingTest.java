package com.deutschflow.practice.service;

import com.deutschflow.gamification.service.XpService;
import com.deutschflow.practice.dto.PracticeSubmitRequest;
import com.deutschflow.practice.dto.PracticeSubmitResponse;
import com.deutschflow.practice.entity.PracticeExercise;
import com.deutschflow.practice.entity.PracticeHistory;
import com.deutschflow.practice.repository.PracticeExerciseRepository;
import com.deutschflow.practice.repository.PracticeHistoryRepository;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * QA F-12 + A2 (09/11/2026): điểm bài bổ trợ phải do server chấm từ đáp án lưu trong DB, KHÔNG BAO
 * GIỜ lấy {@code scorePercent} client gửi — kể cả khi không chấm được (trả 0 + metric), và bài
 * "external" chỉ được XP cố định, 1 lần/bài/ngày giờ VN.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class PracticeServiceGradingTest {

    @Mock PracticeExerciseRepository exerciseRepository;
    @Mock PracticeHistoryRepository historyRepository;
    @Mock UserRepository userRepository;
    @Mock XpService xpService;
    @Mock JdbcTemplate jdbcTemplate;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final SimpleMeterRegistry meters = new SimpleMeterRegistry();

    private static final Long USER = 1L;
    private static final int EXTERNAL_XP = 5;
    /** 18:30Z ngày 09/11 = 01:30 sáng 10/11 giờ VN → ngày VN bắt đầu lúc 17:00Z ngày 09/11. */
    private static final Instant NOW = Instant.parse("2026-11-09T18:30:00Z");
    private final Clock clock = Clock.fixed(NOW, ZoneOffset.UTC);

    private PracticeService service() {
        return new PracticeService(exerciseRepository, historyRepository, userRepository, xpService,
                objectMapper, meters, clock, jdbcTemplate, EXTERNAL_XP);
    }

    private PracticeExercise gradableExercise() {
        // Two gradable questions with a known answer key.
        String content = "{\"questions\":[" +
                "{\"id\":\"q1\",\"correctAnswer\":\"Richtig\"}," +
                "{\"id\":\"q2\",\"correctAnswer\":\"das\"}]}";
        return PracticeExercise.builder()
                .id(10L).cefrLevel("A1").skillType("READING").xpReward(100).contentJson(content).build();
    }

    private PracticeExercise externalExercise(int xpReward) {
        return PracticeExercise.builder()
                .id(11L).cefrLevel("B1").skillType("READING").xpReward(xpReward).contentJson("{}")
                .sourceUrl("https://www.goethe.de/uebungen").build();
    }

    private void stubCommon(PracticeExercise ex) {
        when(userRepository.findById(USER)).thenReturn(Optional.of(User.builder()
                .email("g@test.com").passwordHash("x").displayName("G").role(User.Role.STUDENT).build()));
        when(exerciseRepository.findById(ex.getId())).thenReturn(Optional.of(ex));
    }

    private PracticeSubmitRequest req(long id, Integer clientScore, String answerData) {
        PracticeSubmitRequest req = new PracticeSubmitRequest();
        req.setPracticeId(id);
        req.setScorePercent(clientScore);
        req.setAnswerDataJson(answerData);
        return req;
    }

    private PracticeHistory saved() {
        ArgumentCaptor<PracticeHistory> cap = ArgumentCaptor.forClass(PracticeHistory.class);
        verify(historyRepository).save(cap.capture());
        return cap.getValue();
    }

    private double fallbackCount(String reason) {
        var c = meters.find(PracticeService.FALLBACK_METRIC).tag("reason", reason).counter();
        return c == null ? 0 : c.count();
    }

    private void assertNoXp() {
        verify(xpService, never()).awardCustomPractice(anyLong(), anyInt(), anyString());
    }

    @Test
    void lyingClientScoreIsIgnored_serverGradesFromAnswerKey() {
        PracticeExercise ex = gradableExercise();
        stubCommon(ex);

        // Client claims 100 but only 1 of 2 answers is correct.
        PracticeSubmitResponse res = service().submitPracticeResult(USER,
                req(10L, 100, "{\"answers\":{\"q1\":\"Richtig\",\"q2\":\"der\"}}"));

        assertThat(saved().getScorePercent()).isEqualTo(50); // 1/2 correct — NOT the client's 100
        verify(xpService).awardCustomPractice(eq(USER), eq(50), anyString()); // 50% of 100 XP
        assertThat(res.scorePercent()).isEqualTo(50);
        assertThat(res.xpEarned()).isEqualTo(50);
        assertThat(res.graded()).isTrue();
        assertThat(res.external()).isFalse();
    }

    @Test
    void allCorrect_scoresHundred() {
        PracticeExercise ex = gradableExercise();
        stubCommon(ex);

        // client under-reports; server still grades truthfully (case/punct-insensitive)
        service().submitPracticeResult(USER, req(10L, 0, "{\"answers\":{\"q1\":\" richtig! \",\"q2\":\"DAS\"}}"));

        assertThat(saved().getScorePercent()).isEqualTo(100);
    }

    @Test
    void gradableExerciseWithNoAnswersSubmitted_scoresZero_noXp_countsFallback() {
        PracticeExercise ex = gradableExercise();
        stubCommon(ex);

        service().submitPracticeResult(USER, req(10L, 100, "{\"answers\":{}}"));

        assertThat(saved().getScorePercent()).isZero();
        assertNoXp();
        assertThat(fallbackCount("no_answers")).isEqualTo(1.0);
    }

    @Test
    void malformedExerciseJson_scoresZero_notClientScore() {
        PracticeExercise ex = PracticeExercise.builder()
                .id(12L).cefrLevel("A2").skillType("READING").xpReward(100).contentJson("{not json").build();
        stubCommon(ex);

        PracticeSubmitResponse res = service().submitPracticeResult(USER, req(12L, 100, "{\"answers\":{\"q1\":\"x\"}}"));

        assertThat(saved().getScorePercent()).isZero();
        assertThat(res.xpEarned()).isZero();
        assertNoXp();
        assertThat(fallbackCount("content_parse_error")).isEqualTo(1.0);
    }

    @Test
    void malformedAnswerJson_scoresZero_notClientScore() {
        PracticeExercise ex = gradableExercise();
        stubCommon(ex);

        service().submitPracticeResult(USER, req(10L, 100, "{answers: oops"));

        assertThat(saved().getScorePercent()).isZero();
        assertNoXp();
        assertThat(fallbackCount("answers_parse_error")).isEqualTo(1.0);
    }

    @Test
    void noQuestionsAndNoSourceUrl_scoresZero_notClientScore() {
        PracticeExercise ex = PracticeExercise.builder()
                .id(13L).cefrLevel("A1").skillType("READING").xpReward(50).contentJson("{}").build();
        stubCommon(ex);

        service().submitPracticeResult(USER, req(13L, 100, null));

        assertThat(saved().getScorePercent()).isZero();
        assertNoXp();
        assertThat(fallbackCount("no_questions")).isEqualTo(1.0);
    }

    @Test
    void questionsWithoutAnswerKeyAndNoSourceUrl_scoresZero() {
        PracticeExercise ex = PracticeExercise.builder()
                .id(14L).cefrLevel("A1").skillType("WRITING").xpReward(50)
                .contentJson("{\"questions\":[{\"id\":\"q1\",\"prompt\":\"Schreib\"}]}").build();
        stubCommon(ex);

        service().submitPracticeResult(USER, req(14L, 100, "{\"answers\":{\"q1\":\"Hallo\"}}"));

        assertThat(saved().getScorePercent()).isZero();
        assertNoXp();
        assertThat(fallbackCount("no_answer_key")).isEqualTo(1.0);
    }

    @Test
    void externalExercise_firstCompletionToday_getsFixedXp_notPercentBased() {
        PracticeExercise ex = externalExercise(100);
        stubCommon(ex);
        when(historyRepository.existsRewardedCompletionBetween(eq(USER), eq(11L), any(), any())).thenReturn(false);

        PracticeSubmitResponse res = service().submitPracticeResult(USER, req(11L, 100, null));

        verify(xpService).awardCustomPractice(eq(USER), eq(EXTERNAL_XP), anyString()); // NOT 100 XP
        PracticeHistory h = saved();
        assertThat(h.getXpEarned()).isEqualTo(EXTERNAL_XP);
        assertThat(h.getScorePercent()).isZero(); // no server score for an external resource
        assertThat(res.external()).isTrue();
        assertThat(res.xpEarned()).isEqualTo(EXTERNAL_XP);
        assertThat(fallbackCount("no_questions")).isZero(); // external is not a grading fallback
    }

    @Test
    void externalExercise_secondCompletionSameVnDay_getsNoXp() {
        PracticeExercise ex = externalExercise(100);
        stubCommon(ex);
        when(historyRepository.existsRewardedCompletionBetween(eq(USER), eq(11L), any(), any())).thenReturn(true);

        PracticeSubmitResponse res = service().submitPracticeResult(USER, req(11L, 100, null));

        assertNoXp();
        assertThat(saved().getXpEarned()).isZero();
        assertThat(res.xpEarned()).isZero();
    }

    @Test
    void externalExercise_dailyWindowIsTheVietnamCalendarDay() {
        PracticeExercise ex = externalExercise(100);
        stubCommon(ex);
        ArgumentCaptor<LocalDateTime> from = ArgumentCaptor.forClass(LocalDateTime.class);
        ArgumentCaptor<LocalDateTime> to = ArgumentCaptor.forClass(LocalDateTime.class);
        when(historyRepository.existsRewardedCompletionBetween(eq(USER), eq(11L), from.capture(), to.capture()))
                .thenReturn(false);

        service().submitPracticeResult(USER, req(11L, 100, null));

        // 18:30Z 09/11 is already 10/11 in Vietnam: window = [10/11 00:00 VN, 11/11 00:00 VN).
        ZoneId jvm = ZoneId.systemDefault();
        assertThat(from.getValue()).isEqualTo(LocalDateTime.ofInstant(Instant.parse("2026-11-09T17:00:00Z"), jvm));
        assertThat(to.getValue()).isEqualTo(LocalDateTime.ofInstant(Instant.parse("2026-11-10T17:00:00Z"), jvm));
        assertThat(saved().getCompletedAt()).isEqualTo(LocalDateTime.ofInstant(NOW, jvm));
    }

    @Test
    void externalExercise_fixedXpNeverExceedsDeclaredReward() {
        PracticeExercise ex = externalExercise(3);
        stubCommon(ex);
        when(historyRepository.existsRewardedCompletionBetween(eq(USER), eq(11L), any(), any())).thenReturn(false);

        service().submitPracticeResult(USER, req(11L, 100, null));

        verify(xpService).awardCustomPractice(eq(USER), eq(3), anyString());
    }
}
