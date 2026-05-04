package com.deutschflow.speaking.ai;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

import static com.deutschflow.speaking.ai.AiParseStatus.FALLBACK_MISSING_AI_SPEECH;
import static com.deutschflow.speaking.ai.AiParseStatus.FALLBACK_NULL_INPUT;
import static com.deutschflow.speaking.ai.AiParseStatus.FALLBACK_PARSE_ERROR;
import static com.deutschflow.speaking.ai.AiParseStatus.STRUCTURED;

class AiResponseParserTest {

    private AiResponseParser parser;

    private static final String BASE_JSON = """
            {
              "ai_speech_de": "Alles klar!",
              "correction": null,
              "explanation_vi": null,
              "grammar_point": null,
              "learning_status": { "new_word": null, "user_interest_detected": null }
            }
            """;

    @BeforeEach
    void setUp() {
        parser = new AiResponseParser(new ObjectMapper());
    }

    @Test
    void parse_null_usesFallbackWithEmptyErrors() {
        AiParseOutcome out = parser.parseWithOutcome(null);
        assertThat(out.status()).isEqualTo(FALLBACK_NULL_INPUT);
        assertThat(out.dto().errors()).isEmpty();
        assertThat(out.dto().aiSpeechDe()).isEqualTo("...");
    }

    @Test
    void parse_errorsMissing_defaultsToEmptyList() {
        AiParseOutcome out = parser.parseWithOutcome(BASE_JSON);
        assertThat(out.status()).isEqualTo(STRUCTURED);
        assertThat(out.dto().errors()).isEmpty();
        assertThat(out.dto().aiSpeechDe()).isEqualTo("Alles klar!");
    }

    @Test
    void parse_errorsArrayParsesWhitelistCodesAndSpans() {
        String json = """
                {
                  "ai_speech_de": "Ja.",
                  "correction": null,
                  "explanation_vi": null,
                  "grammar_point": null,
                  "errors": [{
                    "error_code": "VERB.CONJ_PERSON_ENDING",
                    "severity": "MAJOR",
                    "confidence": 0.71,
                    "wrong_span": "ich gehts",
                    "corrected_span": "ich gehe",
                    "rule_vi_short": "Đuôi chia ngôi trong hiện tại",
                    "example_correct_de": "Ich gehe."
                  }],
                  "learning_status": {}
                }
                """;
        AiResponseDto dto = parser.parse(json);
        assertThat(dto.errors()).hasSize(1);
        ErrorItem e = dto.errors().get(0);
        assertThat(e.errorCode()).isEqualTo("VERB.CONJ_PERSON_ENDING");
        assertThat(e.severity()).isEqualTo("MAJOR");
        assertThat(e.confidence()).isEqualTo(0.71);
        assertThat(e.wrongSpan()).isEqualTo("ich gehts");
        assertThat(e.correctedSpan()).isEqualTo("ich gehe");
        assertThat(e.ruleViShort()).isEqualTo("Đuôi chia ngôi trong hiện tại");
        assertThat(e.exampleCorrectDe()).isEqualTo("Ich gehe.");
    }

    @Test
    void parse_dropsErrorsWithUnknownErrorCode() {
        String json = """
                {
                  "ai_speech_de": "Hm.",
                  "errors": [
                    {"error_code": "NOT_IN_CATALOG"},
                    {"error_code": "ARTICLE.GENDER_WRONG_DER_DIE_DAS", "severity": "HIGH"}
                  ],
                  "learning_status": {}
                }
                """;
        AiResponseDto dto = parser.parse(json);
        assertThat(dto.errors()).hasSize(1);
        assertThat(dto.errors().get(0).errorCode()).isEqualTo("ARTICLE.GENDER_WRONG_DER_DIE_DAS");
    }

    @Test
    void parse_defaultSeverityMinorWhenMissing() {
        String json = """
                {
                  "ai_speech_de": "Ok.",
                  "errors": [{"error_code": "CASE.PREP_DAT_MIT", "confidence": 0.5}],
                  "learning_status": {}
                }
                """;
        assertThat(parser.parse(json).errors().get(0).severity()).isEqualTo("MINOR");
    }

    @Test
    void parse_confidenceClampedToZeroAndOne() {
        String hi = """
                {
                  "ai_speech_de": "A.",
                  "errors": [{"error_code": "LEXICAL.FALSE_FRIEND_BEKOMMEN", "confidence": 99}],
                  "learning_status": {}
                }
                """;
        assertThat(parser.parse(hi).errors().get(0).confidence()).isEqualTo(1.0);

        String low = """
                {
                  "ai_speech_de": "B.",
                  "errors": [{"error_code": "LEXICAL.FALSE_FRIEND_BEKOMMEN", "confidence": -2}],
                  "learning_status": {}
                }
                """;
        assertThat(parser.parse(low).errors().get(0).confidence()).isEqualTo(0.0);
    }

    @Test
    void parse_nonNumericConfidenceLeavesNull() {
        String json = """
                {
                  "ai_speech_de": "C.",
                  "errors": [{"error_code": "AGREEMENT.SUBJECT_VERB_NUMBER", "confidence": "sure"}],
                  "learning_status": {}
                }
                """;
        assertThat(parser.parse(json).errors().get(0).confidence()).isNull();
    }

    @Test
    void parse_stripsMarkdownJsonFence() {
        String fenced = "```json\n" + """
                {
                  "ai_speech_de": "Fertig.",
                  "errors": [],
                  "learning_status": {}
                }
                ```""";
        AiResponseDto dto = parser.parse(fenced);
        assertThat(dto.aiSpeechDe()).isEqualTo("Fertig.");
        assertThat(dto.errors()).isEmpty();
    }

    @Test
    void parse_extractsFirstJsonObjectFromPrefixText() {
        String prefixed = """
                Hier ist das JSON für dich:
                {
                  "ai_speech_de": "Super.",
                  "errors": [{"error_code": "WORD_ORDER.V2_MAIN_CLAUSE"}],
                  "learning_status": {}
                }
                trailing noise
                """;
        AiResponseDto dto = parser.parse(prefixed);
        assertThat(dto.aiSpeechDe()).isEqualTo("Super.");
        assertThat(dto.errors()).singleElement()
                .extracting(ErrorItem::errorCode).isEqualTo("WORD_ORDER.V2_MAIN_CLAUSE");
    }

    @Test
    void parse_breakingAiSpeechDe_fallbackPreservesRawAndClearsStructuredErrors() {
        String junk = "{ not valid json }}}";
        AiParseOutcome junkOut = parser.parseWithOutcome(junk);
        assertThat(junkOut.status()).isEqualTo(FALLBACK_PARSE_ERROR);
        assertThat(junkOut.dto().errors()).isEmpty();

        String noSpeechField = "{\"not\":\"model forgot contract\"}";
        AiParseOutcome out = parser.parseWithOutcome(noSpeechField);
        assertThat(out.status()).isEqualTo(FALLBACK_MISSING_AI_SPEECH);
        assertThat(out.dto().errors()).isEmpty();
        assertThat(out.dto().aiSpeechDe()).contains("not");

        String missingSpeech = "{\"errors\":[{\"error_code\":\"VERB.PARTIZIP_II_FORM\"}],\"learning_status\":{}}";
        AiParseOutcome out2 = parser.parseWithOutcome(missingSpeech);
        assertThat(out2.status()).isEqualTo(FALLBACK_MISSING_AI_SPEECH);
        assertThat(out2.dto().errors()).isEmpty();
        assertThat(out2.dto().aiSpeechDe()).contains("errors");
    }
}
