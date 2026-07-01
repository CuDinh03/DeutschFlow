package com.deutschflow.curriculum.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class NodeExerciseGraderTest {

    private final ObjectMapper mapper = new ObjectMapper();

    private static final String CONTENT = """
        {
          "exercises": {
            "theory_gate": [
              { "id": "t1", "type": "MULTIPLE_CHOICE", "options": ["a","b","c"], "correct": 1 }
            ],
            "practice": [
              { "id": "p1", "type": "FILL_BLANK", "answer": "komme", "accept_also": ["komm"] },
              { "id": "p2", "type": "MULTIPLE_CHOICE", "options": ["x","y"], "correct": 0 },
              { "id": "info", "type": "THEORY_CARD", "text": "not scored" }
            ]
          }
        }
        """;

    @Test
    @DisplayName("all correct → 100%, scores only the 3 deterministic items")
    void allCorrect_full() {
        var answers = Map.<String, Object>of(
                "t1", Map.of("choice", 1),
                "p1", Map.of("text", "komme"),
                "p2", Map.of("choice", 0));

        var result = NodeExerciseGrader.grade(mapper, CONTENT, answers);

        assertThat(result.scoredCount()).isEqualTo(3); // THEORY_CARD excluded
        assertThat(result.correctCount()).isEqualTo(3);
        assertThat(result.percent()).isEqualTo(100);
        assertThat(result.gradeable()).isTrue();
    }

    @Test
    @DisplayName("a wrong multiple-choice lowers the score (cannot self-report 100%)")
    void oneWrong_partial() {
        var answers = Map.<String, Object>of(
                "t1", Map.of("choice", 0),   // wrong (correct=1)
                "p1", Map.of("text", "komme"),
                "p2", Map.of("choice", 0));

        var result = NodeExerciseGrader.grade(mapper, CONTENT, answers);

        assertThat(result.correctCount()).isEqualTo(2);
        assertThat(result.percent()).isEqualTo(67); // round(2/3*100)
    }

    @Test
    @DisplayName("fill-blank accepts accept_also and normalizes case/punctuation/whitespace")
    void fillBlank_acceptAlsoAndNormalization() {
        var accepted = NodeExerciseGrader.grade(mapper, CONTENT, Map.of(
                "t1", Map.of("choice", 1),
                "p1", Map.of("text", "  KOMM!  "), // accept_also "komm", normalized
                "p2", Map.of("choice", 0)));
        assertThat(accepted.percent()).isEqualTo(100);

        var wrong = NodeExerciseGrader.grade(mapper, CONTENT, Map.of(
                "t1", Map.of("choice", 1),
                "p1", Map.of("text", "gehe"),
                "p2", Map.of("choice", 0)));
        assertThat(wrong.correctCount()).isEqualTo(2);
    }

    @Test
    @DisplayName("missing/blank answers count as wrong, not as a free pass")
    void missingAnswers_areWrong() {
        var result = NodeExerciseGrader.grade(mapper, CONTENT, Map.of(
                "t1", Map.of("choice", 1))); // p1, p2 unanswered

        assertThat(result.scoredCount()).isEqualTo(3);
        assertThat(result.correctCount()).isEqualTo(1);
        assertThat(result.percent()).isEqualTo(33);
    }

    @Test
    @DisplayName("bare int / bare string answer shapes are accepted")
    void bareAnswerShapes() {
        var result = NodeExerciseGrader.grade(mapper, CONTENT, Map.of(
                "t1", 1,
                "p1", "komme",
                "p2", 0));
        assertThat(result.percent()).isEqualTo(100);
    }

    @Test
    @DisplayName("node with no deterministic items is not gradeable (caller falls back)")
    void noScoredItems_notGradeable() {
        String speakingContent = """
            { "exercises": { "practice": [
              { "id": "s1", "type": "SPEAKING_RESPONSE", "question_de": "Wie heißen Sie?" }
            ] } }
            """;
        var result = NodeExerciseGrader.grade(mapper, speakingContent, Map.of("s1", Map.of("text", "x")));

        assertThat(result.gradeable()).isFalse();
        assertThat(result.percent()).isEqualTo(-1);
    }

    @Test
    @DisplayName("null answers, blank content, and malformed JSON are not gradeable")
    void nullBlankMalformed_notGradeable() {
        assertThat(NodeExerciseGrader.grade(mapper, CONTENT, null).gradeable()).isFalse();
        assertThat(NodeExerciseGrader.grade(mapper, "", Map.of()).gradeable()).isFalse();
        assertThat(NodeExerciseGrader.grade(mapper, "{not valid json", Map.of("t1", 1)).gradeable()).isFalse();
    }

    @Test
    @DisplayName("exercises without ids are skipped safely")
    void exerciseWithoutId_skipped() {
        String content = """
            { "exercises": { "practice": [
              { "type": "MULTIPLE_CHOICE", "options": ["a","b"], "correct": 0 },
              { "id": "ok", "type": "MULTIPLE_CHOICE", "options": ["a","b"], "correct": 1 }
            ] } }
            """;
        var result = NodeExerciseGrader.grade(mapper, content, Map.of("ok", Map.of("choice", 1)));

        assertThat(result.scoredCount()).isEqualTo(1);
        assertThat(result.percent()).isEqualTo(100);
    }

    // ── countScored: distinguishes theory-only nodes (mark-as-learned) from graded ones ──

    @Test
    @DisplayName("countScored counts MC + FILL_BLANK only, ignoring THEORY_CARD and answers")
    void countScored_countsGradeableOnly() {
        assertThat(NodeExerciseGrader.countScored(mapper, CONTENT)).isEqualTo(3);
    }

    @Test
    @DisplayName("countScored is 0 for a theory-only node (alphabet-style: theory_cards, no exercises)")
    void countScored_theoryOnly_isZero() {
        String theoryOnly = """
            {
              "theory_cards": [ { "type": "GRAMMAR", "title": { "vi": "Các chữ cái" } } ],
              "exercises": { "theory_gate": [], "practice": [] }
            }
            """;
        assertThat(NodeExerciseGrader.countScored(mapper, theoryOnly)).isZero();
    }

    @Test
    @DisplayName("countScored is 0 for self-check-only nodes (TRANSLATE/REORDER are not gradeable)")
    void countScored_selfCheckOnly_isZero() {
        String selfCheck = """
            { "exercises": { "practice": [
              { "id": "r1", "type": "REORDER", "words": ["a","b"], "correct_order": ["a","b"] },
              { "id": "tr1", "type": "TRANSLATE", "sentence": "Hallo", "answer": "Xin chào" }
            ] } }
            """;
        assertThat(NodeExerciseGrader.countScored(mapper, selfCheck)).isZero();
    }

    @Test
    @DisplayName("countScored handles null / blank / malformed content safely")
    void countScored_nullBlankMalformed() {
        assertThat(NodeExerciseGrader.countScored(mapper, null)).isZero();
        assertThat(NodeExerciseGrader.countScored(mapper, "")).isZero();
        assertThat(NodeExerciseGrader.countScored(mapper, "{not valid json")).isZero();
    }
}
