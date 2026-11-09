package com.deutschflow.grammar.dto;

import java.time.Instant;
import java.util.List;
import java.util.Map;

/** Hợp đồng API của chế độ luyện đề telc (03/11/2026) — {@code /api/mock-exams/practice}. */
public final class PracticeDtos {

    private PracticeDtos() {}

    /** Đề và tiến độ từng Teil của người đang xem. {@code sectionsJson} đã gỡ đáp án như {@code /questions}. */
    public record Overview(long examId, String title, String level, String format, String sectionsJson,
                           List<Teil> teile) {}

    /**
     * Một Teil luyện được. {@code key} = {@code TÊN_PHẦN-số_teil}, ví dụ {@code LESEN-1}.
     * {@code suggestMinutes} là giờ gợi ý (không ép nộp); {@code null} nếu đề không gợi ý.
     */
    public record Teil(String key, String section, int teil, String type, int items, double maxPoints,
                       Integer suggestMinutes, Progress progress) {}

    /**
     * {@code result}: phân tích đã lưu (Teil khách quan) hoặc phiếu chấm AI (Teil Viết).
     * {@code checkedAt} (09/11/2026): lúc CHẤM gần nhất — khác {@code updatedAt}, vốn đổi cả khi chỉ lưu
     * nháp (Viết giữ điểm cũ khi lưu nháp). "Bốn kỹ năng" so mốc này với lượt thi thử.
     */
    public record Progress(Map<String, String> answers, boolean checked, Double score, Double max,
                           int elapsedSeconds, Instant updatedAt, Object result, Instant checkedAt,
                           Map<String, String> notes) {
        public Progress(Map<String, String> answers, boolean checked, Double score, Double max,
                        int elapsedSeconds, Instant updatedAt, Object result) {
            this(answers, checked, score, max, elapsedSeconds, updatedAt, result, null, Map.of());
        }
    }

    /**
     * {@code notes} (B3, 09/11/2026, tuỳ chọn): "vì sao tôi chọn" — ghi chú ngắn theo câu, {@code {itemId: chữ}}.
     * Không gửi ({@code null}) thì giữ ghi chú đã lưu — client cũ / bài chẩn đoán không xoá mất ghi chú.
     */
    public record SaveRequest(Map<String, String> answers, Integer elapsedSeconds, Map<String, String> notes) {
        public SaveRequest(Map<String, String> answers, Integer elapsedSeconds) {
            this(answers, elapsedSeconds, null);
        }
    }

    /** Thân {@code POST .../ask-ai}: ngôn ngữ giao diện của người học ({@code vi} mặc định, {@code en}, {@code de}). */
    public record AskAiRequest(String locale) {}

    /**
     * Lời giải thích AI cho MỘT câu đã nộp. {@code cached = true}: lấy từ bộ nhớ đệm, không gọi AI, không trừ quota.
     */
    public record ItemAiAnswer(String itemId, String locale, String answer, boolean cached) {}

    public record WritingRequest(String text, Integer elapsedSeconds) {}

    public record Access(boolean enabled) {}

    public record JobAccepted(String jobId, String status) {}

    /**
     * Điểm một Teil lấy từ một lượt thi thử (09/11/2026) — trang Hôm nay gộp vào "Bốn kỹ năng".
     * {@code at} = lúc lượt đó kết thúc, so với {@code Progress.checkedAt} để lấy lần gần nhất.
     */
    public record MockTeilScore(long attemptId, long examId, String key, String section, int teil,
                                double score, double max, Instant at) {}

    /**
     * Phân tích một lượt thi thử trọn đề (06/11/2026) bằng cùng bộ phân tích của chế độ luyện:
     * mỗi Teil khách quan một {@code TeilResult}; bài Viết = văn bản đã nộp + phiếu chấm AI đã lưu.
     */
    public record AttemptAnalysis(long attemptId, long examId, String sectionsJson,
                                  List<com.deutschflow.grammar.service.PracticeAnalysis.TeilResult> teile,
                                  String writingText, Object writing) {}
}
