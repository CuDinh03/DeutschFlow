package com.deutschflow.teacher.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
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
    /** Điểm dạng tỉ lệ trong text: "7/10", "8 of 10", "8 von 10" → quy về thang 100. */
    private static final Pattern RATIO = Pattern.compile("(?i)(\\d+)\\s*(?:/|of|von)\\s*(\\d+)");
    static final String NO_FEEDBACK = "Không có nhận xét.";

    private AiGradeResultParser() {
    }

    /** @return a 0–100 score, or {@code null} when no score can be read from the response. */
    static Integer parseScore(String content) {
        if (content == null) return null;
        JsonNode obj = tryParseObject(content);
        if (obj != null) {
            // A structured JSON object was found — trust ITS score (or nothing). Do NOT fall back to
            // scanning the whole string, which would fabricate a grade from a number in the feedback prose.
            return readScoreNode(obj.get("score"));
        }
        // No JSON object at all → legacy/plain-text fallback ("SCORE: 90").
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
            // JSON present but no usable feedback field → don't scrape prose for it.
            return NO_FEEDBACK;
        }
        Matcher m = FEEDBACK_FALLBACK.matcher(content);
        if (m.find()) {
            String fb = m.group(1).replaceAll("[\"}\\s]+$", "").trim();
            if (!fb.isBlank()) return fb;
        }
        return NO_FEEDBACK;
    }

    /** @return the AI self-confidence (0–100) from {@code "confidence"}, or {@code null} when absent. */
    static Integer parseConfidence(String content) {
        if (content == null) return null;
        JsonNode obj = tryParseObject(content);
        if (obj == null) return null;
        return readScoreNode(obj.get("confidence"));
    }

    /**
     * @return the {@code "criteria"} object as a sanitized {@code {dimension: 0–100}} map (non-numeric
     * entries dropped, values clamped), or {@code null} when no usable criteria are present.
     */
    static Map<String, Integer> parseCriteria(String content) {
        if (content == null) return null;
        JsonNode obj = tryParseObject(content);
        if (obj == null) return null;
        JsonNode crit = obj.get("criteria");
        if (crit == null || !crit.isObject() || crit.isEmpty()) return null;
        Map<String, Integer> out = new LinkedHashMap<>();
        crit.fields().forEachRemaining(e -> {
            Integer v = readScoreNode(e.getValue());
            if (v != null) out.put(e.getKey(), v);
        });
        return out.isEmpty() ? null : out;
    }

    /** Reads a numeric (or numeric-textual) node as a clamped 0–100 score, or null. */
    private static Integer readScoreNode(JsonNode node) {
        if (node == null) return null;
        if (node.isNumber()) return clampScore(node.asInt());
        if (node.isTextual()) return parseScoreText(node.asText());
        return null;
    }

    /**
     * Reads a score from free text: a ratio ("7/10", "8 von 10") is rescaled to 0–100; otherwise the
     * first integer run is taken. Returns null when no number is present.
     */
    private static Integer parseScoreText(String text) {
        if (text == null) return null;
        Matcher ratio = RATIO.matcher(text);
        if (ratio.find()) {
            int num = Integer.parseInt(ratio.group(1));
            int den = Integer.parseInt(ratio.group(2));
            if (den > 0) return clampScore((int) Math.round(num * 100.0 / den));
        }
        Matcher d = DIGITS.matcher(text);
        if (d.find()) return clampScore(Integer.parseInt(d.group(1)));
        return null;
    }

    static int clampScore(int raw) {
        return Math.min(100, Math.max(0, raw));
    }

    /**
     * Returns the response as a JSON object: the whole string first, else the best embedded balanced
     * {@code {...}} block. When the model emits several objects (or objects amid prose), the one that
     * actually carries a {@code "score"} wins; failing that, the first that parses; {@code null} if none
     * parse. This replaces the old {@code indexOf('{')..lastIndexOf('}')} span, which merged multiple
     * objects into invalid JSON and forced a whole-string regex scan (fabricating grades from prose).
     */
    private static JsonNode tryParseObject(String content) {
        // Jackson's readTree parses only the LEADING JSON value, so a whole-parse can return a scoreless
        // first object when the response is "{meta} prose {score-object}". Trust the whole-parse only when
        // it already carries a score; otherwise keep it as a fallback and scan for a score-bearing object.
        JsonNode whole = tryReadTree(content);
        if (whole != null && whole.isObject() && whole.has("score")) return whole;

        JsonNode best = (whole != null && whole.isObject()) ? whole : null;
        for (String candidate : balancedObjects(content)) {
            JsonNode parsed = tryReadTree(candidate);
            if (parsed != null && parsed.isObject()) {
                if (parsed.has("score")) return parsed;
                if (best == null) best = parsed;
            }
        }
        return best;
    }

    /** Every top-level balanced <code>{...}</code> substring, honoring JSON string literals. */
    private static List<String> balancedObjects(String content) {
        List<String> out = new ArrayList<>();
        int depth = 0, start = -1;
        boolean inString = false, escaped = false;
        for (int i = 0; i < content.length(); i++) {
            char c = content.charAt(i);
            if (inString) {
                if (escaped) escaped = false;
                else if (c == '\\') escaped = true;
                else if (c == '"') inString = false;
                continue;
            }
            if (c == '"') {
                inString = true;
            } else if (c == '{') {
                if (depth == 0) start = i;
                depth++;
            } else if (c == '}' && depth > 0) {
                depth--;
                if (depth == 0 && start >= 0) {
                    out.add(content.substring(start, i + 1));
                    start = -1;
                }
            }
        }
        return out;
    }

    private static JsonNode tryReadTree(String s) {
        try {
            return MAPPER.readTree(s);
        } catch (Exception e) {
            return null;
        }
    }
}
