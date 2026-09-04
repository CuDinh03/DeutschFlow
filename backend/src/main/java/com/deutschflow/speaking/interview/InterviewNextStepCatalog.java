package com.deutschflow.speaking.interview;

import com.deutschflow.speaking.entity.AiSpeakingMessage;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
 * Đợt D kế hoạch 10/08 — "lời khuyên = hướng đi thực tế trong app": danh mục hành động CHUẨN mà
 * report phỏng vấn được phép gợi ý. Model chỉ CHỌN mã từ danh mục (kèm lý do); mã lạ hoặc mã có
 * điều kiện không thoả bị {@link InterviewReportValidator#sanitizeNextSteps} lọc trước khi lưu.
 * FE ánh xạ mã → nút hành động (phỏng vấn lại, ôn lỗi, luyện STAR…), backend không cần biết route.
 */
public final class InterviewNextStepCatalog {

    public static final String RETRY_SAME_POSITION = "RETRY_SAME_POSITION";
    public static final String PRACTICE_STAR = "PRACTICE_STAR";
    public static final String DRILL_ERRORS = "DRILL_ERRORS";
    public static final String EXPAND_ANSWERS = "EXPAND_ANSWERS";
    public static final String FACH_VOCAB = "FACH_VOCAB";

    /** Câu trả lời trung bình dưới ngưỡng này (từ/lượt) thì mở hành động "tập trả lời dài hơn". */
    static final int SHORT_ANSWER_AVG_WORDS = 12;

    private InterviewNextStepCatalog() {}

    /**
     * Tập mã hợp lệ cho phiên này — điều kiện tính từ dữ liệu KHÁCH QUAN (orchestrator state,
     * lỗi đã ghi nhận, độ dài câu trả lời), không phụ thuộc model.
     */
    public static Set<String> allowedFor(InterviewSessionState state,
                                         int sessionErrorCount,
                                         List<AiSpeakingMessage> messages) {
        Set<String> allowed = new LinkedHashSet<>();
        allowed.add(RETRY_SAME_POSITION);
        if (state == null || !state.isConcreteExampleGiven()) {
            allowed.add(PRACTICE_STAR);
        }
        if (sessionErrorCount > 0) {
            allowed.add(DRILL_ERRORS);
        }
        if (averageUserWords(messages) < SHORT_ANSWER_AVG_WORDS) {
            allowed.add(EXPAND_ANSWERS);
        }
        allowed.add(FACH_VOCAB);
        return allowed;
    }

    /** Khối mô tả danh mục nhét vào prompt chấm — model chỉ được chọn trong các mã liệt kê ở đây. */
    public static String promptBlock(Set<String> allowed) {
        StringBuilder sb = new StringBuilder();
        for (String code : allowed) {
            sb.append("- ").append(code).append(": ").append(switch (code) {
                case RETRY_SAME_POSITION -> "Phỏng vấn lại đúng vị trí này sau khi luyện thêm";
                case PRACTICE_STAR -> "Luyện kể tình huống theo STAR (Situation-Task-Action-Result) — chọn khi thiếu ví dụ cụ thể";
                case DRILL_ERRORS -> "Ôn lại đúng các lỗi ngữ pháp đã ghi nhận trong phiên";
                case EXPAND_ANSWERS -> "Tập trả lời 3–4 câu thay vì 1 câu — chọn khi câu trả lời quá ngắn";
                case FACH_VOCAB -> "Luyện từ vựng chuyên ngành của vị trí ứng tuyển";
                default -> "";
            }).append("\n");
        }
        return sb.toString();
    }

    public static boolean isKnown(String code) {
        return code != null && switch (code) {
            case RETRY_SAME_POSITION, PRACTICE_STAR, DRILL_ERRORS, EXPAND_ANSWERS, FACH_VOCAB -> true;
            default -> false;
        };
    }

    static int averageUserWords(List<AiSpeakingMessage> messages) {
        List<String> userTexts = messages.stream()
                .filter(m -> m.getRole() == AiSpeakingMessage.MessageRole.USER)
                .map(m -> m.getUserText() != null ? m.getUserText() : "")
                .toList();
        if (userTexts.isEmpty()) {
            return 0;
        }
        return InterviewReportValidator.countWords(userTexts) / userTexts.size();
    }
}
