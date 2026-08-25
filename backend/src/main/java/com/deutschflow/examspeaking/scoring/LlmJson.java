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

    /**
     * Lấy chuỗi văn bản do LLM sinh và chuẩn hoá cho hiển thị/đọc TTS.
     *
     * 🪤 LLM hay trả JSON DOUBLE-ESCAPE (`"...zusammen.\\n Wie oft..."`): Jackson decode ra đúng
     * hai ký tự `\` + `n` nên chuỗi `\n` lòi nguyên văn ra UI và TTS đọc thành "backslash en"
     * (owner bắt được trên prod 26/08). Ở đây `\n`/`\r`/`\t` literal — và cả xuống dòng thật —
     * đều thành một khoảng trắng: lời thoại là câu NÓI, không có khái niệm xuống dòng.
     */
    public static String speechText(JsonNode node, String field) {
        if (node == null) return "";
        return normalizeSpeech(node.path(field).asText(""));
    }

    /** @see #speechText(JsonNode, String) */
    public static String normalizeSpeech(String raw) {
        if (raw == null || raw.isBlank()) return "";
        return raw.replaceAll("\\\\[nrt]", " ")   // literal \n \r \t (LLM double-escape)
                  .replaceAll("\\s+", " ")        // xuống dòng thật + khoảng trắng thừa
                  .trim();
    }

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
