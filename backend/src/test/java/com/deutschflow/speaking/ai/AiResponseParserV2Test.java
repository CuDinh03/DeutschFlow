package com.deutschflow.speaking.ai;

import com.deutschflow.speaking.contract.SpeakingResponseSchema;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class AiResponseParserV2Test {

    private final AiResponseParser parser = new AiResponseParser(new ObjectMapper());

    @Test
    void v2_parsesContentTranslationFeedbackAction() {
        String raw = """
                {"content":"Guten Tag!","translation":"Xin chào!","feedback":"Tốt!","action":"Was machst du heute?"}
                """;
        AiParseOutcome out = parser.parseWithOutcome(raw, SpeakingResponseSchema.V2);
        assertThat(out.status()).isEqualTo(AiParseStatus.STRUCTURED);
        AiResponseDto dto = out.dto();
        assertThat(dto.aiSpeechDe()).isEqualTo("Guten Tag!");
        assertThat(dto.explanationVi()).isEqualTo("Xin chào!");
        assertThat(dto.feedback()).isEqualTo("Tốt!");
        assertThat(dto.action()).isEqualTo("Was machst du heute?");
    }

    @Test
    void v1_stillUsesAiSpeechDe() {
        String raw = """
                {"ai_speech_de":"Hallo","status":"EXCELLENT","errors":[],"suggestions":[]}
                """;
        AiParseOutcome out = parser.parseWithOutcome(raw, SpeakingResponseSchema.V1);
        assertThat(out.dto().aiSpeechDe()).isEqualTo("Hallo");
    }
}
