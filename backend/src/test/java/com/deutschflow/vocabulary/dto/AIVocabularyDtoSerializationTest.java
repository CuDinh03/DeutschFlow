package com.deutschflow.vocabulary.dto;

import com.deutschflow.vocabulary.service.AIVocabularyService.QuizQuestion;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Guards the byte-level JSON contract of the AIVocabulary typing round: the seven DTOs replaced raw
 * {@code Map<String,Object>}/{@code Map<String,String>} responses, so the keys/values (incl. list
 * payloads and the nested quiz {@code {word, content}}) MUST stay identical to the live web client
 * reads ({@code lib/vocabAiApi.ts} / {@code lib/localAiApi.ts}).
 */
class AIVocabularyDtoSerializationTest {

    private final ObjectMapper omd = new ObjectMapper().disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);

    private void assertSameJson(Object dto, Map<String, Object> legacyMap) throws Exception {
        JsonNode fromDto = omd.readTree(omd.writeValueAsString(dto));
        JsonNode fromMap = omd.readTree(omd.writeValueAsString(legacyMap));
        assertThat(fromDto).isEqualTo(fromMap);
    }

    @Test
    @DisplayName("VocabExamplesDto == legacy Map.of(word, examples[])")
    void examplesEqualsLegacyMap() throws Exception {
        var examples = List.of("Das Haus ist groß.", "Ich kaufe ein Haus.");
        assertSameJson(new VocabExamplesDto("Haus", examples), Map.of("word", "Haus", "examples", examples));
    }

    @Test
    @DisplayName("VocabUsageDto == legacy Map.of(word, usage)")
    void usageEqualsLegacyMap() throws Exception {
        assertSameJson(new VocabUsageDto("Haus", "Neutrum; Plural: Häuser."),
                Map.of("word", "Haus", "usage", "Neutrum; Plural: Häuser."));
    }

    @Test
    @DisplayName("VocabMnemonicDto == legacy Map.of(word, mnemonic)")
    void mnemonicEqualsLegacyMap() throws Exception {
        assertSameJson(new VocabMnemonicDto("Haus", "House → Haus."),
                Map.of("word", "Haus", "mnemonic", "House → Haus."));
    }

    @Test
    @DisplayName("VocabSimilarDto == legacy Map.of(word, similarWords[])")
    void similarEqualsLegacyMap() throws Exception {
        var similar = List.of("Gebäude", "Wohnung", "Heim");
        assertSameJson(new VocabSimilarDto("Haus", similar), Map.of("word", "Haus", "similarWords", similar));
    }

    @Test
    @DisplayName("VocabStoryDto == legacy Map.of(words[], story)")
    void storyEqualsLegacyMap() throws Exception {
        var words = List.of("Haus", "Garten");
        assertSameJson(new VocabStoryDto(words, "Das Haus hat einen Garten."),
                Map.of("words", words, "story", "Das Haus hat einen Garten."));
    }

    @Test
    @DisplayName("VocabEtymologyDto == legacy Map.of(word, etymology)")
    void etymologyEqualsLegacyMap() throws Exception {
        assertSameJson(new VocabEtymologyDto("Haus", "Althochdeutsch 'hūs'."),
                Map.of("word", "Haus", "etymology", "Althochdeutsch 'hūs'."));
    }

    @Test
    @DisplayName("VocabQuizDto == legacy Map.of(words[], questions[{word, content}])")
    void quizEqualsLegacyMap() throws Exception {
        QuizQuestion q = new QuizQuestion();
        q.setWord("Haus");
        q.setContent("Q: Was bedeutet 'Haus'? A) house B) car C) tree D) book Correct: A");
        var words = List.of("Haus");
        assertSameJson(new VocabQuizDto(words, List.of(q)), Map.of("words", words, "questions", List.of(q)));
    }
}
