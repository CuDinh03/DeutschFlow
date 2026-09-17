package com.deutschflow.user.onboarding;

/**
 * Loại "bài học đầu tiên" đã hoàn thành — nguồn của ACTIVATION (spec §1, §4.6 kế hoạch 17/09).
 *
 * <p>Năm nguồn cùng đổ vào một endpoint/một cột {@code activated_at}; cột chỉ ghi lần đầu,
 * các lần sau chỉ nối thêm vào {@code completed_activities}. Thêm nguồn mới = thêm hằng ở đây
 * VÀ một hook ở chỗ hoàn thành thật của nó (không để client tự khai).
 */
public enum FirstLessonKind {
    /** Mobile "Câu đầu tiên" — chấm cục bộ trên máy, không có bản ghi server nào khác ⇒ client gọi. */
    FIRST_SENTENCE,
    /** Web "Ngày 1" {@code POST /api/beginner/first-session/complete} — hook server. */
    BEGINNER_SESSION,
    /** Bài kiểm tra đầu vào 10 câu {@code POST /api/skill-tree/placement-test/{id}/submit} — hook server. */
    PLACEMENT,
    /** Nói thử 3 phút {@code POST /api/onboarding/mock-exam/evaluate} — hook server. */
    MOCK_EXAM,
    /** Chặng đầu tiên trên lộ trình (cây v2 hoặc skill-tree lý thuyết) — hook server. */
    ROADMAP_NODE
}
