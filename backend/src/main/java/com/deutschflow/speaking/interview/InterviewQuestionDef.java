package com.deutschflow.speaking.interview;

/**
 * @param questionVi bản dịch tiếng Việt cho trang công khai (K4), {@code null} = không có
 * @param questionEn bản dịch tiếng Anh cho trang công khai (K4), {@code null} = không có
 */
public record InterviewQuestionDef(
        String id,
        InterviewPhase phase,
        String topicKey,
        String questionDe,
        String questionVi,
        String questionEn
) {
    /** Câu không kèm bản dịch (bộ nhân vật trong DB, câu AI sinh theo lượt). */
    public InterviewQuestionDef(String id, InterviewPhase phase, String topicKey, String questionDe) {
        this(id, phase, topicKey, questionDe, null, null);
    }
}
