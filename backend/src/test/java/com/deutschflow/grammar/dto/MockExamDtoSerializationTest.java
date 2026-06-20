package com.deutschflow.grammar.dto;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.Date;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Guards the byte-level JSON contract of the MockExam Round-2a DTOs: the records replaced raw
 * {@code Map<String,Object>} responses, so the keys (snake_case) and conditional-inclusion
 * behaviour MUST stay identical or the live web/mobile clients break.
 */
class MockExamDtoSerializationTest {

    private final ObjectMapper om = new ObjectMapper();

    // Mirrors the app config (spring.jackson.serialization.write-dates-as-timestamps:false). The
    // SAME mapper serializes both sides of each equivalence check, so any date-format detail cancels
    // out and the assertion proves keys/values/null-handling match the old map exactly.
    private final ObjectMapper omd = new ObjectMapper().disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);

    private void assertSameJson(Object dto, Map<String, Object> legacyMap) throws Exception {
        JsonNode fromDto = omd.readTree(omd.writeValueAsString(dto));
        JsonNode fromMap = omd.readTree(omd.writeValueAsString(legacyMap));
        assertThat(fromDto).isEqualTo(fromMap);
    }

    @Test
    @DisplayName("ExamSummaryDto keeps snake_case keys (not camelCase)")
    void examSummaryKeepsSnakeCaseKeys() throws Exception {
        var json = om.writeValueAsString(
                new ExamSummaryDto(7L, "B1", "GOETHE", "Set 1", "Mô tả", 100, 60, 90));
        assertThat(json)
                .contains("\"id\":7")
                .contains("\"cefr_level\":\"B1\"")
                .contains("\"exam_format\":\"GOETHE\"")
                .contains("\"description_vi\":\"Mô tả\"")
                .contains("\"total_points\":100")
                .contains("\"pass_points\":60")
                .contains("\"time_limit_minutes\":90")
                .doesNotContain("cefrLevel")
                .doesNotContain("totalPoints")
                .doesNotContain("timeLimitMinutes");
    }

    @Test
    @DisplayName("ExamFinishAcceptedDto emits jobId/status/attemptId")
    void finishAcceptedKeys() throws Exception {
        var json = om.writeValueAsString(new ExamFinishAcceptedDto("job-1", "PENDING", 42L));
        assertThat(json)
                .contains("\"jobId\":\"job-1\"")
                .contains("\"status\":\"PENDING\"")
                .contains("\"attemptId\":42");
    }

    @Test
    @DisplayName("review Item: snake_case keys; explanation omitted when null, present otherwise")
    void reviewItemSnakeCaseAndConditionalExplanation() throws Exception {
        var without = om.writeValueAsString(
                new ExamReviewDto.Item("q1", "Frage?", "A", "B", false, null));
        assertThat(without)
                .contains("\"user_answer\":\"A\"")
                .contains("\"correct_answer\":\"B\"")
                .contains("\"is_correct\":false")
                .doesNotContain("explanation");      // @JsonInclude(NON_NULL) drops it

        var with = om.writeValueAsString(
                new ExamReviewDto.Item("q1", "Frage?", "A", "B", true, "Weil das Dativ ist"));
        assertThat(with).contains("\"explanation\":\"Weil das Dativ ist\"");
    }

    @Test
    @DisplayName("review Item: user_answer/correct_answer stay present even when null (old map always put them)")
    void reviewItemKeepsNullAnswers() throws Exception {
        var json = om.writeValueAsString(
                new ExamReviewDto.Item("q1", "Frage?", null, null, false, null));
        assertThat(json)
                .contains("\"user_answer\":null")
                .contains("\"correct_answer\":null");
    }

    @Test
    @DisplayName("ExamQuestionsDto keeps sections_json key")
    void questionsKeepsSectionsJsonKey() throws Exception {
        var json = om.writeValueAsString(new ExamQuestionsDto("{\"sections\":[]}"));
        assertThat(json).contains("\"sections_json\":").doesNotContain("sectionsJson");
    }

    @Test
    @DisplayName("ExamCoverageDto exam row keeps is_active / attempt_count keys")
    void coverageRowSnakeCaseKeys() throws Exception {
        var json = om.writeValueAsString(new ExamCoverageDto.Exam(1L, "Set 1", true, 50L));
        assertThat(json)
                .contains("\"is_active\":true")
                .contains("\"attempt_count\":50")
                .doesNotContain("isActive")
                .doesNotContain("attemptCount");
    }

    // ── Round 2b: timestamp DTOs proven byte-equivalent to the exact legacy maps ──────────────

    @Test
    @DisplayName("ExamStartDto (new attempt) == legacy map with all keys")
    void startNewAttemptEqualsLegacyMap() throws Exception {
        Date ts = new Date(1_718_866_800_000L);
        Map<String, Object> legacy = new LinkedHashMap<>();
        legacy.put("id", 5L);
        legacy.put("exam_id", 7L);
        legacy.put("started_at", ts);
        legacy.put("status", "IN_PROGRESS");
        legacy.put("sections_json", "{\"sections\":[]}");
        legacy.put("time_limit_minutes", 90);
        assertSameJson(new ExamStartDto(5L, 7L, ts, "IN_PROGRESS", "{\"sections\":[]}", 90), legacy);
    }

    @Test
    @DisplayName("ExamStartDto (reusing) omits exam_id/started_at/status like the legacy map")
    void startReusingOmitsKeys() throws Exception {
        Map<String, Object> legacy = new LinkedHashMap<>();   // reusing branch put only these 3 keys
        legacy.put("id", 5L);
        legacy.put("sections_json", "{\"sections\":[]}");
        legacy.put("time_limit_minutes", 90);
        assertSameJson(new ExamStartDto(5L, null, null, null, "{\"sections\":[]}", 90), legacy);
    }

    @Test
    @DisplayName("ExamAttemptDto == legacy queryForList row (nulls kept)")
    void attemptEqualsLegacyMap() throws Exception {
        Date started = new Date(1_718_866_800_000L);
        Map<String, Object> legacy = new LinkedHashMap<>();
        legacy.put("id", 5L);
        legacy.put("exam_id", 7L);
        legacy.put("exam_title", "Goethe B1 Set 1");
        legacy.put("started_at", started);
        legacy.put("finished_at", null);
        legacy.put("total_score", null);
        legacy.put("passed", null);
        legacy.put("status", "IN_PROGRESS");
        legacy.put("detailed_scores_json", null);
        legacy.put("weak_areas", null);
        assertSameJson(new ExamAttemptDto(5L, 7L, "Goethe B1 Set 1", started, null, null, null,
                "IN_PROGRESS", null, null), legacy);
    }

    @Test
    @DisplayName("ExamResultDto == legacy map (title key, completed attempt)")
    void resultEqualsLegacyMap() throws Exception {
        Date started = new Date(1_718_866_800_000L);
        Date finished = new Date(1_718_870_400_000L);
        Map<String, Object> legacy = new LinkedHashMap<>();
        legacy.put("id", 5L);
        legacy.put("exam_id", 7L);
        legacy.put("title", "Goethe B1 Set 1");
        legacy.put("started_at", started);
        legacy.put("finished_at", finished);
        legacy.put("total_score", 72);
        legacy.put("passed", true);
        legacy.put("status", "COMPLETED");
        legacy.put("detailed_scores_json", "{\"LESEN\":{}}");
        legacy.put("weak_areas", "[\"SCHREIBEN\"]");
        assertSameJson(new ExamResultDto(5L, 7L, "Goethe B1 Set 1", started, finished, 72, true,
                "COMPLETED", "{\"LESEN\":{}}", "[\"SCHREIBEN\"]"), legacy);
    }

    @Test
    @DisplayName("ExamRecommendationDto == legacy map (camelCase top + snake_case examStats)")
    void recommendationEqualsLegacyMap() throws Exception {
        Date last = new Date(1_718_866_800_000L);
        Map<String, Object> statRow = new LinkedHashMap<>();
        statRow.put("exam_id", 7L);
        statRow.put("title", "Set 1");
        statRow.put("total_attempts", 3L);
        statRow.put("completed_attempts", 2L);
        statRow.put("best_score", 85);
        statRow.put("last_attempted_at", last);
        Map<String, Object> legacy = new LinkedHashMap<>();
        legacy.put("recommendedExamId", 7L);
        legacy.put("cefrLevel", "B1");
        legacy.put("examStats", List.of(statRow));

        var dto = new ExamRecommendationDto(7L, "B1",
                List.of(ExamStatDto.from(new LinkedHashMap<>(statRow))));
        assertSameJson(dto, legacy);
    }
}
