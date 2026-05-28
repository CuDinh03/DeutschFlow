package com.deutschflow.grammar.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.*;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("Exam Scoring Service")
class ExamScoringServiceTest {

    private ExamScoringService scoringService;

    @BeforeEach
    void setUp() {
        scoringService = new ExamScoringService();
    }

    @Test
    @DisplayName("scores LESEN section correctly")
    void scoreLesenSection_correctAnswers_returnsCorrectScore() {
        // Arrange
        Map<String, Object> answers = new HashMap<>();
        answers.put("L1-1", "richtig");
        answers.put("L1-2", "falsch");
        answers.put("L1-3", "richtig");

        Map<String, Object> examSection = new HashMap<>();
        Map<String, Object> teil = new HashMap<>();
        teil.put("items", List.of(
            Map.of("id", "L1-1", "correct", "richtig"),
            Map.of("id", "L1-2", "correct", "falsch"),
            Map.of("id", "L1-3", "correct", "richtig"),
            Map.of("id", "L1-4", "correct", "richtig")
        ));
        examSection.put("teile", Map.of("1", teil));

        // Act
        int score = scoringService.scoreLesenSection(answers, examSection);

        // Assert
        assertEquals(3, score, "Should score 3/4 correct answers");
    }

    @Test
    @DisplayName("caps LESEN score at 25 points maximum")
    void scoreLesenSection_manyQuestions_cappedAtMax() {
        // Arrange
        Map<String, Object> answers = new HashMap<>();
        Map<String, Object> examSection = new HashMap<>();
        Map<String, Object> teil = new HashMap<>();

        List<Map<String, Object>> items = new ArrayList<>();
        for (int i = 0; i < 30; i++) {
            items.add(Map.of("id", "L-" + i, "correct", "A"));
            answers.put("L-" + i, "A");
        }
        teil.put("items", items);
        examSection.put("teile", Map.of("1", teil));

        // Act
        int score = scoringService.scoreLesenSection(answers, examSection);

        // Assert
        assertEquals(25, score, "Score should be capped at 25");
    }

    @Test
    @DisplayName("scores HOEREN section correctly")
    void scoreHoerenSection_correctAnswers_returnsCorrectScore() {
        // Arrange
        Map<String, Object> answers = new HashMap<>();
        answers.put("H1-1", "B");
        answers.put("H1-2", "C");
        answers.put("H1-3", "C");

        Map<String, Object> examSection = new HashMap<>();
        Map<String, Object> teil = new HashMap<>();
        teil.put("items", List.of(
            Map.of("id", "H1-1", "correct", "B"),
            Map.of("id", "H1-2", "correct", "C"),
            Map.of("id", "H1-3", "correct", "C")
        ));
        examSection.put("teile", List.of(teil));

        // Act
        int score = scoringService.scoreHoerenSection(answers, examSection);

        // Assert
        assertEquals(3, score, "Should score 3/3 correct answers");
    }

    @Test
    @DisplayName("identifies weak areas correctly")
    void identifyWeakAreas_lowScores_returnsWeakSections() {
        // Arrange
        Map<String, Object> detailedScores = new HashMap<>();
        detailedScores.put("LESEN", Map.of("total", 20, "max", 25)); // 80% - strong
        detailedScores.put("HOEREN", Map.of("total", 12, "max", 25)); // 48% - weak
        detailedScores.put("SCHREIBEN", Map.of("total", 15, "max", 25)); // 60% - borderline
        detailedScores.put("SPRECHEN", Map.of("total", 8, "max", 25)); // 32% - weak

        // Act
        List<String> weakAreas = scoringService.identifyWeakAreas(detailedScores);

        // Assert
        assertTrue(weakAreas.contains("HOEREN"), "HOEREN should be identified as weak");
        assertTrue(weakAreas.contains("SPRECHEN"), "SPRECHEN should be identified as weak");
        assertFalse(weakAreas.contains("LESEN"), "LESEN should not be weak");
    }

    @Test
    @DisplayName("calculates total score correctly")
    void calculateTotalScore_allSections_returnsSumOfScores() {
        // Arrange
        Map<String, Object> detailedScores = new HashMap<>();
        detailedScores.put("LESEN", Map.of("total", 23, "max", 25));
        detailedScores.put("HOEREN", Map.of("total", 25, "max", 25));
        detailedScores.put("SCHREIBEN", Map.of("total", 18, "max", 25));
        detailedScores.put("SPRECHEN", Map.of("total", 20, "max", 25));

        // Act
        int total = scoringService.calculateTotalScore(detailedScores);

        // Assert
        assertEquals(86, total, "Total should be 23+25+18+20=86");
    }

