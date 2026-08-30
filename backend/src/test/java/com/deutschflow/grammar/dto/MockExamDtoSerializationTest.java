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

    // Mirrors the app config (spring.jackson.serialization.write-dates-as-timestamps:false, plus
    // the JSR-310 module Spring Boot registers — ExamStartDto carries Instant since V285). The
    // SAME mapper serializes both sides of each equivalence check, so any date-format detail cancels
    // out and the assertion proves keys/values/null-handling match the old map exactly.
    private final ObjectMapper omd = new ObjectMapper()
            .registerModule(new com.fasterxml.jackson.datatype.jsr310.JavaTimeModule())
            .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);

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
    @DisplayName("ExamStartDto keeps the legacy snake_case keys, extended by V285 timing fields")
    void startNewAttemptKeepsLegacyKeysPlusTiming() throws Exception {
        Date ts = new Date(1_718_866_800_000L);
        java.time.Instant now = java.time.Instant.ofEpochMilli(1_718_866_900_000L);
        java.time.Instant deadline = java.time.Instant.ofEpochMilli(1_718_872_200_000L);
        var json = omd.writeValueAsString(
                new ExamStartDto(5L, 7L, ts, "IN_PROGRESS", "{\"sections\":[]}", 90,
                        now, deadline, 5300L, null));
        assertThat(json)
                .contains("\"id\":5")
                .contains("\"exam_id\":7")
                .contains("\"started_at\":")
                .contains("\"status\":\"IN_PROGRESS\"")
                .contains("\"sections_json\":\"{\\\"sections\\\":[]}\"")
                .contains("\"time_limit_minutes\":90")
                .contains("\"server_now\":")
                .contains("\"deadline_at\":")
                .contains("\"remaining_seconds\":5300")
                .doesNotContain("\"draft\"")           // no autosave yet → key absent
                .doesNotContain("examId")
                .doesNotContain("timeLimitMinutes");
    }

    @Test
    @DisplayName("ExamStartDto (resume, V285) returns full metadata + the autosaved draft")
    void startResumeCarriesDraft() throws Exception {
        Date ts = new Date(1_718_866_800_000L);
        Date savedAt = new Date(1_718_866_890_000L);
        var draft = new ExamDraftDto("{\"q1\":\"a\"}", 1, 4, 3L, savedAt);
        var json = omd.writeValueAsString(
                new ExamStartDto(5L, 7L, ts, "IN_PROGRESS", "{\"sections\":[]}", 90,
                        java.time.Instant.ofEpochMilli(1_718_866_900_000L),
                        java.time.Instant.ofEpochMilli(1_718_872_200_000L), 5300L, draft));
        // The pre-V285 "reusing returns only id" omission was a resume bug (audit C-02):
        // a second device could not rebuild the attempt. Resume now carries everything.
        assertThat(json)
                .contains("\"exam_id\":7")
                .contains("\"status\":\"IN_PROGRESS\"")
                .contains("\"draft\":{")
                .contains("\"answers_json\":\"{\\\"q1\\\":\\\"a\\\"}\"")
                .contains("\"section_index\":1")
                .contains("\"question_index\":4")
                .contains("\"version\":3")
                .contains("\"saved_at\":")
                .doesNotContain("answersJson")
                .doesNotContain("sectionIndex");
    }

    @Test
    @DisplayName("ExamStartDto omits timing keys when the exam has no time limit")
    void startOmitsTimingWithoutLimit() throws Exception {
        Date ts = new Date(1_718_866_800_000L);
        var json = omd.writeValueAsString(
                new ExamStartDto(5L, 7L, ts, "IN_PROGRESS", "{\"sections\":[]}", null,
                        java.time.Instant.ofEpochMilli(1_718_866_900_000L), null, null, null));
        assertThat(json)
                .doesNotContain("deadline_at")
                .doesNotContain("remaining_seconds")
                .doesNotContain("time_limit_minutes");
    }

    @Test
    @DisplayName("ExamDraftSaveDto emits version/saved_at/server_now/deadline_at/remaining_seconds")
    void draftSaveDtoKeys() throws Exception {
        var json = omd.writeValueAsString(new ExamDraftSaveDto(
                4L, new Date(1_718_866_890_000L),
                java.time.Instant.ofEpochMilli(1_718_866_900_000L),
                java.time.Instant.ofEpochMilli(1_718_872_200_000L), 5300L));
        assertThat(json)
                .contains("\"version\":4")
                .contains("\"saved_at\":")
                .contains("\"server_now\":")
                .contains("\"deadline_at\":")
                .contains("\"remaining_seconds\":5300")
                .doesNotContain("savedAt")
                .doesNotContain("serverNow");
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
