package com.deutschflow.grammar.dto;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.Date;
import java.util.LinkedHashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Guards the byte-level JSON contract of the GrammarSyllabus DTOs (replaced raw
 * {@code Map<String,Object>}). The {@code from(Map)} factories are round-tripped against the exact
 * legacy {@code queryForList} maps so keys (snake_case), the {@code real}→{@link Float}
 * mastery_percent, and {@code timestamptz}→{@link Date} columns all stay identical.
 */
class GrammarSyllabusDtoSerializationTest {

    private final ObjectMapper omd = new ObjectMapper().disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);

    private void assertSameJson(Object dto, Map<String, Object> legacy) throws Exception {
        JsonNode a = omd.readTree(omd.writeValueAsString(dto));
        JsonNode b = omd.readTree(omd.writeValueAsString(legacy));
        assertThat(a).isEqualTo(b);
    }

    @Test
    @DisplayName("GrammarTopicDto == legacy map (Float mastery, Date last_practiced, snake_case)")
    void topicWithProgressEqualsLegacy() throws Exception {
        Map<String, Object> legacy = new LinkedHashMap<>();
        legacy.put("id", 3L);
        legacy.put("cefr_level", "A1");
        legacy.put("topic_code", "NOM");
        legacy.put("title_de", "Nominativ");
        legacy.put("title_vi", "Cách 1");
        legacy.put("title_en", "Nominative");
        legacy.put("description_vi", "Mô tả");
        legacy.put("sort_order", 1);
        legacy.put("exercises_done", 5);
        legacy.put("exercises_correct", 4);
        legacy.put("mastery_percent", 80.0f);   // real column → Float
        legacy.put("last_practiced_at", new Date(1_718_866_800_000L));
        legacy.put("total_exercises", 12L);      // COUNT(*) → bigint → Long
        assertSameJson(GrammarTopicDto.from(new LinkedHashMap<>(legacy)), legacy);
    }

    @Test
    @DisplayName("GrammarTopicDto == legacy map (no progress → null last_practiced, 0.0 mastery)")
    void topicNoProgressEqualsLegacy() throws Exception {
        Map<String, Object> legacy = new LinkedHashMap<>();
        legacy.put("id", 3L);
        legacy.put("cefr_level", "A1");
        legacy.put("topic_code", "NOM");
        legacy.put("title_de", "Nominativ");
        legacy.put("title_vi", "Cách 1");
        legacy.put("title_en", "Nominative");
        legacy.put("description_vi", null);
        legacy.put("sort_order", 1);
        legacy.put("exercises_done", 0);
        legacy.put("exercises_correct", 0);
        legacy.put("mastery_percent", 0.0f);
        legacy.put("last_practiced_at", null);
        legacy.put("total_exercises", 0L);
        assertSameJson(GrammarTopicDto.from(new LinkedHashMap<>(legacy)), legacy);
    }

    @Test
    @DisplayName("GrammarExerciseDto == legacy map (snake_case, question_json string)")
    void exerciseEqualsLegacy() throws Exception {
        Map<String, Object> legacy = new LinkedHashMap<>();
        legacy.put("id", 9L);
        legacy.put("exercise_type", "MULTIPLE_CHOICE");
        legacy.put("difficulty", 2);
        legacy.put("question_json", "{\"prompt\":\"...\"}");
        assertSameJson(GrammarExerciseDto.from(new LinkedHashMap<>(legacy)), legacy);
    }

    @Test
    @DisplayName("GrammarSubmitResultDto emits camelCase correct/correctAnswer/explanation")
    void submitResultCamelCase() throws Exception {
        var json = omd.writeValueAsString(new GrammarSubmitResultDto(true, "der", "Maskulin Nominativ"));
        assertThat(json)
                .contains("\"correct\":true")
                .contains("\"correctAnswer\":\"der\"")
                .contains("\"explanation\":\"Maskulin Nominativ\"")
                .doesNotContain("correct_answer");
    }

    @Test
    @DisplayName("GrammarDraftDto == legacy map (Date created_at, nullable reject_reason)")
    void draftEqualsLegacy() throws Exception {
        Map<String, Object> legacy = new LinkedHashMap<>();
        legacy.put("id", 9L);
        legacy.put("topic_id", 3L);
        legacy.put("topic_title", "Nominativ");
        legacy.put("exercise_type", "FILL_BLANK");
        legacy.put("difficulty", 1);
        legacy.put("question_json", "{}");
        legacy.put("status", "DRAFT");
        legacy.put("reject_reason", null);
        legacy.put("created_at", new Date(1_718_866_800_000L));
        assertSameJson(GrammarDraftDto.from(new LinkedHashMap<>(legacy)), legacy);
    }

    @Test
    @DisplayName("GrammarPendingReviewDto == legacy map (Boolean ai_generated, created_by, Date)")
    void pendingReviewEqualsLegacy() throws Exception {
        Map<String, Object> legacy = new LinkedHashMap<>();
        legacy.put("id", 9L);
        legacy.put("topic_id", 3L);
        legacy.put("topic_title", "Nominativ");
        legacy.put("cefr_level", "A1");
        legacy.put("exercise_type", "TRANSLATE");
        legacy.put("difficulty", 3);
        legacy.put("question_json", "{}");
        legacy.put("status", "PENDING_REVIEW");
        legacy.put("ai_generated", true);
        legacy.put("created_by", 18L);
        legacy.put("created_at", new Date(1_718_866_800_000L));
        assertSameJson(GrammarPendingReviewDto.from(new LinkedHashMap<>(legacy)), legacy);
    }
}
