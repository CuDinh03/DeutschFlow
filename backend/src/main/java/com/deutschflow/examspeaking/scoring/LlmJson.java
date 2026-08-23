package com.deutschflow.examspeaking.scoring;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.util.Optional;

/**
 * Parse JSON từ LLM một cách phòng thủ: bỏ ```json fences, bóc vỏ {"type":..,"content":".."} mà tier
 * CONTENT/GRADING hay bọc (bài học #370/#371), cắt phần thừa trước/sau dấu ngoặc ngoài cùng.
 */
public final class LlmJson {

    private LlmJson() {}

    public static Optional<JsonNode> parse(ObjectMapper mapper, String raw) {
        if (raw == null || raw.isBlank()) {
            return Optional.empty();
        }
        String s = raw.trim();
        if (s.startsWith("```")) {
            int nl = s.indexOf('\n');
            s = nl > 0 ? s.substring(nl + 1) : s.substring(3);
            int fence = s.lastIndexOf("```");
            if (fence >= 0) {
                s = s.substring(0, fence);
            }
            s = s.trim();
        }
        int start = s.indexOf('{');
        int end = s.lastIndexOf('}');
        if (start < 0 || end <= start) {
            return Optional.empty();
        }
        s = s.substring(start, end + 1);
        try {
            JsonNode node = mapper.readTree(s);
            return Optional.of(unwrap(mapper, node));
        } catch (Exception e) {
            return Optional.empty();
        }
    }

    static JsonNode unwrap(ObjectMapper mapper, JsonNode node) {
        if (node != null && node.isObject() && node.has("content") && node.size() <= 3
                && (node.has("type") || node.size() == 1)) {
            JsonNode content = node.get("content");
            if (content.isObject()) {
                return content;
            }
            if (content.isTextual()) {
                try {
                    JsonNode inner = mapper.readTree(content.asText());
                    if (inner != null && inner.isObject()) {
                        return inner;
                    }
                } catch (Exception ignored) {
                    // not JSON inside — fall through
                }
            }
        }
        return node;
    }
}
