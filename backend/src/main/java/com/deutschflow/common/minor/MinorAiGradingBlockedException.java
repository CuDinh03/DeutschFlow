package com.deutschflow.common.minor;

import com.deutschflow.common.exception.ForbiddenException;

/**
 * Đường CHẤM BÀI BẰNG AI bị chặn vì chủ thể của bài nộp chưa đủ điều kiện về tuổi (D3, owner chốt
 * 10/09/2026: "chỉ cắm cổng cho chấm bài AI — bài viết + ảnh viết tay; chat AI không chặn; em thiếu
 * đồng ý ⇒ giáo viên chấm tay").
 *
 * <p><b>Khác {@link MinorAudioBlockedException} ở CHỦ THỂ, không ở hậu quả.</b> Trên đường ghi âm,
 * người bấm nút chính là người có giọng nói bị gửi đi. Trên đường chấm bài, người bấm nút là GIÁO
 * VIÊN còn dữ liệu bị gửi đi là bài làm của HỌC VIÊN. Vì vậy thông điệp ở đây nói với giáo viên về
 * học viên, chứ không nói với chính người bị chặn — và tuyệt đối không được dùng lại nguyên văn
 * thông điệp của đường ghi âm, vốn viết cho người học đọc.
 *
 * <p><b>Vì sao là 403 chứ không phải 409.</b> Cùng lý do đã ghi ở {@link MinorAudioBlockedException}:
 * đây là "dữ liệu không được rời hệ thống", một điều kiện của chính lượt gọi, và client cần phân biệt
 * nó với 429 hết hạn mức (tự xử lý được) — nâng gói bao nhiêu cũng không mở được cổng này. Khác với
 * {@code ReportIssueBlockedException} (409), ở đó người gọi vẫn CÓ quyền và chỉ hồ sơ chưa sẵn sàng;
 * ở đây lượt gọi bị từ chối hẳn vì nó sẽ đẩy dữ liệu của trẻ ra nhà cung cấp AI.
 *
 * <p><b>Vì sao kế thừa {@link ForbiddenException}.</b> Hai lớp lưới cố ý thừa, y như đường ghi âm:
 * mất handler riêng thì vẫn ra 403 kèm đúng thông điệp, không rơi thành 500.
 *
 * <p>⛔ Thông điệp KHÔNG mang ngày sinh, tuổi cụ thể, tên học viên hay liên hệ của người giám hộ —
 * giáo viên chỉ cần biết VIỆC CẦN LÀM. Cùng luật với metadata sổ audit ở {@link MinorLearnerService}.
 */
public class MinorAiGradingBlockedException extends ForbiddenException {

    /** Mã ổn định cho client — đừng đổi, web bắt theo chuỗi này. */
    public static final String CODE = "MINOR_AI_GRADING_BLOCKED";

    /**
     * Vì sao bị chặn. Ba nhánh vì ba việc cần làm khác hẳn nhau; như ở đường ghi âm,
     * {@link #GUARDIAN_CONSENT_REVOKED} tuyệt đối không được biến thành lời mời "đồng ý lại".
     */
    public enum Reason {
        /** Chưa từng có đồng ý cho phạm vi xử lý bằng AI — trung tâm cần đi thu. */
        GUARDIAN_CONSENT_REQUIRED,
        /** Đã có rồi nhưng đã bị THU HỒI — chỉ mở lại khi người giám hộ chủ động cấp lại. */
        GUARDIAN_CONSENT_REVOKED,
        /** Chưa biết tuổi ⇒ không kết luận được có cần đồng ý hay không ⇒ không gửi bài đi. */
        BIRTH_DATE_REQUIRED
    }

    private final Reason reason;
    private final MinorPolicy.Status status;

    public MinorAiGradingBlockedException(Reason reason, MinorPolicy.Status status, String message) {
        super(message);
        this.reason = reason;
        this.status = status;
    }

    public Reason getReason() {
        return reason;
    }

    /** Nhóm tuổi lúc bị chặn — chỉ để GHI LOG, không phát ra response (nhãn nhóm, không phải ngày sinh). */
    public MinorPolicy.Status getStatus() {
        return status;
    }
}
