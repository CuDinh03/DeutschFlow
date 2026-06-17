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
        int safeSize = Math.min(Math.max(size, 1), MAX_PAGE_SIZE);
        int safePage = Math.max(page, 0);

        StringBuilder where = new StringBuilder(" WHERE 1=1");
        List<Object> args = new ArrayList<>();
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
                        + "target_id, metadata_json, created_at FROM audit_logs" + where
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
                            ts != null ? ts.toInstant() : null);
                },
                pageArgs.toArray());

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("items", items);
        out.put("total", total != null ? total : 0L);
        out.put("page", safePage);
        out.put("size", safeSize);
        return out;
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
        jdbcTemplate.update("""
                INSERT INTO audit_logs (
                  event_name,
                  actor_user_id,
                  actor_email,
                  actor_role,
                  target_type,
                  target_id,
                  metadata_json
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                eventName,
                actorUserId,
                actorEmail,
                actorRole,
                targetType,
                targetId,
                toJson(metadata)
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
