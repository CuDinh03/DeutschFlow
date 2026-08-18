package com.deutschflow.curriculum.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Contract tests for the German-only exercise language policy (product decision 18/08):
 * everything the learner sees DURING an exercise is German; the why-is-this-correct
 * explanation ships in three locales and is only revealed after submitting.
 *
 * <p>The prompt text IS the contract with the LLM — if a template drifts back to
 * asking for {@code instruction_vi}/{@code question_vi} exercise fields, generated
 * sessions silently regress to Vietnamese mid-exercise. These tests pin the field
 * names the templates request.
 */
@DisplayName("practice prompts request German-only exercises")
class PracticeNodePromptBuilderTest {

    private static String prompt(String skill) {
        return PracticeNodePromptBuilder.buildPromptForSkill(
                skill, "Das Alphabet", "A1",
                List.of("das Haus", "der Name"), "Präsens",
                List.of(), 1);
    }

    @ParameterizedTest
    @ValueSource(strings = {"HOEREN", "SPRECHEN", "LESEN", "SCHREIBEN"})
    @DisplayName("every skill: German instruction field + trilingual explanations, no *_vi exercise fields")
    void germanOnlyContract(String skill) {
        String p = prompt(skill);

        assertThat(p).contains("instruction_de");
        assertThat(p).contains("explanation_de").contains("explanation_en").contains("explanation_vi");
        assertThat(p).contains("KEIN Vietnamesisch");

        // Legacy Vietnamese exercise fields must no longer be requested from the LLM.
        assertThat(p).doesNotContain("instruction_vi");
        assertThat(p).doesNotContain("question_vi");
        assertThat(p).doesNotContain("hint_vi");
        assertThat(p).doesNotContain("grammar_rule_vi");
        assertThat(p).doesNotContain("translation_vi");
        assertThat(p).doesNotContain("situation_vi");
        assertThat(p).doesNotContain("scenario_vi");
        assertThat(p).doesNotContain("prompt_vi");
        assertThat(p).doesNotContain("text_vi_hint");
        // sentence_vi appears only as part of no field — SPEAKING_REPEAT dropped it.
        assertThat(p).doesNotContain("sentence_vi");
    }

    @Test
    @DisplayName("SCHREIBEN: the translate-from-Vietnamese type is replaced by a German-only writing type")
    void schreibenHasNoTranslateType() {
        String p = prompt("SCHREIBEN");
        assertThat(p).doesNotContain("TRANSLATE_VI_DE");
        assertThat(p).contains("WRITE_ANSWER");
    }

    @Test
    @DisplayName("still injects lesson context and anti-repetition block")
    void keepsLessonContextAndSeenBlock() {
        String withSeen = PracticeNodePromptBuilder.buildPromptForSkill(
                "LESEN", "Das Alphabet", "A1",
                List.of("das Haus"), "Präsens",
                List.of("READ_AND_CHOOSE — Wie viele Buchstaben?"), 2);
        assertThat(withSeen)
                .contains("Das Alphabet")
                .contains("A1")
                .contains("das Haus")
                .contains("NICHT WIEDERHOLEN")
                .contains("Wie viele Buchstaben?");
    }
}
