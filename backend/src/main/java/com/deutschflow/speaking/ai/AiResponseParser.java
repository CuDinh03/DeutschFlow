package com.deutschflow.speaking.ai;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

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
        return parseWithOutcome(rawJson).dto();
    }

    /**
     * Like {@link #parse(String)} but exposes {@link AiParseStatus} for metrics.
     */
    public AiParseOutcome parseWithOutcome(String rawJson) {
        if (rawJson == null) {
            return new AiParseOutcome(fallback(""), AiParseStatus.FALLBACK_NULL_INPUT);
        }

        String cleaned = extractJsonObject(stripMarkdownFences(rawJson.trim()));

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

            List<ErrorItem> errors = parseErrorsArray(root.get("errors"));

            // If ai_speech_de is missing or blank, fall back to raw text
            if (aiSpeechDe == null || aiSpeechDe.isBlank()) {
                log.warn("OpenAI response parsed but ai_speech_de is missing/blank — using fallback");
                return new AiParseOutcome(fallback(rawJson), AiParseStatus.FALLBACK_MISSING_AI_SPEECH);
            }

            var dto = new AiResponseDto(
                    aiSpeechDe, correction, explanationVi, grammarPoint, newWord, userInterestDetected, errors);
            return new AiParseOutcome(dto, AiParseStatus.STRUCTURED);

        } catch (Exception e) {
            log.warn("Failed to parse OpenAI JSON response, using fallback. Error: {}", e.getMessage());
            return new AiParseOutcome(fallback(rawJson), AiParseStatus.FALLBACK_PARSE_ERROR);
        }
    }

    /**
     * Extracts the first complete JSON object {...} from an arbitrary string.
     * This handles cases where the AI prefixes the JSON with plain-text before it.
     */
    private String extractJsonObject(String input) {
        int start = input.indexOf('{');
        if (start < 0) return input; // no JSON found, return as-is
        int depth = 0;
        for (int i = start; i < input.length(); i++) {
            char c = input.charAt(i);
            if (c == '{') depth++;
            else if (c == '}') {
                depth--;
                if (depth == 0) return input.substring(start, i + 1);
            }
        }
        // Unbalanced braces — try substring from first { to last }
        int end = input.lastIndexOf('}');
        return (end > start) ? input.substring(start, end + 1) : input;
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
        return new AiResponseDto(speech, null, null, null, null, null, List.of());
    }

    /**
     * Parses {@code errors} JSON array; drops entries with unknown {@code error_code} (not in {@link ErrorCatalog}).
     */
    private List<ErrorItem> parseErrorsArray(JsonNode errorsNode) {
        if (errorsNode == null || !errorsNode.isArray()) {
            return List.of();
        }
        List<ErrorItem> out = new ArrayList<>();
        for (JsonNode item : errorsNode) {
            if (item == null || item.isNull()) continue;
            String code = textOrNull(item, "error_code");
            if (code == null || !ErrorCatalog.isValid(code)) {
                if (code != null) {
                    log.debug("Dropped error with unknown error_code: {}", code);
                }
                continue;
            }
            String severity = textOrNull(item, "severity");
            if (severity == null) severity = "MINOR";

            Double confidence = null;
            JsonNode confNode = item.get("confidence");
            if (confNode != null && confNode.isNumber()) {
                confidence = Math.max(0.0, Math.min(1.0, confNode.asDouble()));
            }

            out.add(new ErrorItem(
                    code.trim(),
                    severity,
                    confidence,
                    textOrNull(item, "wrong_span"),
                    textOrNull(item, "corrected_span"),
                    textOrNull(item, "rule_vi_short"),
                    textOrNull(item, "example_correct_de")
            ));
        }
        return out;
    }
}
