package com.deutschflow.grammar.service;

import com.deutschflow.common.exception.BadRequestException;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Kiểm và chuẩn hoá gói đánh dấu bài đọc (09/11/2026) trước khi lưu vào {@code exam_passage_marks}.
 * Hàm thuần — không đọc DB, test trực tiếp.
 *
 * <p>Gói client gửi:
 * <pre>
 * { "v": 1,
 *   "marks": [ { "id", "g", "b", "s", "e", "k": "hl"|"ul", "c": "y"|"g"|"p"|null, "q": idCâu|null, "n": ghiChú } ],
 *   "struck": { idCâu: ["a", "c"] } }
 * </pre>
 * Khối {@code b}: {@code ctx} = bài đọc ({@code teil.context}), {@code q:<id>} = đề câu ({@code item.question});
 * đợt 3: {@code t:<id>} = đoạn văn của câu Lesen 1 ({@code item.text}), {@code ad:<k>} = mẩu rao vặt Lesen 3
 * ({@code teil.ads}), {@code gap} = bức thư có chỗ trống Sprachbausteine ({@code teil.gapped_text}).
 * Server tự ghi {@code blocks{khối: hash}} theo chữ HIỆN TẠI của đề — client so hash lúc tải để bỏ đánh
 * dấu của khối đã bị sửa chữ (owner chốt: bỏ + báo một dòng, không cố gắn lại).
 *
 * <p>Lỗi cấu trúc / vượt giới hạn ⇒ {@link BadRequestException} (400), không âm thầm cắt bớt: client giữ
 * bản trên máy và báo "chưa lưu được" thay vì tưởng đã lưu.
 */
public final class PassageMarksValidator {

    public static final int VERSION = 1;
    public static final int MAX_MARKS = 300;
    public static final int MAX_NOTE = 500;
    public static final int MAX_ID = 40;
    public static final int MAX_JSON_BYTES = 64 * 1024;
    private static final Set<String> KINDS = Set.of("hl", "ul");
    private static final Set<String> COLORS = Set.of("y", "g", "p");

    /** Chế độ: luyện Teil cho đủ; thi thử / bài chẩn đoán bỏ gắn câu + ghi chú (owner chốt 09/11/2026). */
    public enum Mode { FULL, EXAM }

    private PassageMarksValidator() {}

    /**
     * Khối chữ đánh dấu được của một Teil: bài đọc + đề từng câu. Chữ đã chuẩn hoá xuống dòng
     * ({@code \r\n} → {@code \n}) — cùng cách client tính vị trí.
     */
    public static Map<String, String> blocksOf(Map<String, Object> teil) {
        Map<String, String> out = new LinkedHashMap<>();
        if (teil.get("context") instanceof String ctx && !ctx.isBlank()) out.put("ctx", normalize(ctx));
        // đợt 3 (10/11/2026): Sprachbausteine — bức thư có chỗ trống; Lesen 3 — từng mẩu rao vặt
        if (teil.get("gapped_text") instanceof String gap && !gap.isBlank()) out.put("gap", normalize(gap));
        if (teil.get("ads") instanceof Map<?, ?> ads) {
            for (Map.Entry<?, ?> e : ads.entrySet()) {
                if (e.getValue() instanceof String ad && !ad.isBlank()) out.put("ad:" + e.getKey(), normalize(ad));
            }
        }
        if (teil.get("items") instanceof List<?> items) {
            for (Object o : items) {
                if (!(o instanceof Map<?, ?> item) || item.get("id") == null) continue;
                if (item.get("question") instanceof String q && !q.isBlank()) out.put("q:" + item.get("id"), normalize(q));
                // Lesen 1: đoạn văn ngắn của từng câu
                if (item.get("text") instanceof String t && !t.isBlank()) out.put("t:" + item.get("id"), normalize(t));
            }
        }
        return out;
    }

    /** Phương án từng câu (để kiểm {@code struck}): {@code options} riêng của câu, nếu có. */
    public static Map<String, Set<String>> optionsOf(Map<String, Object> teil) {
        Map<String, Set<String>> out = new LinkedHashMap<>();
        if (!(teil.get("items") instanceof List<?> items)) return out;
        for (Object o : items) {
            if (o instanceof Map<?, ?> item && item.get("id") != null && item.get("options") instanceof Map<?, ?> opts) {
                Set<String> keys = new LinkedHashSet<>();
                opts.keySet().forEach(k -> keys.add(String.valueOf(k)));
                out.put(String.valueOf(item.get("id")), keys);
            }
        }
        return out;
    }

    public static String normalize(String text) {
        return text.replace("\r\n", "\n").replace('\r', '\n');
    }

    /**
     * FNV-1a 32 bit trên đơn vị UTF-16 (như {@code String.charAt}), 8 chữ số hex. Client tính y hệt
     * ({@code charCodeAt}) — không dùng SHA vì {@code crypto.subtle} là bất đồng bộ và cần ngữ cảnh an toàn.
     * Chỉ dùng để phát hiện chữ đổi, không phải bảo mật.
     */
    public static String hash(String text) {
        int h = 0x811c9dc5;
        for (int i = 0; i < text.length(); i++) {
            h ^= text.charAt(i);
            h *= 0x01000193;
        }
        return String.format("%08x", h);
    }

