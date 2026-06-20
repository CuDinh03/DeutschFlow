package com.deutschflow.speaking.dto;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Guards the byte-level JSON contract of the AISpeaking typing round: the four DTOs replaced raw
 * {@code Map<String,String>}/{@code Map<String,Object>} responses, so the keys/values MUST stay
 * identical to the live web client reads ({@code lib/localAiApi.ts}).
 */
class AISpeakingDtoSerializationTest {

    private final ObjectMapper omd = new ObjectMapper().disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);

    private void assertSameJson(Object dto, Map<String, Object> legacyMap) throws Exception {
        JsonNode fromDto = omd.readTree(omd.writeValueAsString(dto));
        JsonNode fromMap = omd.readTree(omd.writeValueAsString(legacyMap));
        assertThat(fromDto).isEqualTo(fromMap);
    }

    @Test
    @DisplayName("ConversationResponseDto == legacy Map.of(userMessage, aiResponse, level)")
    void conversationEqualsLegacyMap() throws Exception {
        assertSameJson(new ConversationResponseDto("Hallo!", "Hallo, wie geht es dir?", "A2"),
                Map.of("userMessage", "Hallo!", "aiResponse", "Hallo, wie geht es dir?", "level", "A2"));
    }

    @Test
    @DisplayName("ErrorPracticeResponseDto == legacy Map.of(errorType, exercises)")
    void errorPracticeEqualsLegacyMap() throws Exception {
        assertSameJson(new ErrorPracticeResponseDto("DATIV", "1. ... 2. ... 3. ..."),
                Map.of("errorType", "DATIV", "exercises", "1. ... 2. ... 3. ..."));
    }

    @Test
    @DisplayName("CulturalContextResponseDto == legacy Map.of(topic, culturalContext)")
    void culturalContextEqualsLegacyMap() throws Exception {
        assertSameJson(new CulturalContextResponseDto("Begrüßung", "In Deutschland gibt man sich die Hand."),
                Map.of("topic", "Begrüßung", "culturalContext", "In Deutschland gibt man sich die Hand."));
    }

    @Test
    @DisplayName("RolePlayResponseDto == legacy Map.of(situation, rolePlay)")
    void rolePlayEqualsLegacyMap() throws Exception {
        assertSameJson(new RolePlayResponseDto("Im Restaurant", "Kellner: Was darf es sein?"),
                Map.of("situation", "Im Restaurant", "rolePlay", "Kellner: Was darf es sein?"));
    }
}
