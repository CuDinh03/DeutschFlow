package com.deutschflow.examspeaking.scoring;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class LlmJsonTest {

    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void stripsFencesAndUnwrapsTypeContentWrapper() {
        String fenced = "```json\n{\"score\": 7}\n```";
        assertThat(LlmJson.parse(mapper, fenced).orElseThrow().path("score").asInt()).isEqualTo(7);

        String wrapped = "{\"type\":\"json\",\"content\":\"{\\\"score\\\": 8}\"}";
        assertThat(LlmJson.parse(mapper, wrapped).orElseThrow().path("score").asInt()).isEqualTo(8);

        String wrappedObject = "Hier: {\"type\":\"object\",\"content\":{\"score\":9}} Ende";
        assertThat(LlmJson.parse(mapper, wrappedObject).orElseThrow().path("score").asInt()).isEqualTo(9);

        assertThat(LlmJson.parse(mapper, "kein json")).isEmpty();
    }
}
