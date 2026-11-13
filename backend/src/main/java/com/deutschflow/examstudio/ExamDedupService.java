package com.deutschflow.examstudio;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.*;

/**
 * Chống trùng đề (owner yêu cầu 10/11/2026: "đảm bảo tạo đề không trùng nhau"). Bốn lớp, đều so với các Teil
 * ĐÃ DUYỆT trong kho cùng ô (kỳ thi · cấp · phần · Teil):
 * <ol>
 *   <li><b>Teil trùng Teil</b> — toàn bộ chữ của Teil (bài, mẩu rao vặt, thư, câu hỏi, phương án…) so bằng cụm
 *       {@value #TEIL_GRAM} từ; giống quá {@value #TEIL_LIMIT} theo một trong hai chiều ⇒ đỏ.</li>
 *   <li><b>Câu trùng câu</b> — câu hỏi + đáp án đúng chuẩn hoá; trùng hẳn, hoặc giống quá {@value #ITEM_LIMIT}
 *       theo cụm {@value #ITEM_GRAM} từ ⇒ đỏ.</li>
 *   <li><b>Nguồn dùng lại</b> — cùng URL đã nằm trong Teil/bản nháp khác ⇒ cảnh báo (Teil 1 và Teil 2 lấy
 *       chung một bài là hợp lệ; trùng thật sẽ bị lớp 1 bắt).</li>
 *   <li><b>Tránh từ gốc</b> — danh sách chủ đề/tiêu đề/tình huống đã có trong kho được đưa vào prompt để AI
 *       không viết lại cái đã có.</li>
 * </ol>
 * Trùng ở mức bộ đề (ghép lại cùng một bộ, dùng lại Teil kho) do {@link ExamAssemblyService} chặn.
 */
@Service
@RequiredArgsConstructor
public class ExamDedupService {

    static final int TEIL_GRAM = 6;
    static final double TEIL_LIMIT = 0.3;
    static final int ITEM_GRAM = 4;
    static final double ITEM_LIMIT = 0.7;

    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;

    public record Similar(long blockId, double score) {}

    public record ItemDup(String itemId, long blockId, String blockItemId, boolean exact) {}

    record BankBlock(long id, Map<String, Object> content) {}

    List<BankBlock> bank(String format, String level, String section, int teil) {
        return jdbc.query("""
                SELECT id, content_json::text AS c FROM exam_teil_blocks
                WHERE UPPER(exam_format) = UPPER(?) AND cefr_level = ? AND section = ? AND teil = ? AND status = 'APPROVED'
                ORDER BY id DESC LIMIT 1000
                """, (rs, n) -> new BankBlock(rs.getLong("id"), read(rs.getString("c"))), format, level, section, teil);
    }

    /** Toàn bộ chữ người học đọc được của một Teil (khuôn {@code sections_json}), bỏ khoá kỹ thuật. */
    @SuppressWarnings("unchecked")
    static String contentText(Map<String, Object> c) {
        StringBuilder sb = new StringBuilder();
        for (String k : List.of("title_de", "vorspann_de", "context", "gapped_text", "stimulus_ad")) {
            Object v = c.get(k);
            if (v != null) sb.append(v).append('\n');
        }
        for (String k : List.of("headlines", "ads", "word_bank")) {
            if (c.get(k) instanceof Map<?, ?> m) m.values().forEach(v -> sb.append(v).append('\n'));
        }
        if (c.get("stimulus") instanceof Map<?, ?> st && st.get("body") != null) sb.append(st.get("body")).append('\n');
        if (c.get("writing_points") instanceof List<?> wp) wp.forEach(p -> sb.append(p).append('\n'));
        if (c.get("examples") instanceof List<?> ex) {
            for (Object e : ex) if (e instanceof Map<?, ?> m && m.get("situation") != null) sb.append(m.get("situation")).append('\n');
        }
        // Phần Nghe: câu khung, lời thoại cấp Teil (mảng lượt lời) và lời thoại của từng câu. Câu dẫn tình huống
        // (lead_in_de) là câu nghi thức lặp lại giữa các đề nên không tính.
        if (c.get("framing_de") != null) sb.append(c.get("framing_de")).append('\n');
        if (c.get("audio_script") instanceof List<?> turns) {
            for (Object t : turns) if (t instanceof Map<?, ?> m && m.get("text") != null) sb.append(m.get("text")).append('\n');
        }
        if (c.get("items") instanceof List<?> items) {
            for (Object o : items) {
                if (!(o instanceof Map<?, ?> it)) continue;
                for (String k : List.of("text", "audio_script", "question")) {
                    if (it.get(k) instanceof String v) sb.append(v).append('\n');
                }
                if (it.get("options") instanceof Map<?, ?> op) op.values().forEach(v -> sb.append(v).append('\n'));
            }
        }
        return sb.toString();
    }

