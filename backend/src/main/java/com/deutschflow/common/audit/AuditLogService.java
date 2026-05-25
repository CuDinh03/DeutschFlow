package com.deutschflow.common.audit;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.Map;

@Service
@RequiredArgsConstructor
public class AuditLogService {

    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;

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
