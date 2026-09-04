package com.deutschflow.grammar.service;

import com.deutschflow.ai.AiTextService;
import com.deutschflow.grammar.dto.GrammarPracticeSuggestionsDto;
import com.deutschflow.speaking.exception.AiServiceException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

/**
 * QA F-7: {@code suggestPracticeByCefr} must parse the model's JSON into the web-facing
 * {suggestions:[{topic,description,example}]} shape, clamp the count, and degrade gracefully on
 * malformed output instead of throwing.
 */
@ExtendWith(MockitoExtension.class)
class AIGrammarServiceUnitTest {

    @Mock AiTextService aiTextService;

    private AIGrammarService service() {
        return new AIGrammarService(aiTextService, new ObjectMapper());
    }

    @Test
    void parsesModelJsonIntoSuggestions() {
        when(aiTextService.generate(anyString(), anyString(), anyInt(), anyDouble())).thenReturn("""
                {"suggestions":[
                  {"topic":"Artikel","description":"Luyện der/die/das.","example":"Der Tisch."},
                  {"topic":"Perfekt","description":"Chia thì hoàn thành.","example":"Ich habe gegessen."}
                ]}""");

        GrammarPracticeSuggestionsDto out = service().suggestPracticeByCefr("A2", 6);

        assertThat(out.suggestions()).hasSize(2);
        assertThat(out.suggestions().get(0).topic()).isEqualTo("Artikel");
        assertThat(out.suggestions().get(0).description()).isEqualTo("Luyện der/die/das.");
        assertThat(out.suggestions().get(1).example()).isEqualTo("Ich habe gegessen.");
    }

    @Test
    void extractsJsonEvenWhenModelWrapsItInProse() {
        when(aiTextService.generate(anyString(), anyString(), anyInt(), anyDouble())).thenReturn(
                "Hier sind die Übungen: {\"suggestions\":[{\"topic\":\"Dativ\",\"description\":\"x\",\"example\":\"y\"}]} viel Erfolg!");

        GrammarPracticeSuggestionsDto out = service().suggestPracticeByCefr("B1", 6);

        assertThat(out.suggestions()).hasSize(1);
        assertThat(out.suggestions().get(0).topic()).isEqualTo("Dativ");
    }

    @Test
    void clampsResultToRequestedCount() {
        when(aiTextService.generate(anyString(), anyString(), anyInt(), anyDouble())).thenReturn("""
                {"suggestions":[
                  {"topic":"a","description":"d","example":"e"},
                  {"topic":"b","description":"d","example":"e"},
                  {"topic":"c","description":"d","example":"e"}
                ]}""");

        // count=2 → even though the model returned 3, only 2 are kept.
        assertThat(service().suggestPracticeByCefr("A1", 2).suggestions()).hasSize(2);
    }

    @Test
    void malformedModelOutputDegradesToEmptyList() {
        when(aiTextService.generate(anyString(), anyString(), anyInt(), anyDouble()))
                .thenReturn("das ist kein JSON");

        assertThat(service().suggestPracticeByCefr("A1", 6).suggestions()).isEmpty();
    }

    @Test
    void unknownCefrLevelFallsBackToA1_andStillWorks() {
        when(aiTextService.generate(anyString(), anyString(), anyInt(), anyDouble()))
                .thenReturn("{\"suggestions\":[{\"topic\":\"t\",\"description\":\"d\",\"example\":\"e\"}]}");

        // "Z9" is not a real CEFR level → normalized to A1, must not throw.
        assertThat(service().suggestPracticeByCefr("Z9", null).suggestions()).hasSize(1);
    }

    @Test
    void aiFailurePropagatesAsAiServiceException() {
        when(aiTextService.generate(anyString(), anyString(), anyInt(), anyDouble()))
                .thenThrow(new AiServiceException("provider down"));

        assertThatThrownBy(() -> service().suggestPracticeByCefr("A1", 6))
                .isInstanceOf(AiServiceException.class);
    }
}
