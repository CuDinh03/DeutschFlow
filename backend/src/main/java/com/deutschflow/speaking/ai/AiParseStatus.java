package com.deutschflow.speaking.ai;

/**
 * Outcome of parsing a model response string into {@link AiResponseDto}.
 */
public enum AiParseStatus {
    /** Valid JSON with non-blank {@code ai_speech_de}. */
    STRUCTURED,
    /** Jackson/extractor failed; raw text used as speech. */
    FALLBACK_PARSE_ERROR,
    /** JSON OK but {@code ai_speech_de} missing/blank; raw payload used as speech. */
    FALLBACK_MISSING_AI_SPEECH,
    /** Input was null. */
    FALLBACK_NULL_INPUT
}
