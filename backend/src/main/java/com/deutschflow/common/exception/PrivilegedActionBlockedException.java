package com.deutschflow.common.exception;

import java.util.Map;

/**
 * Một lần thử phá bất biến đặc quyền bị guard CHẶN — kèm chất liệu để ghi vết audit
 * (audit R-M9, 03/09/2026).
 *
 * <p>Vấn đề nó giải: các guard bất biến (last-admin, 1-OWNER) ném trong {@code @Transactional},
 * nên mọi {@code auditLogService.log(...)} gọi TRƯỚC khi ném đều rollback theo transaction — lần
 * thử bị chặn hoàn toàn vô hình trong {@code audit_logs}, trong khi chính hành vi dò/leo thang này
 * là loại giám sát cần thấy nhất. Guard ném subtype này thay vì {@link BadRequestException} trần;
 * {@code GlobalExceptionHandler} bắt nó SAU khi transaction đã rollback và ghi vết trên autocommit
 * — vết sống sót, còn client vẫn nhận đúng 400 như cũ.
 *
 * <p>Vẫn là {@link BadRequestException} nên mọi test/handler đang bắt lớp cha không đổi hành vi.
 */
public class PrivilegedActionBlockedException extends BadRequestException {

    private static final String TARGET_TYPE_ORG = "ORG";

    private final String auditEvent;
    private final String targetType;
    private final String targetId;
    private final Long auditOrgId;
    private final Map<String, Object> auditMeta;

    public PrivilegedActionBlockedException(String message, String auditEvent,
                                            String targetType, String targetId,
                                            Map<String, Object> auditMeta) {
        this(message, auditEvent, targetType, targetId, orgIdOf(targetType, targetId), auditMeta);
    }

    /** Dạng đầy đủ: dùng khi thực thể bị chạm KHÔNG phải trung tâm nhưng vết vẫn thuộc một trung tâm. */
    public PrivilegedActionBlockedException(String message, String auditEvent,
                                            String targetType, String targetId, Long auditOrgId,
                                            Map<String, Object> auditMeta) {
        super(message);
        this.auditEvent = auditEvent;
        this.targetType = targetType;
        this.targetId = targetId;
        this.auditOrgId = auditOrgId;
        this.auditMeta = auditMeta == null ? Map.of() : Map.copyOf(auditMeta);
    }

    /**
     * Suy {@code org_id} của vết từ cặp target khi thực thể bị chạm chính là trung tâm — đúng theo
     * định nghĩa của cặp {@code (target_type, target_id)} trong {@code audit_logs}.
     *
     * <p>Vì sao cần: thiếu cột này, vết chặn nằm trong bảng nhưng KHÔNG hiện ở sổ hoạt động của
     * trung tâm (`GET /api/org/audit` lọc theo `org_id`) — giám đốc không bao giờ thấy có người vừa
     * thử kết nạp một quản trị viên nền tảng vào trung tâm mình, đúng thứ vết này sinh ra để nói.
     */
    private static Long orgIdOf(String targetType, String targetId) {
        if (!TARGET_TYPE_ORG.equals(targetType) || targetId == null) {
            return null;
        }
        try {
            return Long.valueOf(targetId.trim());
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    public String getAuditEvent() {
        return auditEvent;
    }

    public String getTargetType() {
        return targetType;
    }

    public String getTargetId() {
        return targetId;
    }

    /** Trung tâm mà vết này thuộc về; {@code null} khi lần chặn không gắn với trung tâm nào. */
    public Long getAuditOrgId() {
        return auditOrgId;
    }

    public Map<String, Object> getAuditMeta() {
        return auditMeta;
    }
}
