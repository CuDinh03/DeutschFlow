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
}