    /** Teil kho giống nhất (lấy chiều cao hơn của hai chiều chứa nhau). */
    Optional<Similar> mostSimilar(List<BankBlock> bank, String text) {
        Set<Long> mine = new HashSet<>(TextChecks.shingleHashes(text, TEIL_GRAM));
        Similar best = null;
        for (BankBlock b : bank) {
            String other = contentText(b.content());
            Set<Long> theirs = new HashSet<>(TextChecks.shingleHashes(other, TEIL_GRAM));
            double s = Math.max(TextChecks.containment(text, theirs, TEIL_GRAM), TextChecks.containment(other, mine, TEIL_GRAM));
            if (best == null || s > best.score()) best = new Similar(b.id(), s);
        }
        return Optional.ofNullable(best);
    }

    /** Câu hỏi trùng câu đã có trong kho cùng ô. */
    List<ItemDup> itemDuplicates(List<BankBlock> bank, List<ExamStudioDtos.Item> items) {
        List<ItemDup> out = new ArrayList<>();
        for (ExamStudioDtos.Item it : items) {
            // Ô điền (Sprachbausteine): câu hiển thị có "___" — so bằng câu gốc chứa ô (evidence) mới công bằng.
            String q = it.question() != null && it.question().contains("___") && it.evidence() != null
                    && !it.evidence().isBlank() ? it.evidence() : it.question();
            String mine = itemCore(q, it.options() == null || it.options().isEmpty() ? null : it.options().get(it.correct()));
            if (mine.isBlank()) continue;
            Set<Long> mineH = new HashSet<>(TextChecks.shingleHashes(mine, ITEM_GRAM));
            outer:
            for (BankBlock b : bank) {
                if (!(b.content().get("items") instanceof List<?> list)) continue;
                for (Object o : list) {
                    if (!(o instanceof Map<?, ?> bi)) continue;
                    Object opts = bi.get("options");
                    Object corr = bi.get("correct");
                    String ans = opts instanceof Map<?, ?> m && corr != null && m.get(corr) != null ? m.get(corr).toString() : null;
                    String bq = bi.get("question") != null ? str(bi.get("question")) : str(bi.get("evidence"));
                    String theirs = itemCore(bq, ans);
                    if (theirs.isBlank()) continue;
                    boolean exact = theirs.equals(mine);
                    double s = exact ? 1 : Math.max(TextChecks.containment(mine,
                            new HashSet<>(TextChecks.shingleHashes(theirs, ITEM_GRAM)), ITEM_GRAM),
                            TextChecks.containment(theirs, mineH, ITEM_GRAM));
                    if (exact || s > ITEM_LIMIT) {
                        out.add(new ItemDup(it.id(), b.id(), str(bi.get("id")), exact));
                        break outer;
                    }
                }
            }
        }
        return out;
    }

    /**
     * Những gì đã có trong kho cùng ô, rút gọn để đưa vào prompt ("đừng viết lại các chủ đề này"). Tối đa
     * {@code max} dòng, mỗi dòng ≤ 140 ký tự.
     */
    List<String> avoidList(List<BankBlock> bank, int max) {
        List<String> out = new ArrayList<>();
        for (BankBlock b : bank) {
            String head = firstNonBlank(str(b.content().get("title_de")), str(b.content().get("stimulus_ad")),
                    b.content().get("stimulus") instanceof Map<?, ?> st ? str(st.get("subject")) : null,
                    str(b.content().get("context")), str(b.content().get("gapped_text")));
            if (head == null && b.content().get("ads") instanceof Map<?, ?> ads) head = String.join(" | ", ads.values().stream()
                    .limit(3).map(Object::toString).toList());
            if (head == null && b.content().get("headlines") instanceof Map<?, ?> hl) head = String.join(" | ", hl.values().stream()
                    .limit(5).map(Object::toString).toList());
            if (head == null) head = hoerenHead(b.content());
            if (head == null) continue;
            String flat = head.replaceAll("\\s+", " ").trim();
            out.add(flat.length() > 140 ? flat.substring(0, 140) + "…" : flat);
            if (out.size() >= max) break;
        }
        return out;
    }

    /** Teil Nghe đã có: câu khung (Teil 1), lời mở đầu cuộc phỏng vấn (Teil 2) hoặc các câu dẫn tình huống (Teil 3). */
    private static String hoerenHead(Map<String, Object> content) {
        String framing = str(content.get("framing_de"));
        if (framing != null && !framing.isBlank()) return framing;
        if (content.get("audio_script") instanceof List<?> turns && !turns.isEmpty()
                && turns.get(0) instanceof Map<?, ?> first && first.get("text") != null) {
            return first.get("text").toString();
        }
        if (content.get("items") instanceof List<?> items) {
            List<String> leads = new ArrayList<>();
            for (Object o : items) {
                if (o instanceof Map<?, ?> it && it.get("lead_in_de") != null) {
                    leads.add(it.get("lead_in_de").toString().replaceFirst("^Lesen Sie jetzt die Aufgabe \\d+\\.\\s*", ""));
                }
            }
            if (!leads.isEmpty()) return String.join(" | ", leads);
        }
        return null;
    }

