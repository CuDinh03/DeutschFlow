package com.deutschflow.curriculum.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The CONTENT-tier LLM sometimes wraps its output in a JSON-schema-style shell
 * {@code {"type":"object","content":[...]}} (seen on prod 17–18/08, sessions 33/35) —
 * the overview then counts 0 exercises and the runner renders an empty session.
 * {@link PracticeNodeService#normalizeExercisePayload} strips that shell at write time.
 */
@DisplayName("normalizeExercisePayload strips the LLM wrapper shell")
class PracticeNodePayloadNormalizeTest {

    private static final ObjectMapper M = new ObjectMapper();

    private static JsonNode norm(String json) throws Exception {
        return PracticeNodeService.normalizeExercisePayload(M.readTree(json));
    }

    @Test
    @DisplayName("unwraps {type,content:[...]} to the bare array")
    void unwrapsContentArray() throws Exception {
        JsonNode out = norm("""
                {"type":"object","content":[{"type":"SPEAKING_REPEAT","sentence_de":"Hallo"}]}
                """);
        assertThat(out.isArray()).isTrue();
        assertThat(out).hasSize(1);
        assertThat(out.get(0).get("sentence_de").asText()).isEqualTo("Hallo");
    }

    @Test
    @DisplayName("unwraps a wrapped LESEN object down to {reading_passage, exercises}")
    void unwrapsWrappedLesenObject() throws Exception {
        JsonNode out = norm("""
                {"type":"object","content":{"reading_passage":{"text_de":"Hallo"},"exercises":[{"type":"READ_TRUE_FALSE"}]}}
                """);
        assertThat(out.has("reading_passage")).isTrue();
        assertThat(out.get("exercises").isArray()).isTrue();
    }

    @Test
    @DisplayName("unwraps nested double shells")
    void unwrapsNestedShells() throws Exception {
        JsonNode out = norm("""
                {"type":"object","content":{"type":"object","content":[{"type":"DICTATION"}]}}
                """);
        assertThat(out.isArray()).isTrue();
        assertThat(out).hasSize(1);
    }

    @Test
    @DisplayName("leaves the two legit shapes untouched")
    void keepsLegitShapes() throws Exception {
        String bareArray = "[{\"type\":\"DICTATION\"}]";
        assertThat(norm(bareArray).isArray()).isTrue();

        String lesen = "{\"reading_passage\":{\"text_de\":\"Hi\"},\"exercises\":[{\"type\":\"READ_AND_FILL\"}]}";
        JsonNode out = norm(lesen);
        assertThat(out.has("reading_passage")).isTrue();
        assertThat(out.has("content")).isFalse();
    }

    @Test
    @DisplayName("an exercise object that itself has a content field is not confused with the shell")
    void doesNotEatLegitContentKey() throws Exception {
        // Object carrying `exercises` next to `content` is NOT the wrapper shape.
        JsonNode out = norm("{\"exercises\":[{\"type\":\"X\"}],\"content\":[1,2]}");
        assertThat(out.has("exercises")).isTrue();
        assertThat(out.has("content")).isTrue();
    }
}
