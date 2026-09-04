package com.deutschflow.speaking.ai;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * QA 09/08 mục G: model trả {@code V2_main_clause} (sai case, thiếu tiền tố nhóm) —
 * trước đây bị DROP nên mất dữ liệu lỗi thật, đồng thời bản lưu {@code grammarPoint}
 * rò mã thô ra UI qua endpoint lịch sử. Chuẩn hoá về catalog thay vì drop.
 */
class ErrorCodeNormalizeTest {

    @Test
    void normalize_saiCase_vaThieuTienTo() {
        assertThat(ErrorCatalog.normalize("V2_main_clause")).isEqualTo("WORD_ORDER.V2_MAIN_CLAUSE");
        assertThat(ErrorCatalog.normalize("word_order.v2_main_clause")).isEqualTo("WORD_ORDER.V2_MAIN_CLAUSE");
        assertThat(ErrorCatalog.normalize("V2_MAIN_CLAUSE")).isEqualTo("WORD_ORDER.V2_MAIN_CLAUSE");
        // Mã catalog vốn mixed-case cũng chuẩn hoá được.
        assertThat(ErrorCatalog.normalize("WORD_ORDER.SEPARABLE_PREFIX_POSITION"))
                .isEqualTo("WORD_ORDER.SEparable_PREFIX_POSITION");
    }

    @Test
    void normalize_maChuan_giuNguyen_maLa_traNull() {
        assertThat(ErrorCatalog.normalize("CASE.PREP_DAT_MIT")).isEqualTo("CASE.PREP_DAT_MIT");
        assertThat(ErrorCatalog.normalize("TOTALLY_MADE_UP")).isNull();
        assertThat(ErrorCatalog.normalize(null)).isNull();
        assertThat(ErrorCatalog.normalize("  ")).isNull();
    }

    @Test
    void parser_loiSaiDinhDang_duocChuanHoaThayViDrop() {
        var parser = new AiResponseParser(new ObjectMapper());
        String json = """
                {
                  "ai_speech_de": "Fast richtig!",
                  "errors": [
                    { "error_code": "V2_main_clause", "severity": "MAJOR",
                      "wrong_span": "Heute ich lerne", "corrected_span": "Heute lerne ich" }
                  ]
                }
                """;
        var dto = parser.parseWithOutcome(json).dto();
        assertThat(dto.errors()).hasSize(1);
        assertThat(dto.errors().get(0).errorCode()).isEqualTo("WORD_ORDER.V2_MAIN_CLAUSE");
    }

    @Test
    void suggestions_placeholderSchema_biBo() {
        var parser = new AiResponseParser(new ObjectMapper());
        String json = """
                {
                  "ai_speech_de": "Gut!",
                  "suggestions": [
                    { "german_text": "Ich sehe gern Filme.",
                      "vietnamese_translation": "Tôi thích xem phim.",
                      "why_to_use": "kurz Vietnamesisch",
                      "usage_context": "Câu trả lời tự nhiên khi được hỏi về sở thích." }
                  ]
                }
                """;
        var dto = parser.parseWithOutcome(json).dto();
        assertThat(dto.suggestions()).hasSize(1);
        assertThat(dto.suggestions().get(0).whyToUse()).isNull();
        assertThat(dto.suggestions().get(0).usageContext())
                .isEqualTo("Câu trả lời tự nhiên khi được hỏi về sở thích.");
    }
}
