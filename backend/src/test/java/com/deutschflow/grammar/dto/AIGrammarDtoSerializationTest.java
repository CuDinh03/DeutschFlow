package com.deutschflow.grammar.dto;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Guards the byte-level JSON contract of the AIGrammar typed responses that the web client reads
 * ({@code lib/localAiApi.ts}, {@code v2/student/grammar/ai}). {@link GrammarPracticeSuggestionsDto}
 * MUST serialise to {@code {suggestions:[{topic,description,example}]}} (QA F-7).
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
    @DisplayName("GrammarPracticeSuggestionsDto == {suggestions:[{topic,description,example}]}")
    void practiceSuggestionsMatchWebShape() throws Exception {
        var dto = new GrammarPracticeSuggestionsDto(List.of(
                new GrammarPracticeSuggestionsDto.Suggestion("Dativ", "Luyện giới từ đi với Dativ.", "Ich helfe dir.")));
        assertSameJson(dto, Map.of("suggestions", List.of(
                Map.of("topic", "Dativ", "description", "Luyện giới từ đi với Dativ.", "example", "Ich helfe dir."))));
    }
}
