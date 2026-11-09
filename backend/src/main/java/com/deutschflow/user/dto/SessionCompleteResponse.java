package com.deutschflow.user.dto;

/**
 * Kết quả {@code POST /api/plan/sessions/complete} (A2, 09/11/2026).
 *
 * <p>Trước đây endpoint trả 200 không thân và LUÔN đánh dấu buổi COMPLETED theo số client gửi. Giờ
 * server chỉ đánh dấu xong khi đã có lần nộp đạt ngưỡng do server chấm; nếu chưa có thì vẫn trả
 * <b>200</b> (không 4xx, để client cũ không vỡ) nhưng {@code completed=false} và buổi giữ nguyên
 * trạng thái. Thân trả về là thêm mới — client cũ bỏ qua thân vẫn chạy như cũ.
 *
 * @param completed    buổi đang ở trạng thái COMPLETED sau lời gọi này
 * @param status       trạng thái lưu trong DB sau lời gọi ({@code NOT_STARTED|IN_PROGRESS|COMPLETED})
 * @param reason       {@code COMPLETED} (vừa đánh dấu xong), {@code ALREADY_COMPLETED} (gọi lại, không
 *                     đổi gì, không cộng XP lần hai) hoặc {@code NO_PASSING_SUBMIT} (chưa có lần nộp đạt)
 * @param scorePercent điểm tốt nhất server chấm cho buổi này (null nếu chưa nộp lần nào)
 * @param timeSeconds  thời gian đã lưu, đã chặn trong [0, thời lượng buổi × 3]
 */
public record SessionCompleteResponse(
        boolean completed,
        String status,
        String reason,
        Integer scorePercent,
        Double timeSeconds
) {
    public static final String REASON_COMPLETED = "COMPLETED";
    public static final String REASON_ALREADY_COMPLETED = "ALREADY_COMPLETED";
    public static final String REASON_NO_PASSING_SUBMIT = "NO_PASSING_SUBMIT";
}
