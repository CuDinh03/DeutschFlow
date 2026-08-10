package com.deutschflow.speaking.interview;

import com.deutschflow.speaking.entity.AiSpeakingMessage;

import java.util.List;

/**
 * Đợt C kế hoạch 10/08 — "chấm trên bằng chứng": thay transcript thô bằng bảng evidence theo lượt
 * cho prompt chấm phỏng vấn. Mỗi lượt gồm câu hỏi, câu trả lời NGUYÊN VĂN (nguồn trích dẫn cho
 * validator) và các cờ phân tích do server tính lại bằng {@link InterviewAnswerAnalyzer}
 * (deterministic — chạy lại lúc chấm, không cần lưu thêm cột nào).
 */
public final class InterviewEvidenceLedger {

    private static final int QUESTION_PREVIEW_CHARS = 200;

    private InterviewEvidenceLedger() {}

    public static String build(List<AiSpeakingMessage> messages,
                               InterviewAnswerAnalyzer analyzer,
                               String experienceLevel) {
        StringBuilder sb = new StringBuilder();
        String lastQuestion = "(Gesprächsbeginn)";
        int userTurn = 0;
        for (AiSpeakingMessage m : messages) {
            if (m.getRole() == AiSpeakingMessage.MessageRole.ASSISTANT) {
                if (m.getAiSpeechDe() != null && !m.getAiSpeechDe().isBlank()) {
                    lastQuestion = m.getAiSpeechDe();
                }
                continue;
            }
            userTurn++;
            String answer = m.getUserText() != null ? m.getUserText() : "";
            InterviewAnswerAnalysis a = analyzer.analyze(
                    answer, InterviewPhase.fromUserTurn(userTurn), experienceLevel);
            sb.append("[Lượt ").append(userTurn).append("]\n")
                    .append("  FRAGE: \"").append(truncate(lastQuestion)).append("\"\n")
                    .append("  ANTWORT (wörtlich): \"").append(answer).append("\"\n")
                    .append("  SERVER-FAKTEN: konkretesBeispiel=").append(a.concreteExample())
                    .append(", schwacheAntwort=").append(a.weakAnswer())
                    .append(", monolog=").append(a.monologue())
                    .append(", hypothetisch=").append(a.hypotheticalHeavy())
                    .append("\n\n");
        }
        return sb.toString();
    }

    private static String truncate(String s) {
        return s.length() <= QUESTION_PREVIEW_CHARS ? s : s.substring(0, QUESTION_PREVIEW_CHARS) + "…";
    }
}
