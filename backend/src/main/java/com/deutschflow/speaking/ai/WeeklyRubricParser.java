package com.deutschflow.speaking.ai;

import com.deutschflow.speaking.dto.WeeklySpeakingDtos;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

/**
 * Parses graded weekly rubric JSON from the chat model ({@link WeeklyRubricPromptBuilder} schema).
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class WeeklyRubricParser {

    private final ObjectMapper objectMapper;

    public record ParsedWeeklyRubric(WeeklySpeakingDtos.WeeklyRubricView view, String validatedJsonCanonical) {}

    /** Validates structure & returns typed view plus canonical JSON identical to parsed input tree. */
    public ParsedWeeklyRubric parseValidated(String rawJson) {
        JsonNode root = readRoot(rawJson);
        WeeklySpeakingDtos.WeeklyRubricView view = parseFromRoot(root);
        String canonical;
        try {
            canonical = objectMapper.writeValueAsString(root);
        } catch (Exception e) {
            throw new IllegalArgumentException("Failed to canonialize rubric", e);
        }
        return new ParsedWeeklyRubric(view, canonical);
    }

    WeeklySpeakingDtos.WeeklyRubricView parse(String rawJson) {
        JsonNode root = readRoot(rawJson);
        return parseFromRoot(root);
    }

    private WeeklySpeakingDtos.WeeklyRubricView parseFromRoot(JsonNode root) {
        JsonNode tc = required(root, "task_completion");
        int score = boundedInt(tc, "score_1_to_5", 1, 5);
        List<Integer> covered = readIntArray(tc.get("covered_mandatory_indices"));
        List<Integer> missing = readIntArray(tc.get("missing_mandatory_indices"));
        boolean offTopic = tc.path("off_topic").asBoolean(false);
        boolean ambiguous = tc.path("ambiguous").asBoolean(false);

        JsonNode fl = required(root, "fluency");
        String fluNotes = textOrBlank(fl, "subjective_notes_de");
        int filler = fl.path("filler_approx_count").asInt(0);
        Double wpm = fl.get("wpm_approx") != null && fl.get("wpm_approx").isNumber()
                ? fl.get("wpm_approx").asDouble()
                : null;
        String conf = textOrBlank(fl, "confidence_label");

        JsonNode lx = required(root, "lexis");
        List<String> rich = readStringArray(lx.get("richness_notes_de"));
        List<WeeklySpeakingDtos.VocabSuggestionDto> sug = parseVocab(lx.get("replacements_suggested_de_vi"));

        JsonNode gr = required(root, "grammar");
        String gsum = textOrBlank(gr, "summary_de");
        List<WeeklySpeakingDtos.WeeklyGrammarErrorHintDto> errs = parseGrammarErrors(gr.get("errors"));

        String fb = requiredText(root, "feedback_vi_summary");
        String dis = requiredText(root, "disclaimer_vi");

        return new WeeklySpeakingDtos.WeeklyRubricView(
                new WeeklySpeakingDtos.TaskCompletionRubricDto(score, covered, missing, offTopic, ambiguous),
                new WeeklySpeakingDtos.FluencyRubricDto(fluNotes, filler, wpm, conf.isBlank() ? "TEXT_ONLY_PROXY" : conf),
                new WeeklySpeakingDtos.LexisRubricDto(rich, sug),
                new WeeklySpeakingDtos.GrammarRubricBlockDto(gsum, errs),
                fb,
                dis
        );
    }

    private JsonNode readRoot(String rawJson) {
        if (rawJson == null) {
            throw new IllegalArgumentException("Empty rubric payload");
        }
        String trimmed = stripMarkdownFences(rawJson.trim());
        String jsonBlob = extractFirstJsonObject(trimmed);
        try {
            JsonNode root = objectMapper.readTree(jsonBlob);
            if (!root.isObject()) throw new IllegalArgumentException("Expected JSON object");
            return root;
        } catch (IllegalArgumentException e) {
            throw e;
        } catch (Exception e) {
            log.warn("Weekly rubric parse failed: {}", e.getMessage());
            throw new IllegalArgumentException("Malformed rubric JSON", e);
        }
    }

    private static JsonNode required(JsonNode root, String field) {
        JsonNode n = root.get(field);
        if (n == null || n.isNull() || !n.isObject()) {
            throw new IllegalArgumentException("Missing object field: " + field);
        }
        return n;
    }

    private static String requiredText(JsonNode root, String field) {
        String v = textOrNull(root, field);
        if (v == null || v.isBlank()) throw new IllegalArgumentException("Missing text field: " + field);
        return v;
    }

    private static String textOrBlank(JsonNode parent, String field) {
        String v = textOrNull(parent, field);
        return v == null ? "" : v;
    }

    private static String textOrNull(JsonNode node, String fieldName) {
        JsonNode field = node.get(fieldName);
        if (field == null || field.isNull()) return null;
        String text = field.asText(null);
        return (text == null || text.isBlank()) ? null : text;
    }

    private static int boundedInt(JsonNode parent, String field, int min, int max) {
        if (!parent.has(field) || !parent.get(field).isInt()) {
            throw new IllegalArgumentException("Missing int field: " + field);
        }
        int v = parent.get(field).asInt();
        if (v < min || v > max) throw new IllegalArgumentException("Out of range: " + field);
        return v;
    }

    private static List<Integer> readIntArray(JsonNode arr) {
        List<Integer> out = new ArrayList<>();
        if (arr == null || !arr.isArray()) return out;
        for (JsonNode n : arr) {
            if (n.isInt()) out.add(n.asInt());
        }
        return out;
    }

    private static List<String> readStringArray(JsonNode arr) {
        List<String> out = new ArrayList<>();
        if (arr == null || !arr.isArray()) return out;
        for (JsonNode n : arr) {
            if (!n.isNull() && n.isTextual()) out.add(n.asText());
        }
        return out;
    }

    private List<WeeklySpeakingDtos.VocabSuggestionDto> parseVocab(JsonNode arr) {
        List<WeeklySpeakingDtos.VocabSuggestionDto> out = new ArrayList<>();
        if (arr == null || !arr.isArray()) return out;
        for (JsonNode n : arr) {
            if (n == null || !n.isObject()) continue;
            String from = textOrNull(n, "from_de");
            String to = textOrNull(n, "to_de_suggestion");
            String nv = textOrNull(n, "note_vi");
            if (from != null || to != null) {
                out.add(new WeeklySpeakingDtos.VocabSuggestionDto(
                        from == null ? "" : from,
                        to == null ? "" : to,
                        nv == null ? "" : nv
                ));
            }
        }
        return out;
    }

    private List<WeeklySpeakingDtos.WeeklyGrammarErrorHintDto> parseGrammarErrors(JsonNode arr) {
        List<WeeklySpeakingDtos.WeeklyGrammarErrorHintDto> out = new ArrayList<>();
        if (arr == null || !arr.isArray()) return out;
        int cap = 0;
        for (JsonNode item : arr) {
            if (cap++ >= 10) break;
            if (item == null || !item.isObject()) continue;
            String code = textOrNull(item, "error_code");
            if (code == null || !ErrorCatalog.isValid(code)) continue;
            String sev = textOrNull(item, "severity");
            if (sev == null) sev = "MINOR";

            Double conf = null;
            JsonNode cn = item.get("confidence");
            if (cn != null && cn.isNumber()) {
                conf = Math.max(0.0, Math.min(1.0, cn.asDouble()));
            }

            out.add(new WeeklySpeakingDtos.WeeklyGrammarErrorHintDto(
                    code.trim(),
                    sev,
                    conf,
                    textOrNull(item, "wrong_span"),
                    textOrNull(item, "corrected_span"),
                    textOrNull(item, "rule_vi_short")
            ));
        }
        return out;
    }

    private static String stripMarkdownFences(String input) {
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

    private static String extractFirstJsonObject(String input) {
        int start = input.indexOf('{');
        if (start < 0) return input;
        int depth = 0;
        for (int i = start; i < input.length(); i++) {
            char c = input.charAt(i);
            if (c == '{') depth++;
            else if (c == '}') {
                depth--;
                if (depth == 0) return input.substring(start, i + 1);
            }
        }
        int end = input.lastIndexOf('}');
        return (end > start) ? input.substring(start, end + 1) : input;
    }

}
