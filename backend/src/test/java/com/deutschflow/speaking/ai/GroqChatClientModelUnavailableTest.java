package com.deutschflow.speaking.ai;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Hồi quy cho sự cố 21/07/2026: Groq gỡ {@code meta-llama/llama-4-scout-17b-16e-instruct} khỏi danh
 * mục và toàn bộ luồng Speaking trả 503.
 *
 * <p>Bản vá đầu chỉ khớp {@code model_decommissioned} (mã duy nhất mà tài liệu Groq nêu) và ĐÃ BỎ LỌT
 * đúng ca thật — log production cho thấy Groq trả {@code 404 model_not_found}. Bộ test này khoá cả hai
 * mã lại để lần sửa sau không vô tình thu hẹp phạm vi nhận diện.
 */
class GroqChatClientModelUnavailableTest {

    /** Nguyên văn thân lỗi đọc được từ log production ngày 21/07/2026. */
    private static final String PROD_404_BODY = """
            {"error":{"message":"The model `meta-llama/llama-4-scout-17b-16e-instruct` does not exist \
            or you do not have access to it.","type":"invalid_request_error","code":"model_not_found"}}""";

    private static final String DECOMMISSIONED_400_BODY = """
            {"error":{"message":"The model `llama3-70b-8192` has been decommissioned.",\
            "type":"invalid_request_error","code":"model_decommissioned"}}""";

    @Test
    @DisplayName("nhận diện 404 model_not_found — thân lỗi thật của sự cố production")
    void detectsModelNotFound() {
        assertThat(GroqChatClient.isModelUnavailable(PROD_404_BODY)).isTrue();
    }

    @Test
    @DisplayName("nhận diện 400 model_decommissioned — mã mà tài liệu Groq nêu")
    void detectsModelDecommissioned() {
        assertThat(GroqChatClient.isModelUnavailable(DECOMMISSIONED_400_BODY)).isTrue();
    }

    @Test
    @DisplayName("không nhận nhầm các lỗi 4xx khác thành sự cố model")
    void ignoresUnrelated4xx() {
        String invalidApiKey = """
                {"error":{"message":"Invalid API Key","type":"invalid_request_error",\
                "code":"invalid_api_key"}}""";
        String badRequest = """
                {"error":{"message":"'messages' must contain the word 'json'",\
                "type":"invalid_request_error","code":"json_validate_failed"}}""";

        assertThat(GroqChatClient.isModelUnavailable(invalidApiKey)).isFalse();
        assertThat(GroqChatClient.isModelUnavailable(badRequest)).isFalse();
    }

    @Test
    @DisplayName("chịu được thân lỗi rỗng hoặc null")
    void handlesEmptyBody() {
        assertThat(GroqChatClient.isModelUnavailable(null)).isFalse();
        assertThat(GroqChatClient.isModelUnavailable("")).isFalse();
    }
}
