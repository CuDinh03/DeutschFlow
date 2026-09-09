package com.deutschflow.common.exception;

import com.deutschflow.organization.service.OrgLicenseState;

/**
 * Trung tâm đang ở chế độ CHỈ ĐỌC (D5): bị đình chỉ, hoặc giấy phép hết hạn quá 7 ngày ân hạn.
 *
 * <p>Tách khỏi {@link ForbiddenException} để giao diện phân biệt được "bạn không có quyền" với
 * "trung tâm của bạn đang bị khoá ghi" — {@code GlobalExceptionHandler} trả 403 kèm
 * {@code extensions.code = ORG_READ_ONLY} và {@code extensions.reason = SUSPENDED|EXPIRED}.
 * Đường ĐỌC không bao giờ ném lỗi này.
 */
public class OrgReadOnlyException extends RuntimeException {

    /** Mã ổn định cho client — đừng đổi, mobile/web bắt theo chuỗi này. */
    public static final String CODE = "ORG_READ_ONLY";

    private final OrgLicenseState.Reason reason;
    private final Long orgId;

    public OrgReadOnlyException(Long orgId, OrgLicenseState.Reason reason) {
        super(OrgLicenseState.message(reason));
        this.orgId = orgId;
        this.reason = reason;
    }

    public OrgLicenseState.Reason getReason() {
        return reason;
    }

    public Long getOrgId() {
        return orgId;
    }
}
