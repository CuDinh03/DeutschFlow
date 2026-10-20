package com.deutschflow.interview.entity;

/**
 * Trạng thái duyệt của nội dung lớp nghề (V335, đợt 2b A + B + E).
 *
 * <p>{@link #AI_GENERATED} và {@link #APPROVED} đều được dùng trong phiên — khác nhau ở nhãn hiện
 * cho người học ("AI tạo" / "Đã duyệt"). {@link #REJECTED} không bao giờ được hỏi lại.
 */
public enum OccupationContentStatus {
    AI_GENERATED,
    APPROVED,
    REJECTED;

    public boolean usableInSession() {
        return this != REJECTED;
    }
}