    /**
     * Trả gói đã làm sạch để lưu. {@code raw == null} hoặc rỗng ⇒ gói rỗng hợp lệ (xoá hết đánh dấu).
     *
     * @param blocks  khối chữ của Teil ({@link #blocksOf})
     * @param itemIds id các câu của Teil (để kiểm {@code q} và {@code struck})
     * @param options phương án từng câu ({@link #optionsOf}); câu không có phương án riêng ⇒ không gạch bỏ được
     */
    public static Map<String, Object> clean(Map<String, Object> raw, Map<String, String> blocks, Set<String> itemIds,
                                           Map<String, Set<String>> options, Mode mode) {
        Map<String, Object> in = raw == null ? Map.of() : raw;
        List<Map<String, Object>> marks = new ArrayList<>();
        Set<String> usedBlocks = new LinkedHashSet<>();

        Object rawMarks = in.get("marks");
        if (rawMarks != null && !(rawMarks instanceof List<?>)) throw bad("marks phải là danh sách");
        if (rawMarks instanceof List<?> list) {
            if (list.size() > MAX_MARKS) throw bad("Quá nhiều đánh dấu (tối đa " + MAX_MARKS + ")");
            for (Object o : list) {
                if (!(o instanceof Map<?, ?> m)) throw bad("Mỗi đánh dấu phải là một đối tượng");
                Map<String, Object> mark = cleanMark(m, blocks, itemIds, mode);
                marks.add(mark);
                usedBlocks.add((String) mark.get("b"));
            }
        }

        Map<String, List<String>> struck = new LinkedHashMap<>();
        Object rawStruck = in.get("struck");
        if (rawStruck != null && !(rawStruck instanceof Map<?, ?>)) throw bad("struck phải là đối tượng");
        if (rawStruck instanceof Map<?, ?> sm) {
            for (Map.Entry<?, ?> e : sm.entrySet()) {
                String id = String.valueOf(e.getKey());
                Set<String> opts = options.get(id);
                if (opts == null) throw bad("Câu không gạch bỏ được: " + id);
                if (!(e.getValue() instanceof List<?> letters)) throw bad("struck." + id + " phải là danh sách");
                Set<String> picked = new LinkedHashSet<>();
                for (Object l : letters) {
                    String letter = String.valueOf(l);
                    if (!opts.contains(letter)) throw bad("Phương án lạ ở câu " + id + ": " + letter);
                    picked.add(letter);
                }
                if (!picked.isEmpty()) struck.put(id, new ArrayList<>(picked));
            }
        }

        Map<String, String> hashes = new LinkedHashMap<>();
        for (String b : usedBlocks) hashes.put(b, hash(blocks.get(b)));

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("v", VERSION);
        out.put("blocks", hashes);
        out.put("marks", marks);
        out.put("struck", struck);
        return out;
    }

    private static Map<String, Object> cleanMark(Map<?, ?> m, Map<String, String> blocks, Set<String> itemIds, Mode mode) {
        String id = text(m.get("id"), "id", MAX_ID, true);
        String g = text(m.get("g"), "g", MAX_ID, true);
        String b = text(m.get("b"), "b", MAX_ID + 2, true);
        String block = blocks.get(b);
        if (block == null) throw bad("Khối chữ lạ: " + b);
        int s = integer(m.get("s"), "s");
        int e = integer(m.get("e"), "e");
        if (s < 0 || e <= s || e > block.length()) throw bad("Vị trí đánh dấu không hợp lệ: " + s + "–" + e);
        String k = text(m.get("k"), "k", 2, true);
        if (!KINDS.contains(k)) throw bad("Loại đánh dấu lạ: " + k);
        String c = text(m.get("c"), "c", 1, false);
        if ("hl".equals(k) && (c == null || !COLORS.contains(c))) throw bad("Màu lạ: " + c);
        if ("ul".equals(k)) c = null;
        String q = text(m.get("q"), "q", MAX_ID, false);
        if (q != null && !itemIds.contains(q)) throw bad("Câu lạ: " + q);
        String n = m.get("n") == null ? "" : String.valueOf(m.get("n")).strip();
        if (n.length() > MAX_NOTE) throw bad("Ghi chú quá dài (tối đa " + MAX_NOTE + " ký tự)");
        if (mode == Mode.EXAM) { q = null; n = ""; }

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("id", id);
        out.put("g", g);
        out.put("b", b);
        out.put("s", s);
        out.put("e", e);
        out.put("k", k);
        out.put("c", c);
        out.put("q", q);
        out.put("n", n);
        return out;
    }

    private static String text(Object v, String field, int max, boolean required) {
        if (v == null || String.valueOf(v).isBlank()) {
            if (required) throw bad("Thiếu " + field);
            return null;
        }
        if (!(v instanceof String str)) throw bad(field + " phải là chuỗi");
        if (str.length() > max) throw bad(field + " quá dài");
        return str;
    }

    private static int integer(Object v, String field) {
        if (v instanceof Integer i) return i;
        if (v instanceof Long l && l >= Integer.MIN_VALUE && l <= Integer.MAX_VALUE) return l.intValue();
        throw bad(field + " phải là số nguyên");
    }

    private static BadRequestException bad(String message) {
        return new BadRequestException(message);
    }
}
