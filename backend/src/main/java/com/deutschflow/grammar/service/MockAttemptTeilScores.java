package com.deutschflow.grammar.service;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Điểm TỪNG TEIL của một lượt thi thử, để gộp vào "Bốn kỹ năng" ở trang Hôm nay (09/11/2026, Đợt 5 kế
 * hoạch sửa lỗi) — hàm thuần, không đụng DB.
 *
 * <p>Trước đây Bốn kỹ năng chỉ đọc chế độ luyện từng Teil, nên làm cả đề thi thử không làm điểm cá nhân
 * đổi. Lượt đã nộp ({@code COMPLETED}) chỉ lưu điểm theo PHẦN, nên điểm Teil được tính lại từ đáp án đã
 * nộp bằng chính bộ chấm của chế độ luyện ({@link MockExamPartialScoring} → {@link PracticeAnalysis}) —
 * cùng bài làm thì cùng điểm, và lượt cũ cũng có điểm mà không cần backfill.
 *
 * <p>Luật (giống luật lượt dừng owner chốt 07/11/2026): một Teil khách quan được tính khi đã trả lời
 * ít nhất 1 câu — Teil bỏ trắng không kéo điểm xuống, kể cả phần mà app điện thoại không hiển thị
 * được. Viết chỉ có điểm khi lượt đã nộp, bài có chữ, AI đã chấm xong ({@code SCHREIBEN.status =
 * COMPLETED}), và đề có đúng một Teil Viết (telc B1) — điểm phần lúc đó chính là điểm Teil.
 */
public final class MockAttemptTeilScores {

    private MockAttemptTeilScores() {}

    public record Score(String key, String section, int teil, double score, double max) {}

    @SuppressWarnings("unchecked")
    public static List<Score> of(String status, Map<String, Object> structure, Map<String, String> answers,
                                 Map<String, Object> detailed) {
        List<Score> out = new ArrayList<>();
        MockExamPartialScoring.Summary summary = MockExamPartialScoring.score(structure, answers);
        int writingTeile = 0;
        boolean wroteSomething = false;
        for (MockExamPartialScoring.TeilScore t : summary.teile()) {
            if ("SCHREIBEN".equals(t.section())) {
                writingTeile++;
                // Bài Viết bỏ trắng vẫn ra phần SCHREIBEN "COMPLETED 0/45" — không được kéo điểm Viết về 0.
                if (MockExamPartialScoring.WRITTEN_NOT_GRADED.equals(t.status())) wroteSomething = true;
                continue;
            }
            if (MockExamPartialScoring.SCORED.equals(t.status()) && t.max() != null && t.max() > 0) {
                out.add(new Score(t.key(), t.section(), t.teil(), t.score(), t.max()));
            }
        }
        if ("COMPLETED".equals(status) && writingTeile == 1 && wroteSomething
                && detailed != null && detailed.get("SCHREIBEN") instanceof Map<?, ?> raw) {
            Map<String, Object> w = (Map<String, Object>) raw;
            if (ExamScoringService.STATUS_COMPLETED.equals(w.get("status"))
                    && w.get("total") instanceof Number total && w.get("max") instanceof Number max
                    && max.doubleValue() > 0) {
                MockExamPartialScoring.TeilScore t = summary.teile().stream()
                        .filter(x -> "SCHREIBEN".equals(x.section())).findFirst().orElseThrow();
                out.add(new Score(t.key(), t.section(), t.teil(), total.doubleValue(), max.doubleValue()));
            }
        }
        return out;
    }
}
