package com.deutschflow.common.minor;

import com.deutschflow.common.exception.ConflictException;

/**
 * Cổng phát hành phiếu đánh giá gửi gia đình bị đóng vì HỒ SƠ HỌC VIÊN chưa cho phép (R6, thiết kế
 * 10/09/2026 §3.2b): học viên chưa thành niên chưa có đồng ý {@code GUARDIAN_REPORT_SHARING}, hoặc
 * chưa khai ngày sinh nên không kết luận được có cần đồng ý hay không (fail-closed, nhất quán
 * {@code OrgMinorMessageService}).
 *
 * <p><b>Vì sao 409 chứ không phải 403.</b> Người gọi (giáo viên phụ trách) CÓ quyền phát hành; thứ
 * chưa đúng là TRẠNG THÁI hồ sơ, và việc cần làm nằm ở trung tâm (ghi đồng ý giấy, bổ sung ngày sinh)
 * — đúng ngữ nghĩa "xung đột với trạng thái hiện tại của tài nguyên". Kế thừa {@link ConflictException}
 * theo cùng lối hai lớp lưới của {@link MinorAudioBlockedException}: mất handler riêng thì vẫn ra 409
 * kèm thông điệp, không rơi xuống 500.
 *
 * <p><b>Cổng dùng {@code MinorPolicy.Status.isMinor()} tường minh</b>, KHÔNG dùng
 * {@code requiresGuardianConsent()} — hàm đó trả {@code false} cho nhóm 16–17, mà pilot chính là nhóm
 * này (thiết kế §1.3).
 *
 * <p>⛔ Thông điệp KHÔNG mang ngày sinh, tuổi, tên người giám hộ — chỉ mang việc cần làm.
 */
public class ReportIssueBlockedException extends ConflictException {

    /** Mã ổn định cho client ({@code extensions.code}) — cùng họ với {@code MINOR_AUDIO_BLOCKED}. */
    public enum Reason {
        /** Chưa từng ghi đồng ý chia sẻ phiếu với người giám hộ — trung tâm cần đi thu (phiếu D1). */
        GUARDIAN_REPORT_CONSENT_REQUIRED,
        /** Đã có rồi nhưng đã bị THU HỒI — chỉ mở lại khi người giám hộ chủ động cấp lại. */
        GUARDIAN_REPORT_CONSENT_REVOKED,
        /** Chưa biết tuổi ⇒ không kết luận được ⇒ không phát hành. */
        BIRTH_DATE_REQUIRED
    }

    private final Reason reason;
    private final MinorPolicy.Status status;

    public ReportIssueBlockedException(Reason reason, MinorPolicy.Status status, String message) {
        super(message);
        this.reason = reason;
        this.status = status;
    }

    public Reason getReason() {
        return reason;
    }

    /** Nhóm tuổi lúc bị chặn — để GHI LOG, không phát ra response. */
    public MinorPolicy.Status getStatus() {
        return status;
    }
}
