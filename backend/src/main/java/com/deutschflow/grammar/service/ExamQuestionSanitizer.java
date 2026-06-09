package com.deutschflow.grammar.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Map;

/**
 * Strips answer-key fields from an exam's {@code sections_json} before it is sent to
 * the browser while an attempt is in progress, and annotates each question with a
 * non-revealing {@code type} so the UI can still pick the right answer widget.
 *
 * <p>The stored {@code mock_exams.sections_json} contains the correct answers
 * ({@code correct}/{@code correct_answer}) and explanations ({@code explanation_vi})
 * needed for server-side scoring and post-submission review. Those MUST NOT reach the
 * client during the exam — otherwise a student can read every answer straight from the
 * network response (or React state) before submitting.
 *
 * <p>Safe by construction: scoring ({@link ExamScoringService}) and the review endpoint
 * both re-read {@code sections_json} directly from the DB, so removing the client copy
 * does not affect grading or review.
 */
@Component
public class ExamQuestionSanitizer {
    private static final ObjectMapper om = new ObjectMapper();

    /** Answer-revealing fields removed from every question item before serving. */
    private static final List<String> ANSWER_FIELDS =
            List.of("correct", "correct_answer", "explanation_vi", "explanation");

    /**
     * Parse the stored {@code sections_json}, annotate each item with a {@code type},
     * strip answer-key fields, and return the sanitized JSON string.
     *
     * @return sanitized JSON, the original value if it is null/blank, or {@code null}
     *         if parsing fails — callers must NEVER fall back to the raw answer-bearing
     *         JSON on failure.
     */
    public String stripAnswerKey(String sectionsJson) {
        if (sectionsJson == null || sectionsJson.isBlank()) {
            return sectionsJson;
        }
        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> root = om.readValue(sectionsJson, Map.class);
            if (root.get("sections") instanceof List<?> sections) {
                for (Object section : sections) {
                    if (section instanceof Map<?, ?> s) {
                        sanitizeSection(castMap(s));
                    }
                }
            }
            return om.writeValueAsString(root);
        } catch (Exception e) {
            // Fail safe: never serve the raw JSON (which still holds the answers).
            return null;
        }
    }

    private void sanitizeSection(Map<String, Object> section) {
        Object teileRaw = section.get("teile");
        Collection<Object> teile;
        if (teileRaw instanceof List<?> list) {
            teile = new ArrayList<>(list);
        } else if (teileRaw instanceof Map<?, ?> map) {
            teile = new ArrayList<>(castMap(map).values());
        } else {
            return;
        }
        for (Object teilObj : teile) {
            if (!(teilObj instanceof Map<?, ?> teil)) {
                continue;
            }
            if (castMap(teil).get("items") instanceof List<?> items) {
                for (Object itemObj : items) {
                    if (itemObj instanceof Map<?, ?> item) {
                        sanitizeItem(castMap(item));
                    }
                }
            }
        }
    }

    private void sanitizeItem(Map<String, Object> item) {
        // Derive type BEFORE stripping the answer key it is derived from.
        item.put("type", deriveType(item));
        for (String field : ANSWER_FIELDS) {
            item.remove(field);
        }
    }

    /**
     * Non-revealing question type, derived from the (still-present) answer key so the UI
     * can render the matching answer widget without ever seeing the answer itself. Mirrors
     * the legacy client-side detection: options ⇒ multiple choice, "richtig"/"falsch" ⇒
     * true/false, a single-letter answer ⇒ matching.
     */
    private String deriveType(Map<String, Object> item) {
        if (item.get("options") instanceof Map<?, ?> options && !options.isEmpty()) {
            return "MULTIPLE_CHOICE";
        }
        Object correct = item.get("correct");
        if (correct != null) {
            String c = correct.toString().trim();
            if (c.equalsIgnoreCase("richtig") || c.equalsIgnoreCase("falsch")) {
                return "RICHTIG_FALSCH";
            }
            if (c.length() == 1) {
                return "MATCHING";
            }
        }
        return "UNKNOWN";
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> castMap(Map<?, ?> map) {
        return (Map<String, Object>) map;
    }
}
