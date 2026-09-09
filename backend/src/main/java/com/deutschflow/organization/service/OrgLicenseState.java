package com.deutschflow.organization.service;

import java.time.Duration;
import java.time.Instant;

/**
 * Trạng thái giấy phép của một trung tâm — quyết định thuần, không đụng DB, để cả
 * {@link OrgGuard} (đọc {@code organizations} qua repository), {@link OrgEntitlementService}
 * (đã cầm sẵn entity) và {@code OrgQuotaService} (đọc bằng JDBC) cùng dùng MỘT luật.
 *
 * <p><b>Quyết định của owner (09/09/2026) — "chỉ-đọc ngay khi hết hạn, đình chỉ cũng ân hạn 7
 * ngày":</b>
 * <ol>
 *   <li>HẾT HẠN ({@code now > valid_until}) ⇒ CHỈ ĐỌC NGAY. Không còn quãng "hết hạn rồi vẫn ghi
 *       được 7 ngày" — đó chính là chỗ làm ngược.</li>
 *   <li>ĐÌNH CHỈ ({@code status <> 'ACTIVE'}) ⇒ cũng CHỈ ĐỌC NGAY, không cắt phăng.</li>
 *   <li>Ân hạn 7 ngày là quãng CHỈ-ĐỌC TRƯỚC KHI CẮT, áp cho CẢ hai nguyên nhân. Mốc neo:
 *       {@code valid_until} cho hết hạn, {@code suspended_at} cho đình chỉ.</li>
 *   <li>Quá 7 ngày kể từ mốc neo ⇒ {@link Mode#CUT}.</li>
 * </ol>
 *
 * <p><b>Mốc neo đình chỉ có thật:</b> {@code organizations.suspended_at} (V316) được
 * {@link com.deutschflow.organization.entity.Organization#changeStatus(String)} đóng khi đình chỉ
 * và xoá khi mở lại. Cố ý KHÔNG mượn {@code updated_at}: mọi lần sửa bản ghi (đổi tên, đổi ghế,
 * đổi pool token) đều đẩy {@code updated_at} ra xa, ân hạn sẽ không bao giờ hết — fail-open.
 *
 * <p><b>Đình chỉ mà KHÔNG có mốc neo</b> ({@code status <> 'ACTIVE'} nhưng {@code suspendedAt}
 * null — dữ liệu cũ lọt backfill, hoặc ai đó sửa tay thẳng vào DB) ⇒ {@link Mode#CUT}, KHÔNG
 * fail-open. Ân hạn là một ưu ái có thời hạn, mà thời hạn thì phải đếm từ một mốc; không mốc thì
 * không có cách nào biết ân hạn hết chưa, nên coi như đã hết. Chọn {@link Mode#READ_ONLY} thay vào
 * đó cũng là fail-open theo chiều khác: trung tâm ngừng trả tiền sẽ nằm ở chế độ chỉ đọc VĨNH VIỄN
 * mà không bao giờ bị cắt. Đường thoát vẫn rẻ và nằm sẵn trong tay quản trị: mở lại trạng thái
 * ACTIVE là mốc neo được xoá và quyền lợi được cấp lại.
 *
 * <p><b>{@code validUntil == null} khi còn ACTIVE = VÔ THỜI HẠN</b> — không hết hạn, không ân hạn.
 *
 * <p>Cả {@link Mode#READ_ONLY} lẫn {@link Mode#CUT} đều VẪN CHO ĐỌC: owner chưa bao giờ nói khoá
 * trung tâm khỏi dữ liệu của chính họ (D5 nói rõ vẫn phải xem được). "Cắt" ở đây là thu hồi QUYỀN
 * LỢI gói của học viên, không phải chặn quyền xem.
 */
public final class OrgLicenseState {

    /**
     * Ân hạn CHỈ-ĐỌC: 7 ngày kể từ mốc neo ({@code valid_until} hoặc {@code suspended_at}) trước
     * khi trung tâm bị cắt quyền lợi.
     */
    public static final Duration GRACE = Duration.ofDays(7);

