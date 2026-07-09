package com.deutschflow.speaking.ai;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class AiErrorSanitizerTest {

    @Test
    void sanitize_dropsStaleSpanNotInUserMessage() {
        String user = "Ich stehe nicht um 7 Uhr auf.";
        List<ErrorItem> raw = List.of(
                new ErrorItem("WORD_ORDER.V2_MAIN_CLAUSE", "BLOCKING", 0.9,
                        "Heute ich trinke Kaffee", "Heute trinke ich Kaffee",
                        "rule", "ex"),
                new ErrorItem("WORD_ORDER.V2_MAIN_CLAUSE", "BLOCKING", 0.9,
                        "Ich stehe", "Ich stehe", "rule", "ex")
        );
        assertThat(AiErrorSanitizer.sanitize(user, raw)).isEmpty();
    }

    @Test
    void sanitize_normalizesMitToDativeCode() {
        String user = "Ich gehe mit den Bus.";
        List<ErrorItem> raw = List.of(
                new ErrorItem("CASE.PREP_AKK_FUER", "MAJOR", 0.9,
                        "den Bus", "dem Bus", "rule", "ex")
        );
        List<ErrorItem> out = AiErrorSanitizer.sanitize(user, raw);
        assertThat(out).hasSize(1);
        assertThat(out.get(0).errorCode()).isEqualTo("CASE.PREP_DAT_MIT");
    }

    @Test
    void sanitize_dropsLowConfidenceMinor() {
        String user = "Ich trinke Kaffee während der Arbeit.";
        List<ErrorItem> raw = List.of(
                new ErrorItem("CASE.PREP_DAT_MIT", "MINOR", 0.35,
                        "der Arbeit", "die Arbeit", "rule", "ex")
        );
        assertThat(AiErrorSanitizer.sanitize(user, raw)).isEmpty();
    }

    @Test
    void sanitize_dropsEntriesThatExplicitlySayCorrect() {
        String user = "Ich bin nach Hause gegangen.";
        List<ErrorItem> raw = List.of(
                new ErrorItem("VERB.AUX_SEIN_HABEN_PERFEKT", "MAJOR", 0.8,
                        "Ich bin nach Hause gegangen",
                        "Ich bin nach Hause gegangen (korrekt), ...",
                        "rule", "ex")
        );
        assertThat(AiErrorSanitizer.sanitize(user, raw)).isEmpty();
    }

    @Test
    void keepCorrection_falseWhenNoGroundedErrorSurvives() {
        // Reproduces the screenshot bug: the model echoes an earlier turn's "ich hatte" error onto a
        // turn where the user typed something unrelated. The span is not in the current message, so
        // sanitize() drops it → the free-text correction must be suppressed too.
        String user = "Minor Projects ist so difficult";
        List<ErrorItem> raw = List.of(
                new ErrorItem("VERB.CONJ_PERSON_ENDING", "MAJOR", 0.9,
                        "ich hatten", "ich hatte", "rule", "ex")
        );
        List<ErrorItem> sanitized = AiErrorSanitizer.sanitize(user, raw);
        assertThat(sanitized).isEmpty();
        assertThat(AiErrorSanitizer.keepCorrection(sanitized)).isFalse();
    }

    @Test
    void keepCorrection_trueWhenGroundedErrorSurvives() {
        String user = "Ich hatten Stress.";
        List<ErrorItem> raw = List.of(
                new ErrorItem("VERB.CONJ_PERSON_ENDING", "MAJOR", 0.9,
                        "hatten", "hatte", "rule", "ex")
        );
        List<ErrorItem> sanitized = AiErrorSanitizer.sanitize(user, raw);
        assertThat(sanitized).hasSize(1);
        assertThat(AiErrorSanitizer.keepCorrection(sanitized)).isTrue();
    }

    @Test
    void keepCorrection_falseWhenListNullOrEmpty() {
        assertThat(AiErrorSanitizer.keepCorrection(null)).isFalse();
        assertThat(AiErrorSanitizer.keepCorrection(List.of())).isFalse();
    }
}

