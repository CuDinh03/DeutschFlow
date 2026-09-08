package com.deutschflow.organization.service;

import java.time.Duration;
import java.time.Instant;

/**
 * Trạng thái giấy phép của một trung tâm — quyết định thuần, không đụng DB, để cả
 * {@link OrgGuard} (đọc {@code organizations} qua repository), {@link OrgEntitlementService}
 * (đã cầm sẵn entity) và {@code OrgQuotaService} (đọc bằng JDBC) cùng dùng MỘT luật.
 *
 * <p><b>Quyết định D5 của owner (08/09/2026):</b> trung tâm hết hạn hoặc bị đình chỉ ⇒ chế độ
 * CHỈ ĐỌC — vẫn XEM được dữ liệu, nhưng không tạo mới và không dùng AI — với ân hạn 7 ngày
 * trước khi cắt.
 *
 * <p><b>Mốc tính ân hạn:</b> ân hạn chỉ áp cho HẾT HẠN giấy phép, vì {@code valid_until} là mốc
 * thời gian có thật để cộng thêm 7 ngày. ĐÌNH CHỈ ({@code status <> 'ACTIVE'}) cắt ngay: đó là
 * hành động chủ động của quản trị hệ thống (đã cân nhắc trước khi bấm), và bảng
 * {@code organizations} KHÔNG có cột {@code suspended_at} để neo ân hạn — mượn {@code updated_at}
 * sẽ fail-open (bất kỳ lần sửa nào cũng đẩy mốc ra xa, trung tâm bị đình chỉ vẫn ghi được). Nếu
 * sau này owner muốn ân hạn cho cả đình chỉ thì phải thêm cột {@code suspended_at} bằng migration.
 */
public final class OrgLicenseState {

    /** Ân hạn sau khi giấy phép hết hạn, trước khi trung tâm rơi vào chế độ chỉ đọc (D5). */
    public static final Duration GRACE = Duration.ofDays(7);

    private static final String STATUS_ACTIVE = "ACTIVE";

    private OrgLicenseState() {
    }

    /** Ba mức của một trung tâm. Chỉ {@link #READ_ONLY} mới chặn ghi. */
    public enum Mode {
        /** Giấy phép còn hiệu lực — ghi bình thường. */
        ACTIVE,
        /** Giấy phép đã hết hạn nhưng còn trong 7 ngày ân hạn — vẫn ghi được. */
        GRACE,
        /** Đình chỉ, hoặc hết hạn quá ân hạn — chỉ đọc. */
        READ_ONLY;

        /** {@code true} khi trung tâm vẫn được tạo mới / tiêu token. */
        public boolean writable() {
            return this != READ_ONLY;
        }
    }

    /** Vì sao rơi vào chế độ chỉ đọc — giao diện phân biệt "chưa gia hạn" với "bị đình chỉ". */
    public enum Reason {
        SUSPENDED,
        EXPIRED
    }

    /**
     * @param status     {@code organizations.status} ({@code ACTIVE} | {@code SUSPENDED})
     * @param validUntil hạn giấy phép; {@code null} = vô thời hạn khi còn ACTIVE
     * @param now        mốc thời gian hiện tại
     */
    public static Mode evaluate(String status, Instant validUntil, Instant now) {
        if (!STATUS_ACTIVE.equals(status)) {
            return Mode.READ_ONLY; // đình chỉ (và mọi trạng thái lạ — fail-safe) cắt ngay
        }
        if (validUntil == null || !now.isAfter(validUntil)) {
            return Mode.ACTIVE;
        }
        return now.isAfter(validUntil.plus(GRACE)) ? Mode.READ_ONLY : Mode.GRACE;
    }

    /** Lý do tương ứng khi {@link #evaluate} trả {@link Mode#READ_ONLY}. */
    public static Reason reason(String status) {
        return STATUS_ACTIVE.equals(status) ? Reason.EXPIRED : Reason.SUSPENDED;
    }

    /** Thông điệp nói rõ trung tâm đang ở trạng thái nào và ai gỡ được. */
    public static String message(Reason reason) {
        return reason == Reason.SUSPENDED
                ? "Trung tâm đang bị tạm ngưng nên chỉ xem được dữ liệu: không tạo mới và không dùng AI."
                    + " Hãy liên hệ quản trị hệ thống DeutschFlow để mở lại."
                : "Giấy phép của trung tâm đã hết hạn quá 7 ngày ân hạn nên chỉ xem được dữ liệu:"
                    + " không tạo mới và không dùng AI. Hãy thanh toán hoá đơn để gia hạn.";
    }
}
