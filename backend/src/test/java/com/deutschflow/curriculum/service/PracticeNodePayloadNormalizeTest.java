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
 *
 * <p>The shell is not the only shape the model improvises: it wraps because
 * {@code response_format=json_object} forbids a top-level array, so it may equally invent its
 * own key ({@code "uebungen"}, {@code "aufgaben"}…) — prod 25/08, node 114 HOEREN. Those cases
 * are covered below too. The root fix is the prompt contract in
 * {@link PracticeNodePromptBuilder}; this normalization is the safety net.
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

    @Test
    @DisplayName("a model-invented key is renamed to exercises (prod 25/08, node 114 HOEREN)")
    void renamesInventedKeyToExercises() throws Exception {
        JsonNode out = norm("""
                {"uebungen":[{"type":"LISTEN_AND_CHOOSE","correct_index":1},{"type":"DICTATION"}]}
                """);

        assertThat(out.has("uebungen")).isFalse();
        assertThat(out.get("exercises").isArray()).isTrue();
        assertThat(PracticeNodeService.countExercises(out)).isEqualTo(2);
    }

    @Test
    @DisplayName("renaming an invented key keeps LESEN's reading_passage")
    void renameKeepsReadingPassage() throws Exception {
        JsonNode out = norm("""
                {"reading_passage":{"text_de":"Liebe Frau Weber","text_type":"E-Mail"},
                 "aufgaben":[{"type":"READ_AND_CHOOSE","correct_index":0}]}
                """);

        assertThat(out.get("reading_passage").get("text_type").asText()).isEqualTo("E-Mail");
        assertThat(PracticeNodeService.countExercises(out)).isEqualTo(1);
    }

    @Test
    @DisplayName("countExercises returns 0 for payloads with no exercises — gate against dead sessions")
    void countsZeroForEmptyPayloads() throws Exception {
        // generatePracticeSession refuses to INSERT when this is 0: a stored 0-exercise session
        // is a dead end for the learner (nothing to submit, no regenerate button).
        assertThat(PracticeNodeService.countExercises(M.readTree("[]"))).isZero();
        assertThat(PracticeNodeService.countExercises(M.readTree("{\"exercises\":[]}"))).isZero();
        assertThat(PracticeNodeService.countExercises(M.readTree("{\"status\":\"ok\"}"))).isZero();
        assertThat(PracticeNodeService.countExercises(M.readTree(""))).isZero();
    }

    @Test
    @DisplayName("countExercises reads the legacy bare-array shape")
    void countsLegacyBareArray() throws Exception {
        assertThat(PracticeNodeService.countExercises(M.readTree("[{\"type\":\"DICTATION\"}]"))).isEqualTo(1);
    }
}
