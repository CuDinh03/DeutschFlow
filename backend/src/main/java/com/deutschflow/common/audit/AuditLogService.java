package com.deutschflow.common.audit;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.sql.Timestamp;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class AuditLogService {

    /** Hard cap so a huge/abusive page size can never scan the whole table. */
    private static final int MAX_PAGE_SIZE = 100;

    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;

    /**
     * Paginated, filtered read of audit_logs for the admin audit screen (newest first).
     *
     * @param q   optional case-insensitive search over event_name / actor_email / target_id
     * @param cat optional category = target_type exact match (USER, VOCABULARY, ORG, …)
     * @return envelope {@code {items: List<AuditLogDto>, total, page, size}}
     */
    public Map<String, Object> readAuditLogs(String q, String cat, int page, int size) {
        return read(null, q, cat, page, size);
    }

    /**
     * Sổ hoạt động của MỘT trung tâm (C6) — chỉ những vết do thành viên trung tâm đó tạo ra.
     *
     * <p>Lọc bằng cột {@code org_id} chụp lúc ghi vết, KHÔNG join sang trạng thái hiện tại của
     * actor: người rời trung tâm rồi thì vết cũ vẫn thuộc về trung tâm cũ, đúng ngữ nghĩa bằng
     * chứng. Dòng không có org (hoạt động B2C) không bao giờ lọt vào đây vì {@code org_id = ?}
     * loại NULL.
     */
    public Map<String, Object> readOrgAuditLogs(Long orgId, String q, String cat, int page, int size) {
        if (orgId == null) {
            throw new IllegalArgumentException("orgId is required");
        }
        return read(orgId, q, cat, page, size);
    }

    private Map<String, Object> read(Long orgId, String q, String cat, int page, int size) {
        int safeSize = Math.min(Math.max(size, 1), MAX_PAGE_SIZE);
        int safePage = Math.max(page, 0);

        StringBuilder where = new StringBuilder(" WHERE 1=1");
        List<Object> args = new ArrayList<>();
        if (orgId != null) {
            where.append(" AND org_id = ?");
            args.add(orgId);
        }
        if (cat != null && !cat.isBlank()) {
            where.append(" AND target_type = ?");
            args.add(cat.trim());
        }
        if (q != null && !q.isBlank()) {
            String like = "%" + q.trim() + "%";
            where.append(" AND (event_name ILIKE ? OR actor_email ILIKE ? OR target_id ILIKE ?)");
            args.add(like);
            args.add(like);
            args.add(like);
        }

        Long total = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM audit_logs" + where, Long.class, args.toArray());

        List<Object> pageArgs = new ArrayList<>(args);
        pageArgs.add(safeSize);
        pageArgs.add(safePage * safeSize);
        List<AuditLogDto> items = jdbcTemplate.query(
                "SELECT id, event_name, actor_user_id, actor_email, actor_role, target_type, "
                        + "target_id, metadata_json, created_at, org_id FROM audit_logs" + where
                        + " ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?",
                (rs, rowNum) -> {
                    Timestamp ts = rs.getTimestamp("created_at");
                    return new AuditLogDto(
                            rs.getLong("id"),
                            rs.getString("event_name"),
                            rs.getString("target_type"),
                            (Long) rs.getObject("actor_user_id"),
                            rs.getString("actor_email"),
                            rs.getString("actor_role"),
                            rs.getString("target_type"),
                            rs.getString("target_id"),
                            rs.getString("metadata_json"),
                            ts != null ? ts.toInstant() : null,
                            (Long) rs.getObject("org_id"));
                },
                pageArgs.toArray());

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("items", items);
        out.put("total", total != null ? total : 0L);
        out.put("page", safePage);
        out.put("size", safeSize);
        return out;
    }

    /**
     * Ghi vết cho một mutation, actor gói trong {@link AuditActor}.
     *
     * <p>Chạy TRONG transaction nghiệp vụ đang mở: {@code JdbcTemplate} lấy connection qua
     * {@code DataSourceUtils} nên dùng chung connection với JPA — chính cơ chế mà
     * {@code OrgMembershipService} dựa vào để giữ {@code SELECT … FOR UPDATE} tới lúc commit. Hệ
     * quả cố ý: nghiệp vụ rollback thì vết cũng biến mất, chỉ thao tác THÀNH CÔNG mới để lại vết.
     */
    public void log(
            String eventName,
            AuditActor actor,
            String targetType,
            String targetId,
            Map<String, Object> metadata
    ) {
        log(eventName, actor, targetType, targetId, null, metadata);
    }

    /**
     * Ghi vết cho một mutation, kèm trung tâm BỊ TÁC ĐỘNG (DEC-13, owner chốt 09/09/2026).
     *
     * <p><b>Vì sao cần bản này.</b> Bản không có {@code touchedOrgId} suy tổ chức từ
     * {@code users.org_id} của NGƯỜI THAO TÁC. Với thao tác của chính người trong trung tâm thì
     * đúng, nhưng DEC-13 nói admin nền tảng KHÔNG BAO GIỜ là thành viên trung tâm ⇒
     * {@code users.org_id} của admin luôn NULL ⇒ mọi vết admin ghi ra rơi vào diện "B2C/hệ thống",
     * mà {@link #readOrgAuditLogs} lọc {@code AND org_id = ?} nên loại sạch NULL. Nghịch lý: admin
     * càng tuân thủ DEC-13 thì càng VÔ HÌNH với giám đốc trung tâm — đúng điều quyết định muốn chặn.
     *
     * <p>Ca kiểm chứng có sẵn trên production: {@code AdminTeacherService.breakGlassViewTeacher} đã
     * ghi vết và đã có {@code orgId} trong metadata, nhưng vì không nằm ở CỘT lọc nên giám đốc chưa
     * bao giờ thấy được lần admin soi giáo viên của mình.
     *
     * <p><b>Ngữ nghĩa:</b> {@code touchedOrgId} truyền vào THẮNG; {@code null} thì rơi về đường cũ
     * (suy từ actor). Nhờ vậy không điểm gọi nào phải sửa để biên dịch, và vết của người trong
     * trung tâm giữ nguyên hành vi cũ.
     *
     * <p>🪤 {@code CAST(? AS BIGINT)} là bắt buộc, không phải trang trí: {@code JdbcTemplate} gửi
     * một {@code Long} null dưới dạng {@code Types.NULL} không kiểu, và PostgreSQL sẽ ném
     * <em>"could not determine data type of parameter"</em> khi tham số không kiểu đứng làm đối số
     * đầu của {@code COALESCE}.
     */
    public void log(
            String eventName,
            AuditActor actor,
            String targetType,
            String targetId,
            Long touchedOrgId,
            Map<String, Object> metadata
    ) {
        AuditActor a = actor == null ? new AuditActor(null, null, null) : actor;
        log(eventName, a.id(), a.email(), a.role(), targetType, targetId, touchedOrgId, metadata);
    }

    public void log(
            String eventName,
            Long actorUserId,
            String actorEmail,
            String actorRole,
            String targetType,
            String targetId,
            Map<String, Object> metadata
    ) {
        log(eventName, actorUserId, actorEmail, actorRole, targetType, targetId, null, metadata);
    }

    public void log(
            String eventName,
            Long actorUserId,
            String actorEmail,
            String actorRole,
            String targetType,
            String targetId,
            Long touchedOrgId,
            Map<String, Object> metadata
    ) {
        // org_id là ẢNH CHỤP lúc ghi — actor rời trung tâm sau này thì vết cũ vẫn thuộc trung tâm cũ.
        //
        // Thứ tự ưu tiên (DEC-13): trung tâm BỊ TÁC ĐỘNG mà điểm gọi truyền vào THẮNG; không truyền
        // thì rơi về users.org_id của actor như trước. Giữ đường lùi này để ~60 điểm gọi của người
        // trong trung tâm không phải sửa một chữ nào — với họ hai giá trị vốn trùng nhau.
        // actor null (job nền, hệ thống) và không có touchedOrgId ⇒ NULL, đúng như mong đợi.
        jdbcTemplate.update("""
                INSERT INTO audit_logs (
                  event_name,
                  actor_user_id,
                  actor_email,
                  actor_role,
                  target_type,
                  target_id,
                  metadata_json,
                  org_id
                ) VALUES (?, ?, ?, ?, ?, ?, ?,
                          COALESCE(CAST(? AS BIGINT), (SELECT org_id FROM users WHERE id = ?)))
                """,
                eventName,
                actorUserId,
                actorEmail,
                actorRole,
                targetType,
                targetId,
                toJson(metadata),
                touchedOrgId,
                actorUserId
        );
    }

    private String toJson(Map<String, Object> metadata) {
        if (metadata == null || metadata.isEmpty()) {
            return null;
        }
        try {
            return objectMapper.writeValueAsString(metadata);
        } catch (JsonProcessingException e) {
            return "{\"serializationError\":true}";
        }
    }
}