    private static final String STATUS_ACTIVE = "ACTIVE";

    private OrgLicenseState() {
    }

    /** Ba mức của một trung tâm. Chỉ {@link #ACTIVE} mới ghi được; mọi mức đều còn ĐỌC được. */
    public enum Mode {
        /** Giấy phép còn hiệu lực — ghi bình thường. */
        ACTIVE,
        /** Hết hạn hoặc đình chỉ, còn trong 7 ngày ân hạn — xem được, không tạo mới, không dùng AI. */
        READ_ONLY,
        /** Quá 7 ngày kể từ mốc neo — chỉ đọc VÀ thu hồi quyền lợi gói của học viên. */
        CUT;

        /** {@code true} khi trung tâm vẫn được tạo mới / tiêu token. */
        public boolean writable() {
            return this == ACTIVE;
        }

        /** {@code true} khi đã quá ân hạn — đến lúc thu hồi quyền lợi ORG. */
        public boolean cut() {
            return this == CUT;
        }
    }

    /** Vì sao mất quyền ghi — giao diện phân biệt "chưa gia hạn" với "bị đình chỉ". */
    public enum Reason {
        SUSPENDED,
        EXPIRED
    }

    /**
     * @param status      {@code organizations.status} ({@code ACTIVE} | {@code SUSPENDED})
     * @param validUntil  hạn giấy phép; {@code null} = vô thời hạn khi còn ACTIVE
     * @param suspendedAt {@code organizations.suspended_at} — mốc neo ân hạn khi bị đình chỉ
     * @param now         mốc thời gian hiện tại
     */
    public static Mode evaluate(String status, Instant validUntil, Instant suspendedAt, Instant now) {
        if (!STATUS_ACTIVE.equals(status)) {
            // Đình chỉ, và mọi trạng thái lạ / null (fail-safe): chỉ đọc ngay, cắt sau 7 ngày.
            if (suspendedAt == null) {
                return Mode.CUT; // không mốc neo ⇒ không đếm được ân hạn ⇒ coi như đã hết (xem class doc)
            }
            return afterGrace(suspendedAt, now) ? Mode.CUT : Mode.READ_ONLY;
        }
        if (validUntil == null || !now.isAfter(validUntil)) {
            return Mode.ACTIVE; // đúng giây validUntil vẫn còn hiệu lực
        }
        return afterGrace(validUntil, now) ? Mode.CUT : Mode.READ_ONLY;
    }

    /** Đúng mốc {@code anchor + 7 ngày} vẫn CHƯA quá ân hạn; sau đó mới cắt. */
    private static boolean afterGrace(Instant anchor, Instant now) {
        return now.isAfter(anchor.plus(GRACE));
    }

    /** Lý do tương ứng khi {@link #evaluate} trả về mức không ghi được. */
    public static Reason reason(String status) {
        return STATUS_ACTIVE.equals(status) ? Reason.EXPIRED : Reason.SUSPENDED;
    }

    /**
     * Thông điệp nói rõ trung tâm đang ở trạng thái nào và ai gỡ được.
     *
     * <p>Cố ý KHÔNG nhắc "quá 7 ngày ân hạn" nữa: chế độ chỉ-đọc bắt đầu NGAY khi hết hạn / ngay
     * khi bị đình chỉ, nên câu cũ sẽ nói sai thời điểm cho phần lớn người đọc nó.
     */
    public static String message(Reason reason) {
        return reason == Reason.SUSPENDED
                ? "Trung tâm đang bị tạm ngưng nên chỉ xem được dữ liệu: không tạo mới và không dùng AI."
                    + " Hãy liên hệ quản trị hệ thống DeutschFlow để mở lại."
                : "Giấy phép của trung tâm đã hết hạn nên chỉ xem được dữ liệu: không tạo mới và"
                    + " không dùng AI. Hãy thanh toán hoá đơn để gia hạn.";
    }
}
