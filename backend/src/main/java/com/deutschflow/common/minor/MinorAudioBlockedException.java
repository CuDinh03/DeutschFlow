package com.deutschflow.common.minor;

import com.deutschflow.common.exception.ForbiddenException;

/**
 * Đường ghi âm bị chặn vì CHƯA ĐỦ ĐIỀU KIỆN VỀ TUỔI — giọng nói thật của một người có thể chưa
 * thành niên không được gửi ra nhà cung cấp AI khi chưa có đồng ý (DEC-22).
 *
 * <p><b>Vì sao KHÔNG tái dùng {@code QuotaExceededException}.</b> Hai lỗi này trông giống nhau ở
 * chỗ "đều chặn một lượt gọi AI" nhưng cách xử hoàn toàn ngược nhau: hết hạn mức thì đợi sang
 * tháng, nạp thêm, hoặc nâng gói — người dùng tự làm được. Chưa đủ điều kiện về tuổi thì nâng gói
 * bao nhiêu cũng vô ích; phải có người khác (trung tâm, người giám hộ) làm một việc ngoài ứng dụng.
 * Gộp vào 429 {@code QUOTA_EXCEEDED} là đẩy trẻ em vào đúng cái phễu mời nâng cấp gói — sai cả
 * nghiệp vụ lẫn đạo đức. Vì vậy đây là 403 với mã riêng.
 *
 * <p><b>Vì sao kế thừa {@link ForbiddenException}.</b> Hai lớp lưới, cố ý thừa (cùng lối nghĩ của
 * {@link StudentConsent}): {@code GlobalExceptionHandler} có handler riêng cho lớp này để phát
 * {@code extensions.code} + {@code extensions.reason} máy đọc được; nhưng nếu handler đó biến mất
 * trong một lần merge, lỗi vẫn rơi vào {@code handleForbidden} và ra 403 kèm đúng thông điệp — chứ
 * KHÔNG rơi xuống {@code handleGeneral(Exception)} thành 500 "lỗi hệ thống". Một chốt bảo vệ trẻ em
 * mà hỏng thành 500 thì người vận hành sẽ đọc nó như một sự cố cần tắt đi.
 *
 * <p>⛔ Thông điệp KHÔNG mang ngày sinh, tuổi cụ thể, tên hay liên hệ của người giám hộ — chỉ mang
 * việc cần làm. Cùng luật với metadata sổ audit ở {@link MinorLearnerService}.
 */
public class MinorAudioBlockedException extends ForbiddenException {

    /** Mã ổn định cho client — đừng đổi, mobile/web bắt theo chuỗi này. */
    public static final String CODE = "MINOR_AUDIO_BLOCKED";

    /**
     * Vì sao bị chặn. Ba nhánh vì ba việc cần làm khác hẳn nhau — client không được gộp chúng vào
     * một thông báo chung, và {@link #GUARDIAN_CONSENT_REVOKED} tuyệt đối không được biến thành
     * lời mời "đồng ý lại" tự động (xem javadoc {@link ConsentState}).
     */
    public enum Reason {
        /** Chưa từng có đồng ý cho phạm vi ghi âm — trung tâm cần đi thu. */
        GUARDIAN_CONSENT_REQUIRED,
        /** Đã có rồi nhưng đã bị THU HỒI — chỉ mở lại khi người giám hộ chủ động cấp lại. */
        GUARDIAN_CONSENT_REVOKED,
        /** Chưa biết tuổi. Không thể kết luận cần hay không cần đồng ý ⇒ không gửi giọng nói đi. */
        BIRTH_DATE_REQUIRED
    }

    private final Reason reason;
    private final MinorPolicy.Status status;

    public MinorAudioBlockedException(Reason reason, MinorPolicy.Status status, String message) {
        super(message);
        this.reason = reason;
        this.status = status;
    }

    public Reason getReason() {
        return reason;
    }

    /**
     * Nhóm tuổi lúc bị chặn — dùng để GHI LOG và chẩn đoán, không phát ra response.
     * Đây là nhãn nhóm ({@code MINOR_LEGAL}…), không phải ngày sinh, nên an toàn cho log.
     */
    public MinorPolicy.Status getStatus() {
        return status;
    }
}
