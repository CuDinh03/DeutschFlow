package com.deutschflow.common.audit;

import java.time.Instant;

/**
 * Read model for an audit_logs row (admin audit screen). {@code category} mirrors the row's
 * target_type (USER / VOCABULARY / ORG / …) so the UI can filter by it. There is no IP column in
 * audit_logs, so none is exposed.
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
        Instant createdAt
) {}