    /** Bản nháp/Teil khác đã dùng cùng URL (bỏ bản nháp hiện tại và bản nháp đã bỏ). */
    List<Map<String, Object>> sourceReuse(String url, long excludeDraftId) {
        if (url == null || url.isBlank()) return List.of();
        return jdbc.queryForList("""
                SELECT DISTINCT d.id AS "draftId", d.block_id AS "blockId", d.status
                FROM exam_sources s
                JOIN exam_draft_sources ds ON ds.source_id = s.id
                JOIN exam_drafts d ON d.id = ds.draft_id
                WHERE s.url = ? AND d.id <> ? AND d.status <> 'DISCARDED'
                ORDER BY d.id
                """, url.trim(), excludeDraftId);
    }

    /**
     * Hai câu của CÙNG một Teil hỏi cùng một ý (lượt tạo bộ đề #6: sinh lại riêng một câu thì câu mới trùng câu sẵn
     * có). Trả id câu sau → id câu trước mà nó trùng. Trùng = lõi (câu hỏi + đáp án đúng) giống hệt, hoặc giống từ
     * {@value #ITEM_LIMIT} theo cụm {@value #ITEM_GRAM} từ ở cả hai chiều.
     */
    static Map<String, String> duplicatesWithin(List<ExamStudioDtos.Item> items) {
        Map<String, String> out = new java.util.LinkedHashMap<>();
        List<String> ids = new ArrayList<>();
        List<String> cores = new ArrayList<>();
        // Câu điền chỗ trống: đáp án đã chuẩn hoá; câu thường: null.
        List<String> gapAnswers = new ArrayList<>();
        for (ExamStudioDtos.Item it : items) {
            boolean gap = it.question() != null && it.question().contains("___");
            String q = gap && it.evidence() != null && !it.evidence().isBlank() ? it.evidence() : it.question();
            String answer = it.options() == null || it.correct() == null ? null : it.options().get(it.correct());
            String core = itemCore(q, answer);
            String gapAnswer = gap ? (answer == null ? "" : answer.trim().toLowerCase(Locale.ROOT)) : null;
            if (!core.isBlank()) {
                for (int k = 0; k < cores.size(); k++) {
                    String other = cores.get(k);
                    // Hai chỗ trống KHÁC NHAU trong cùng một câu (đề telc Sprachbausteine vẫn làm vậy: „___ einigen
                    // Monaten …, ___ leider …") không phải câu trùng: lõi gần như giống nhau vì chung câu, nhưng mỗi
                    // chỗ hỏi một từ khác. Lượt #8, 13/11/2026: hai cặp như vậy bị báo trùng oan, Teil kẹt.
                    if (gapAnswer != null && gapAnswers.get(k) != null && !gapAnswer.equals(gapAnswers.get(k))) continue;
                    boolean same = core.equals(other);
                    if (!same) {
                        Set<Long> a = new HashSet<>(TextChecks.shingleHashes(core, ITEM_GRAM));
                        Set<Long> b = new HashSet<>(TextChecks.shingleHashes(other, ITEM_GRAM));
                        same = !a.isEmpty() && !b.isEmpty() && TextChecks.containment(core, b, ITEM_GRAM) >= ITEM_LIMIT
                                && TextChecks.containment(other, a, ITEM_GRAM) >= ITEM_LIMIT;
                    }
                    if (same) {
                        out.put(it.id(), ids.get(k));
                        break;
                    }
                }
            }
            ids.add(it.id());
            cores.add(core);
            gapAnswers.add(gapAnswer);
        }
        return out;
    }

    static String itemCore(String question, String answer) {
        // "Text 3" (Lesen T1) không phải nội dung câu — bỏ để hai câu khác nhau không bị coi là trùng.
        String q = question == null ? "" : question.replaceAll("(?i)^\\s*text\\s*\\d+\\s*$", "");
        String s = q + " " + (answer == null ? "" : answer);
        return s.toLowerCase(Locale.ROOT).replaceAll("_+\\d*_*", " ").replaceAll("[^\\p{L}\\p{N}]+", " ").trim();
    }

    private Map<String, Object> read(String json) {
        try {
            return json == null ? Map.of() : mapper.readValue(json, new TypeReference<Map<String, Object>>() {});
        } catch (Exception e) {
            return Map.of();
        }
    }

    private static String str(Object o) {
        return o == null ? null : o.toString();
    }

    private static String firstNonBlank(String... vs) {
        for (String v : vs) if (v != null && !v.isBlank()) return v;
        return null;
    }
}
