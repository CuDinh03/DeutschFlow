package com.deutschflow.grammar.service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Chấm lượt thi thử DỪNG GIỮA CHỪNG (owner chốt 07/11/2026) — hàm thuần, không đụng DB.
 *
 * <p>Luật: một Teil được tính khi đã trả lời ít nhất 1 câu; câu bỏ trống trong Teil đó tính 0 (như thi
 * thật). Teil chưa chạm câu nào không tính. Bài Viết có chữ mà chưa nộp thì KHÔNG chấm (AI chỉ chấm khi
 * người học bấm nộp) — ghi là "đã viết, chưa chấm", không có điểm.
 *
 * <p>Điểm khách quan theo Teil dùng lại {@link PracticeAnalysis} (cùng bộ chấm của chế độ luyện và màn
 * phân tích lượt thi), nên điểm một Teil ở lượt dừng khớp với điểm cùng bài làm ở chế độ luyện.
 */
public final class MockExamPartialScoring {

    public static final String SCORED = "SCORED";
    public static final String NOT_ATTEMPTED = "NOT_ATTEMPTED";
    public static final String WRITTEN_NOT_GRADED = "WRITTEN_NOT_GRADED";

    private MockExamPartialScoring() {}

    /** Một Teil của lượt dừng. {@code score}/{@code max} chỉ có khi {@link #SCORED}. */
    public record TeilScore(String key, String section, int teil, String status, Double score, Double max,
                            int answered, int total) {}

    /**
     * @param teileDone    Teil đã chạm (gồm bài Viết đã có chữ)
     * @param teileCounted Teil có điểm (đã chạm, trừ Viết)
     */
    public record Summary(List<TeilScore> teile, int teileDone, int teileCounted, int teileTotal) {
        public boolean touched() {
            return teileDone > 0;
        }
    }

    public static Summary score(Map<String, Object> structure, Map<String, String> answers) {
        Map<String, String> given = answers == null ? Map.of() : answers;
        List<TeilScore> out = new ArrayList<>();
        int done = 0;
        int counted = 0;
        for (Map.Entry<String, Map<String, Object>> e : MockExamPracticeService.practiceTeile(structure).entrySet()) {
            String key = e.getKey();
            Map<String, Object> teil = e.getValue();
            String section = key.substring(0, key.lastIndexOf('-'));
            int no = teil.get("teil") instanceof Number n ? n.intValue() : 1;
            if ("SCHREIBEN".equals(section)) {
                boolean written = hasText(given.get("email_" + no)) || hasText(given.get("schreiben_" + no));
                if (written) done++;
                out.add(new TeilScore(key, section, no, written ? WRITTEN_NOT_GRADED : NOT_ATTEMPTED, null, null,
                        written ? 1 : 0, 1));
                continue;
            }
            PracticeAnalysis.TeilResult r = PracticeAnalysis.analyse(key, teil, Map.of(), given);
            int answered = (int) r.items().stream().filter(PracticeAnalysis.ItemResult::answered).count();
            if (answered == 0) {
                out.add(new TeilScore(key, section, no, NOT_ATTEMPTED, null, null, 0, r.total()));
                continue;
            }
            done++;
            counted++;
            out.add(new TeilScore(key, section, no, SCORED, r.score(), r.max(), answered, r.total()));
        }
        return new Summary(List.copyOf(out), done, counted, out.size());
    }

    /** {@code detailed_scores_json} của lượt dừng: khối {@code partial} + điểm từng Teil theo khoá. */
    public static Map<String, Object> detailedJson(Summary s, String reason) {
        Map<String, Object> partial = new LinkedHashMap<>();
        partial.put("reason", reason);
        partial.put("teile_done", s.teileDone());
        partial.put("teile_counted", s.teileCounted());
        partial.put("teile_total", s.teileTotal());
        Map<String, Object> teile = new LinkedHashMap<>();
        for (TeilScore t : s.teile()) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("status", t.status());
            if (t.score() != null) row.put("score", t.score());
            if (t.max() != null) row.put("max", t.max());
            row.put("answered", t.answered());
            row.put("total", t.total());
            teile.put(t.key(), row);
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("partial", partial);
        out.put("teile", teile);
        return out;
    }

    private static boolean hasText(String s) {
        return s != null && !s.isBlank();
    }
}
