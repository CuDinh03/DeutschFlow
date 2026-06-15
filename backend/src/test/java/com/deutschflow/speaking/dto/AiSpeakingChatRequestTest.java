package com.deutschflow.speaking.dto;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Jackson contract for {@link AiSpeakingChatRequest}: a missing {@code streamAudio} must default to
 * {@code false} (back-compat for existing clients), and {@code true} must bind when present.
 */
class AiSpeakingChatRequestTest {

    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    @DisplayName("missing streamAudio defaults to false")
    void missingStreamAudioDefaultsFalse() throws Exception {
        AiSpeakingChatRequest req = mapper.readValue("{\"userMessage\":\"Hallo\"}", AiSpeakingChatRequest.class);
        assertThat(req.userMessage()).isEqualTo("Hallo");
        assertThat(req.streamAudio()).isFalse();
    }

    @Test
    @DisplayName("streamAudio=true binds when present")
    void streamAudioTrueBinds() throws Exception {
        AiSpeakingChatRequest req =
                mapper.readValue("{\"userMessage\":\"Hallo\",\"streamAudio\":true}", AiSpeakingChatRequest.class);
        assertThat(req.streamAudio()).isTrue();
    }
}
