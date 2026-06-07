package com.deutschflow.curriculum.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class PracticeExerciseGraderTest {

    private final ObjectMapper mapper = new ObjectMapper();

    // Bare-array form (as stored in practice_node_sessions.exercises_json):
    // [0] MC, [1] fill (+accept_also), [2] true/false, [3] free speaking
    private static final String EXERCISES = """
        [
          { "type": "LISTEN_AND_CHOOSE", "options": ["13 Uhr","14 Uhr"], "correct_index": 1 },
          { "type": "LISTEN_AND_FILL", "correct_answer": "Morgen", "accept_also": ["morgen"] },
          { "type": "READ_TRUE_FALSE", "correct_answer": false },
          { "type": "SPEAKING_RESPONSE", "question_de": "Wie heißen Sie?" }
        ]
        """;

    private static Map<String, Object> cell(Object answer) {
        return Map.of("answer", answer);
    }

    @Test
    @DisplayName("all correct → 100% across all four items")
    void allCorrect() {
        var answers = Map.<String, Object>of(
                "0", cell(1),
                "1", cell("Morgen"),
                "2", cell("false"),
                "3", cell("spoken"));

        var result = PracticeExerciseGrader.grade(mapper, EXERCISES, answers);

        assertThat(result.total()).isEqualTo(4);
        assertThat(result.correctCount()).isEqualTo(4);
        assertThat(result.percent()).isEqualTo(100);
    }

    @Test
    @DisplayName("SECURITY: a client-supplied correct=true flag is ignored — wrong answers stay wrong")
    void clientCorrectFlagIgnored() {
        // Tampered client claims everything is correct but submits a wrong MC answer.
        var answers = Map.<String, Object>of(
                "0", Map.of("answer", 0, "correct", true),   // wrong (correct_index=1), lies correct=true
                "1", Map.of("answer", "falsch", "correct", true),
                "2", Map.of("answer", "true", "correct", true),
                "3", Map.of("answer", "spoken", "correct", true));

        var result = PracticeExerciseGrader.grade(mapper, EXERCISES, answers);

        // Only the speaking item counts; the three lied-about items are re-graded as wrong.
        assertThat(result.correctCount()).isEqualTo(1);
        assertThat(result.percent()).isEqualTo(25);
    }

    @Test
    @DisplayName("fill accepts accept_also; normalization is lowercase+trim only (punctuation matters)")
    void fillNormalization() {
        var lowerAccepted = PracticeExerciseGrader.grade(mapper, EXERCISES, Map.of(
                "0", cell(1), "1", cell("  MORGEN  "), "2", cell("false"), "3", cell("spoken")));
        assertThat(lowerAccepted.correctCount()).isEqualTo(4);

        // Trailing punctuation is NOT stripped (mirrors the web runner) → marked wrong.
        var punct = PracticeExerciseGrader.grade(mapper, EXERCISES, Map.of(
                "0", cell(1), "1", cell("Morgen."), "2", cell("false"), "3", cell("spoken")));
        assertThat(punct.correctCount()).isEqualTo(3);
    }

    @Test
    @DisplayName("bare answer values (not wrapped in {answer,correct}) are accepted")
    void bareAnswerValues() {
        var result = PracticeExerciseGrader.grade(mapper, EXERCISES, Map.of(
                "0", 1, "1", "Morgen", "2", "false", "3", "spoken"));
        assertThat(result.percent()).isEqualTo(100);
    }

    @Test
    @DisplayName("free-response without a key and without 'spoken' is wrong; missing answers are wrong")
    void freeResponseAndMissing() {
        var result = PracticeExerciseGrader.grade(mapper, EXERCISES, Map.of(
                "0", cell(1),
                "3", cell("Ich heiße Anna")));  // 1 missing, 2 missing, 3 not "spoken"

        assertThat(result.total()).isEqualTo(4);
        assertThat(result.correctCount()).isEqualTo(1); // only the MC
        assertThat(result.percent()).isEqualTo(25);
    }

    @Test
    @DisplayName("object form { exercises: [...] } is also supported")
    void objectWrapperForm() {
        String wrapped = "{ \"exercises\": " + EXERCISES + " }";
        var result = PracticeExerciseGrader.grade(mapper, wrapped, Map.of(
                "0", cell(1), "1", cell("Morgen"), "2", cell("false"), "3", cell("spoken")));
        assertThat(result.percent()).isEqualTo(100);
    }

    @Test
    @DisplayName("null answers, blank content, and malformed JSON are not gradeable")
    void notGradeable() {
        assertThat(PracticeExerciseGrader.grade(mapper, EXERCISES, null).gradeable()).isFalse();
        assertThat(PracticeExerciseGrader.grade(mapper, "", Map.of()).gradeable()).isFalse();
        assertThat(PracticeExerciseGrader.grade(mapper, "[not json", Map.of("0", 1)).gradeable()).isFalse();
    }
}
