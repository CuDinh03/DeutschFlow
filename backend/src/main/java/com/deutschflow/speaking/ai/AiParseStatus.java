package com.deutschflow.speaking.ai;

/**
 * Outcome of parsing a model response string into {@link AiResponseDto}.
 */
public enum AiParseStatus {
    /** Valid JSON with non-blank {@code ai_speech_de}. */
    STRUCTURED,
    /** Jackson/extractor failed; raw text used as speech. */
    FALLBACK_PARSE_ERROR,
    /** JSON OK but {@code ai_speech_de} missing/blank and nothing salvageable; speech left as "…". */
    FALLBACK_MISSING_AI_SPEECH,
    /**
     * JSON hợp lệ nhưng SAI hợp đồng của tầng: thiếu trường lời thoại đúng tên, tuy nhiên câu nói
     * vẫn nằm ở một trường khác nên đã vớt ra được — vd model trả hình dạng schema KIA
     * ({@code {"type":"object","content":"Ach, …"}}) khi phiên đang chạy V1.
     *
     * <p>Cố tình KHÔNG phải {@link #STRUCTURED}: hợp đồng đã vỡ nên các trường phụ (correction,
     * errors, status) không đáng tin và không được persist — nhưng học viên vẫn phải thấy CÂU NÓI
     * chứ không phải cục JSON. Sự cố prod 09/08: bong bóng chat hiện nguyên văn
     * {@code {"type":"object","content":"Ach, Finacition! Was ist dein Lieblingsfeature dort?"}}.
     */
    FALLBACK_ALIAS_SALVAGED,
    /** Input was null. */
    FALLBACK_NULL_INPUT
}