    @Test
    @DisplayName("determines pass/fail correctly")
    void isPassed_scoresAboveAndBelow60_returnsCorrectResult() {
        // Assert
        assertTrue(scoringService.isPassed(60), "Score 60 should pass");
        assertTrue(scoringService.isPassed(75), "Score 75 should pass");
        assertFalse(scoringService.isPassed(59), "Score 59 should fail");
        assertFalse(scoringService.isPassed(0), "Score 0 should fail");
    }

    @Test
    @DisplayName("scores form fields correctly")
    void scoreSchreibenSection_formFields_returnsCorrectScore() {
        // Arrange
        Map<String, Object> answers = new HashMap<>();
        answers.put("form_0", "Anna");
        answers.put("form_1", "Müller");
        answers.put("form_2", "1990-05-15");
        // form_3 is missing

        Map<String, Object> examSection = new HashMap<>();
        Map<String, Object> teil = new HashMap<>();
        teil.put("type", "FILL_FORM");
        teil.put("form_fields", List.of(
            Map.of("field", "Vorname"),
            Map.of("field", "Nachname"),
            Map.of("field", "Geburtsdatum"),
            Map.of("field", "Wohnort")
        ));
        examSection.put("teile", List.of(teil));

        // Act
        Map<String, Object> scores = scoringService.scoreSchreibenSection(answers, examSection);

        // Assert
        assertNotNull(scores.get("teil1_form"), "Should have teil1 form score");
        assertTrue((Integer) scores.get("teil1_form") > 0, "Should have partial score for 3/4 filled");
        Map<String, Object> teil2 = (Map<String, Object>) scores.get("teil2_email");
        assertEquals("PENDING_AI_EVALUATION", teil2.get("status"), "Teil2 should be pending AI");
    }

    @Test
    @DisplayName("builds detailed scores JSON structure")
    void buildDetailedScoresJson_allSections_returnsProperStructure() {
        // Arrange
        int lesenScore = 23;
        int hoerenScore = 25;
        Map<String, Object> schreibenScores = Map.of("total", 18, "max", 25);
        Map<String, Object> sprechenScores = Map.of("total", 20, "max", 25);

        // Act
        Map<String, Object> result = scoringService.buildDetailedScoresJson(
            lesenScore, hoerenScore, schreibenScores, sprechenScores);

        // Assert
        assertNotNull(result.get("LESEN"), "Should have LESEN section");
        assertNotNull(result.get("HOEREN"), "Should have HOEREN section");
        assertNotNull(result.get("SCHREIBEN"), "Should have SCHREIBEN section");
        assertNotNull(result.get("SPRECHEN"), "Should have SPRECHEN section");

        Map<String, Object> lesenData = (Map<String, Object>) result.get("LESEN");
        assertEquals(23, lesenData.get("total"), "LESEN total should be 23");
        assertEquals(92, lesenData.get("percentage"), "LESEN percentage should be 92");
    }

    @Test
    @DisplayName("handles case-insensitive answer comparison")
    void scoreLesenSection_caseInsensitive_scoresCorrectly() {
        // Arrange
        Map<String, Object> answers = new HashMap<>();
        answers.put("L1-1", "RICHTIG");
        answers.put("L1-2", "Falsch");

        Map<String, Object> examSection = new HashMap<>();
        Map<String, Object> teil = new HashMap<>();
        teil.put("items", List.of(
            Map.of("id", "L1-1", "correct", "richtig"),
            Map.of("id", "L1-2", "correct", "falsch")
        ));
        examSection.put("teile", Map.of("1", teil));

        // Act
        int score = scoringService.scoreLesenSection(answers, examSection);

        // Assert
        assertEquals(2, score, "Should handle case-insensitive comparison");
    }

    @Test
    @DisplayName("handles missing answers gracefully")
    void scoreLesenSection_missingAnswers_scoresOnlyProvided() {
        // Arrange
        Map<String, Object> answers = new HashMap<>();
        answers.put("L1-1", "A");
        // L1-2 not answered

        Map<String, Object> examSection = new HashMap<>();
        Map<String, Object> teil = new HashMap<>();
        teil.put("items", List.of(
            Map.of("id", "L1-1", "correct", "A"),
            Map.of("id", "L1-2", "correct", "B")
        ));
        examSection.put("teile", Map.of("1", teil));

        // Act
        int score = scoringService.scoreLesenSection(answers, examSection);

        // Assert
        assertEquals(1, score, "Should only score provided answers");
    }
}
