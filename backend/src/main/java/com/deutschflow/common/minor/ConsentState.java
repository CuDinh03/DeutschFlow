package com.deutschflow.common.minor;

/**
 * Trạng thái đồng ý HIỆN TẠI của một học viên cho một phạm vi — kết quả suy ra từ sổ chỉ-ghi-thêm,
 * không phải một cột trong DB.
 *
 * <p>Ba nhánh chứ không phải boolean, vì "chưa từng hỏi" và "đã hỏi rồi bị rút" là hai tình huống
 * vận hành khác hẳn nhau: cái đầu cần đi thu đồng ý, cái sau thì tuyệt đối không được hỏi lại theo
 * kiểu tự động. Cả hai đều chặn xử lý dữ liệu, nên {@link #isEffective()} gộp chúng lại cho điểm
 * gọi nào chỉ cần một câu trả lời có/không.
 */
public enum ConsentState {

    /** Chưa có dòng nào cho phạm vi này. */
    NEVER_RECORDED,

    /** Dòng mới nhất là {@link StudentConsent.Action#GRANTED}. */
    GRANTED,

    /** Dòng mới nhất là {@link StudentConsent.Action#REVOKED} — đã rút, KHÔNG còn đồng ý. */
    REVOKED;

    /** Đúng khi và chỉ khi được phép xử lý dữ liệu ở phạm vi này. */
    public boolean isEffective() {
        return this == GRANTED;
    }
}
