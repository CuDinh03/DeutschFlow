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

    private final String auditEvent;
    private final String targetType;
    private final String targetId;
    private final Map<String, Object> auditMeta;

    public PrivilegedActionBlockedException(String message, String auditEvent,
                                            String targetType, String targetId,
                                            Map<String, Object> auditMeta) {
        super(message);
        this.auditEvent = auditEvent;
        this.targetType = targetType;
        this.targetId = targetId;
        this.auditMeta = auditMeta == null ? Map.of() : Map.copyOf(auditMeta);
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

    public Map<String, Object> getAuditMeta() {
        return auditMeta;
    }
}
