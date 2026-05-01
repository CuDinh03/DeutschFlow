package com.deutschflow.speaking;

import com.deutschflow.common.exception.ConflictException;
import com.deutschflow.common.quota.QuotaSnapshot;
import com.deutschflow.common.quota.QuotaService;
import com.deutschflow.common.quota.QuotaVnCalendar;
import com.deutschflow.speaking.ai.AiChatCompletionResult;
import com.deutschflow.speaking.ai.OpenAiChatClient;
import com.deutschflow.speaking.ai.TokenUsage;
import com.deutschflow.speaking.dto.WeeklySpeakingDtos;
import com.deutschflow.speaking.service.WeeklySpeakingService;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class WeeklySpeakingIntegrationTest {

    private static final String WEEKLY_RUBRIC_JSON = """
            {
              "task_completion": {
                "score_1_to_5": 3,
                "covered_mandatory_indices": [0],
                "missing_mandatory_indices": [1],
                "off_topic": false,
                "ambiguous": false
              },
              "fluency": {
                "subjective_notes_de": "OK",
                "filler_approx_count": 0,
                "wpm_approx": null,
                "confidence_label": "TEXT_ONLY_PROXY"
              },
              "lexis": {
                "richness_notes_de": [],
                "replacements_suggested_de_vi": []
              },
              "grammar": {
                "summary_de": "wenig",
                "errors": []
              },
              "feedback_vi_summary": "Bạn nói rõ ý chính.",
              "disclaimer_vi": "Đánh giá học đường, không thay chứng chỉ."
            }
            """;

    @Autowired
    private WeeklySpeakingService weeklySpeakingService;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private UserRepository userRepository;

    @MockBean
    private OpenAiChatClient openAiChatClient;

    @MockBean
    private QuotaService quotaService;

    private User learner;
    private LocalDate weekMonday;
    private long promptId;

    @BeforeEach
    void setUp() {
        learner = userRepository.save(User.builder()
                .email("weekly-speaking@test.com")
                .passwordHash("$2a$10$hash")
                .displayName("Weekly Learner")
                .role(User.Role.STUDENT)
                .build());

        weekMonday = QuotaVnCalendar.localDateOf(Instant.now()).with(DayOfWeek.MONDAY);

        jdbcTemplate.update("""
                        INSERT INTO weekly_speaking_prompts (
                          week_start_date, cefr_band, title, prompt_de, mandatory_points_json, optional_points_json, is_active
                        ) VALUES (?, 'B1', 'Testthema', 'Beschreiben Sie Ihre Woche.', ?, ?, TRUE)
                        """,
                java.sql.Date.valueOf(weekMonday),
                "[\"Punkt A\",\"Punkt B\"]",
                "[\"Optional\"]");
        promptId = jdbcTemplate.queryForObject(
                "SELECT id FROM weekly_speaking_prompts WHERE week_start_date = ? AND cefr_band = 'B1'",
                Long.class, java.sql.Date.valueOf(weekMonday));

        QuotaSnapshot snap = quotaSnapshot();
        lenient().when(quotaService.assertAllowed(anyLong(), any(Instant.class), anyLong())).thenReturn(snap);
        lenient().when(quotaService.getSnapshot(anyLong(), any(Instant.class))).thenReturn(snap);

        when(openAiChatClient.chatCompletion(anyList(), any(), anyDouble(), any()))
                .thenReturn(new AiChatCompletionResult(
                        WEEKLY_RUBRIC_JSON,
                        TokenUsage.exact(20, 80, 100),
                        "GROQ",
                        "test-weekly-model"));
    }

    private static QuotaSnapshot quotaSnapshot() {
        Instant now = Instant.now();
        Instant[] bounds = QuotaVnCalendar.vnDayBoundsInclusiveExclusive(now);
        return new QuotaSnapshot(
                "INTERNAL",
                true,
                bounds[0],
                bounds[1],
                0L,
                0L,
                0L,
                0L,
                999_999_999L,
                Instant.EPOCH,
                null);
    }

    @Test
    void getCurrentPrompt_returnsSeededRow() {
        WeeklySpeakingDtos.WeeklyPromptResponse p = weeklySpeakingService.getCurrentPrompt(learner.getId(), "B1");
        assertThat(p.id()).isEqualTo(promptId);
        assertThat(p.weekStartDate()).isEqualTo(weekMonday);
        assertThat(p.mandatoryPoints()).hasSize(2);
    }

    @Test
    void submit_persistsAndRollsIntoReport() throws Exception {
        WeeklySpeakingDtos.WeeklySubmissionResponse r = weeklySpeakingService.submit(
                learner.getId(),
                new WeeklySpeakingDtos.WeeklySubmissionRequest(promptId,
                        "Diese Woche habe ich gearbeitet und Sport gemacht.", null, "B1"));

        assertThat(r.submissionId()).isPositive();
        assertThat(r.rubric().task_completion().score_1_to_5()).isEqualTo(3);
        assertThat(r.mergedIntoWeeklyReport()).isTrue();

        Integer subCount = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM weekly_speaking_submissions WHERE user_id = ? AND prompt_id = ?",
                Integer.class, learner.getId(), promptId);
        assertThat(subCount).isEqualTo(1);

        String metrics = jdbcTemplate.queryForObject("""
                        SELECT CAST(metrics_json AS VARCHAR) FROM learner_progress_reports
                        WHERE user_id = ? AND period_type = 'WEEK' AND period_start = ?
                        """,
                String.class, learner.getId(), java.sql.Date.valueOf(weekMonday));
        assertThat(metrics).contains("weekly_speaking_submission");
        assertThat(metrics).contains("task_score");
        assertThat(metrics).contains("3");

        assertThatThrownBy(() ->
                weeklySpeakingService.submit(
                        learner.getId(),
                        new WeeklySpeakingDtos.WeeklySubmissionRequest(
                                promptId, "Noch einmal!", null, "B1")))
                .isInstanceOf(ConflictException.class);
    }
}
