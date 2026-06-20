package com.deutschflow.grammar.dto;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Guards the byte-level JSON contract of the AIGrammar typing round: {@link GrammarExplanationDto}
 * and {@link GrammarPracticeSuggestionDto} replaced raw {@code Map<String,String>} responses, so the
 * keys/values MUST stay identical to the live web client reads ({@code lib/localAiApi.ts}).
 */
class AIGrammarDtoSerializationTest {

    private final ObjectMapper omd = new ObjectMapper().disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);

    private void assertSameJson(Object dto, Map<String, Object> legacyMap) throws Exception {
        JsonNode fromDto = omd.readTree(omd.writeValueAsString(dto));
        JsonNode fromMap = omd.readTree(omd.writeValueAsString(legacyMap));
        assertThat(fromDto).isEqualTo(fromMap);
    }

    @Test
    @DisplayName("GrammarExplanationDto == legacy Map.of(text, explanation)")
    void explainEqualsLegacyMap() throws Exception {
        assertSameJson(new GrammarExplanationDto("Ich gehe nach Hause.", "Korrekt: Akkusativ-Richtung."),
                Map.of("text", "Ich gehe nach Hause.", "explanation", "Korrekt: Akkusativ-Richtung."));
    }

    @Test
    @DisplayName("GrammarPracticeSuggestionDto == legacy Map.of(errorType, suggestions)")
    void practiceSuggestionEqualsLegacyMap() throws Exception {
        assertSameJson(new GrammarPracticeSuggestionDto("DATIV", "Übe Wechselpräpositionen mit Dativ."),
                Map.of("errorType", "DATIV", "suggestions", "Übe Wechselpräpositionen mit Dativ."));
    }
}
