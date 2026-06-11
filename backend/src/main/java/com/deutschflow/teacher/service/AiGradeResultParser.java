package com.deutschflow.teacher.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Parses an AI grading response into a score + feedback.
 *
 * <p>The AI client runs in forced JSON mode (Groq {@code response_format=json_object}), so the
 * happy path is a JSON object {@code {"score": <int>, "feedback": "<text>"}}. For resilience it
 * also (a) extracts an embedded {@code {...}} block when the model wraps JSON in prose, and
 * (b) falls back to loose {@code SCORE:}/{@code FEEDBACK:} (or {@code "score":}/{@code "feedback":})
 * text for the local provider or a model that ignores the format.
 *
 * <p>Stateless and thread-safe; shared by {@code GradingService} (Schreiben) and
 * {@code TeacherAiGradingService} (Sprechen).
 */
final class AiGradeResultParser {

    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final Pattern SCORE_FALLBACK = Pattern.compile("(?i)\"?score\"?\\s*[:=]\\s*\"?(\\d+)");
    private static final Pattern FEEDBACK_FALLBACK =
            Pattern.compile("(?i)\"?feedback\"?\\s*[:=]\\s*\"?(.+)", Pattern.DOTALL);
    private static final Pattern DIGITS = Pattern.compile("(\\d+)");
    static final String NO_FEEDBACK = "Không có nhận xét.";

    private AiGradeResultParser() {
    }

    /** @return a 0–100 score, or {@code null} when no score can be read from the response. */
    static Integer parseScore(String content) {
        if (content == null) return null;
        JsonNode obj = tryParseObject(content);
        if (obj != null) {
            JsonNode scoreNode = obj.get("score");
            if (scoreNode != null && scoreNode.isNumber()) {
                return clampScore(scoreNode.asInt());
            }
            if (scoreNode != null && scoreNode.isTextual()) {
                Matcher digits = DIGITS.matcher(scoreNode.asText());
                if (digits.find()) return clampScore(Integer.parseInt(digits.group(1)));
            }
        }
        Matcher m = SCORE_FALLBACK.matcher(content);
        if (m.find()) return clampScore(Integer.parseInt(m.group(1)));
        return null;
    }

    /** @return the feedback text, or {@link #NO_FEEDBACK} when none is present. */
    static String parseFeedback(String content) {
        if (content == null) return NO_FEEDBACK;
        JsonNode obj = tryParseObject(content);
        if (obj != null) {
            JsonNode fbNode = obj.get("feedback");
            if (fbNode != null && fbNode.isTextual() && !fbNode.asText().isBlank()) {
                return fbNode.asText().trim();
            }
        }
        Matcher m = FEEDBACK_FALLBACK.matcher(content);
        if (m.find()) {
            String fb = m.group(1).replaceAll("[\"}\\s]+$", "").trim();
            if (!fb.isBlank()) return fb;
        }
        return NO_FEEDBACK;
    }

    static int clampScore(int raw) {
        return Math.min(100, Math.max(0, raw));
    }

    /**
     * Returns the response as a JSON object — parsing the whole string first, then the embedded
     * {@code {...}} block if the model wrapped JSON in prose — or {@code null} if neither parses.
     */
    private static JsonNode tryParseObject(String content) {
        JsonNode node = tryReadTree(content);
        if (node != null && node.isObject()) return node;

        int start = content.indexOf('{');
        int end = content.lastIndexOf('}');
        if (start >= 0 && end > start) {
            node = tryReadTree(content.substring(start, end + 1));
            if (node != null && node.isObject()) return node;
        }
        return null;
    }

    private static JsonNode tryReadTree(String s) {
        try {
            return MAPPER.readTree(s);
        } catch (Exception e) {
            return null;
        }
    }
}
