package com.deutschflow.common.audit;

import java.time.Instant;

/**
 * Read model for an audit_logs row (admin audit screen). {@code category} mirrors the row's
 * target_type (USER / VOCABULARY / ORG / …) so the UI can filter by it. There is no IP column in
 * audit_logs, so none is exposed.
 *
 * <p>{@code orgId} là trung tâm mà dòng vết THUỘC VỀ — ảnh chụp lúc ghi, không suy lại lúc đọc
 * (DEC-13). Trên màn sổ của giám đốc nó chỉ để xác nhận "đây đúng là vết của trung tâm tôi"; trên
 * màn admin toàn nền tảng nó là thứ duy nhất cho biết một thao tác đã chạm vào trung tâm nào.
 * NULL = hoạt động B2C hoặc job nền.
 *
 * <p>🪤 Đây là record VỊ TRÍ và cả hai màn dùng chung nó. Trường mới đặt ở CUỐI có chủ đích: chèn
 * vào giữa sẽ dịch mọi vị trí phía sau, mà {@code eventName}/{@code category}/{@code targetType}/
 * {@code targetId} đều là String liền kề nên trượt một nấc vẫn biên dịch được và chỉ lộ ra khi
 * nhìn dữ liệu thật. Cùng lý do: câu SELECT dựng DTO đọc {@code target_type} HAI lần (cho
 * {@code category} và {@code targetType}) — đừng "tối ưu" bỏ một lần.
 */
public record AuditLogDto(
        Long id,
        String eventName,
        String category,
        Long actorUserId,
        String actorEmail,
        String actorRole,
        String targetType,
        String targetId,
        String metadataJson,
        Instant createdAt,
        Long orgId
) {}
