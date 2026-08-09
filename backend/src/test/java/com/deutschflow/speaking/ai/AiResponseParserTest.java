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
    void parse_interviewMetaAnalysis_isParsed() {
        String json = """
                {
                  "ai_speech_de": "Verstehe. Wie haben Sie das gelöst?",
                  "interview_meta": {
                    "ack_de": "Verstehe.",
                    "question_de": "Wie haben Sie das gelöst?",
                    "question_type": "PROBE_SPECIFIC",
                    "analysis": {
                      "addressed_question": true,
                      "depth": "DEEP",
                      "concreteness": "CONCRETE",
                      "follow_up_from_answer": "die Migration auf Postgres",
                      "phase_goal_met": true
                    }
                  }
                }
                """;
        AiResponseDto dto = parser.parse(json);
        assertThat(dto.interviewMeta()).isNotNull();
        var analysis = dto.interviewMeta().analysis();
        assertThat(analysis).isNotNull();
        assertThat(analysis.phaseGoalMet()).isTrue();
        assertThat(analysis.addressedQuestion()).isTrue();
        assertThat(analysis.depth()).isEqualTo("DEEP");
        assertThat(analysis.followUpFromAnswer()).contains("Postgres");
    }

    @Test
    void parse_interviewMetaAnalysis_missingAddressedQuestion_defaultsFalse() {
        // A field the LLM omitted is absence of evidence, not evidence the question was addressed.
        String json = """
                {
                  "ai_speech_de": "Verstehe.",
                  "interview_meta": {
                    "ack_de": "Verstehe.",
                    "question_de": "Und dann?",
                    "analysis": { "depth": "SHALLOW" }
                  }
                }
                """;
        var analysis = parser.parse(json).interviewMeta().analysis();
        assertThat(analysis).isNotNull();
        assertThat(analysis.addressedQuestion()).isFalse();
    }

    @Test
    void parse_interviewMetaWithoutAnalysis_backwardCompatible() {
        String json = """
                {
                  "ai_speech_de": "Gut. Und das Ergebnis?",
                  "interview_meta": { "ack_de": "Gut.", "question_de": "Und das Ergebnis?" }
                }
                """;
        AiResponseDto dto = parser.parse(json);
        assertThat(dto.interviewMeta()).isNotNull();
        assertThat(dto.interviewMeta().analysis()).isNull();
        assertThat(dto.interviewMeta().questionDe()).isEqualTo("Und das Ergebnis?");
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
    void parse_breakingAiSpeechDe_fallbackClearsStructuredErrorsAndNeverLeaksJson() {
        String junk = "{ not valid json }}}";
        AiParseOutcome junkOut = parser.parseWithOutcome(junk);
        assertThat(junkOut.status()).isEqualTo(FALLBACK_PARSE_ERROR);
        assertThat(junkOut.dto().errors()).isEmpty();
        // JSON hỏng cú pháp cũng là rác máy móc — không được hiện cho học viên.
        assertThat(junkOut.dto().aiSpeechDe()).doesNotContain("{");

        String noSpeechField = "{\"not\":\"model forgot contract\"}";
        AiParseOutcome out = parser.parseWithOutcome(noSpeechField);
        assertThat(out.status()).isEqualTo(FALLBACK_MISSING_AI_SPEECH);
        assertThat(out.dto().errors()).isEmpty();
        // ĐỔI HỢP ĐỒNG (sự cố prod 09/08): bản cũ assert `contains("not")` — tức test mã hoá đúng
        // cái bug, khẳng định payload thô được đổ vào bong bóng chat.
        assertThat(out.dto().aiSpeechDe()).isEqualTo("...");

        String missingSpeech = "{\"errors\":[{\"error_code\":\"VERB.PARTIZIP_II_FORM\"}],\"learning_status\":{}}";
        AiParseOutcome out2 = parser.parseWithOutcome(missingSpeech);
        assertThat(out2.status()).isEqualTo(FALLBACK_MISSING_AI_SPEECH);
        assertThat(out2.dto().errors()).isEmpty();
        assertThat(out2.dto().aiSpeechDe()).isEqualTo("...");
    }

    // ── Sự cố prod 09/08: bong bóng chat hiện nguyên văn JSON ────────────────────────────────

    @Test
    void parse_exactProdIncidentPayload_salvagesGermanSentence() {
        // Chụp nguyên văn từ ảnh màn hình học viên: phiên chạy V1 nhưng model trả hình dạng schema
        // V2, kèm mảnh JSON-Schema bị lọt ("type":"object").
        String payload = "{\"type\":\"object\",\"content\":\"Ach, Finacition! "
                + "Was ist dein Lieblingsfeature dort?\"}";

        AiParseOutcome out = parser.parseWithOutcome(payload);

        assertThat(out.dto().aiSpeechDe())
                .isEqualTo("Ach, Finacition! Was ist dein Lieblingsfeature dort?");
        assertThat(out.dto().aiSpeechDe()).doesNotContain("{").doesNotContain("type");
        // KHÔNG phải STRUCTURED: hợp đồng đã vỡ nên trường phụ không được tin/persist.
        assertThat(out.status()).isEqualTo(AiParseStatus.FALLBACK_ALIAS_SALVAGED);
        assertThat(out.dto().errors()).isEmpty();
        assertThat(out.dto().correction()).isNull();
    }

    @Test
    void parse_schemaNoiseIsNotMistakenForSpeech() {
        AiParseOutcome out = parser.parseWithOutcome("{\"type\":\"object\",\"text\":\"string\"}");

        assertThat(out.dto().aiSpeechDe()).isEqualTo("...");
        assertThat(out.status()).isEqualTo(FALLBACK_MISSING_AI_SPEECH);
    }

    @Test
    void parse_plainTextStillUsedAsSpeech() {
        AiParseOutcome out = parser.parseWithOutcome("Guten Tag! Wie geht es dir heute?");

        assertThat(out.dto().aiSpeechDe()).isEqualTo("Guten Tag! Wie geht es dir heute?");
        assertThat(out.status()).isEqualTo(FALLBACK_PARSE_ERROR);
    }

    @Test
    void parse_neverLeaksMachineNoiseForAnyPayload() {
        for (String payload : java.util.List.of(
                "{\"type\":\"object\",\"content\":\"Ach so!\"}",
                "{\"not\":\"contract\"}",
                "{ broken json ]]",
                "[{\"content\":\"array thay vì object\"}]",
                "{\"ai_speech_de\":null,\"content\":null}",
                "```json\n{\"content\":\"Sehr gut!\"}\n```")) {
            String speech = parser.parse(payload).aiSpeechDe();
            assertThat(speech).as("payload=%s", payload)
                    .doesNotContain("{").doesNotContain("ai_speech_de").doesNotContain("\"type\"");
        }
    }
}
