package com.deutschflow.speaking.ai;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/**
 * Parses the raw JSON string returned by OpenAI into an {@link AiResponseDto}.
 *
 * <p>Correctness property: this method NEVER throws an exception for any String input.
 * If parsing fails, it falls back to using the raw input as {@code aiSpeechDe}.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class AiResponseParser {

    private final ObjectMapper objectMapper;

    /**
     * Parses the raw OpenAI response into a structured {@link AiResponseDto}.
     *
     * @param rawJson the raw string from OpenAI (may be JSON, JSON in markdown fences, or arbitrary text)
     * @return a non-null {@link AiResponseDto} with at least {@code aiSpeechDe} set
     */
    public AiResponseDto parse(String rawJson) {
        if (rawJson == null) {
            return fallback("");
        }

        String cleaned = stripMarkdownFences(rawJson.trim());

        try {
            JsonNode root = objectMapper.readTree(cleaned);

            String aiSpeechDe = textOrNull(root, "ai_speech_de");
            String correction = textOrNull(root, "correction");
            String explanationVi = textOrNull(root, "explanation_vi");
            String grammarPoint = textOrNull(root, "grammar_point");

            String newWord = null;
            String userInterestDetected = null;
            JsonNode learningStatus = root.get("learning_status");
            if (learningStatus != null && !learningStatus.isNull()) {
                newWord = textOrNull(learningStatus, "new_word");
                userInterestDetected = textOrNull(learningStatus, "user_interest_detected");
            }

            // If ai_speech_de is missing or blank, fall back to raw text
            if (aiSpeechDe == null || aiSpeechDe.isBlank()) {
                log.warn("OpenAI response parsed but ai_speech_de is missing/blank — using fallback");
                return fallback(rawJson);
            }

            return new AiResponseDto(aiSpeechDe, correction, explanationVi, grammarPoint, newWord, userInterestDetected);

        } catch (Exception e) {
            log.warn("Failed to parse OpenAI JSON response, using fallback. Error: {}", e.getMessage());
            return fallback(rawJson);
        }
    }

    /**
     * Strips markdown code fences (```json ... ``` or ``` ... ```) from the input.
     */
    private String stripMarkdownFences(String input) {
        if (input.startsWith("```json")) {
            int start = input.indexOf('\n', 7);
            int end = input.lastIndexOf("```");
            if (start >= 0 && end > start) {
                return input.substring(start + 1, end).trim();
            }
        } else if (input.startsWith("```")) {
            int start = input.indexOf('\n', 3);
            int end = input.lastIndexOf("```");
            if (start >= 0 && end > start) {
                return input.substring(start + 1, end).trim();
            }
        }
        return input;
    }

    /**
     * Returns the text value of a JSON field, or null if the field is missing or null.
     */
    private String textOrNull(JsonNode node, String fieldName) {
        JsonNode field = node.get(fieldName);
        if (field == null || field.isNull()) return null;
        String text = field.asText(null);
        return (text == null || text.isBlank() || "null".equals(text)) ? null : text;
    }

    /**
     * Creates a fallback response using the raw text as the German speech.
     */
    private AiResponseDto fallback(String rawText) {
        String speech = (rawText == null || rawText.isBlank()) ? "..." : rawText;
        return new AiResponseDto(speech, null, null, null, null, null);
    }
}
