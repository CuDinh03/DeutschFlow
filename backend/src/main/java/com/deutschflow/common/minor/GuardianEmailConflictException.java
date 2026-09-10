package com.deutschflow.common.minor;

import com.deutschflow.common.exception.BadRequestException;

/**
 * 400 + {@code extensions.code = GUARDIAN_EMAIL_IS_STUDENT_EMAIL} — email người giám hộ trùng email
 * của chính học viên (so không phân biệt hoa thường).
 *
 * <p>Email giám hộ là địa chỉ nhận phiếu đánh giá (R6, scope {@code GUARDIAN_REPORT_SHARING}) và là
 * kênh liên lạc khi cần một người lớn. Để nó trùng email học viên là biến "đồng ý của người giám
 * hộ" thành đồng ý do trẻ tự cấp cho mình, và phiếu gửi "cho phụ huynh" rơi vào hộp thư của em ấy.
 * Tách mã riêng khỏi {@link BadRequestException} trần để client hiện đúng việc cần làm ("nhập email
 * của cha mẹ/người giám hộ") thay vì một câu 400 chung; cùng họ mã với {@code MINOR_AUDIO_BLOCKED}.
 * Đường CSV chặn cùng luật ở {@code RosterMinorColumnReader} với câu có số dòng.
 */
public class GuardianEmailConflictException extends BadRequestException {

    public static final String CODE = "GUARDIAN_EMAIL_IS_STUDENT_EMAIL";

    public GuardianEmailConflictException(String message) {
        super(message, CODE);
    }
}
