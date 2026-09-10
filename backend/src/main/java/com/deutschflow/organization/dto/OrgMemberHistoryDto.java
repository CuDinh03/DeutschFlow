package com.deutschflow.organization.dto;

import java.time.Instant;

/**
 * Một dòng sổ vào/ra trung tâm (G-05). {@code displayName}/{@code email} được ghép từ
 * {@code users} lúc đọc — sổ chỉ lưu {@code user_id}, và người dùng có thể đã đổi tên từ đó tới nay.
 */
public record OrgMemberHistoryDto(
        Long id,
        Long userId,
        String displayName,
        String email,
        String action,
        String fromRole,
        String toRole,
        Long actorUserId,
        String actorDisplayName,
        String note,
        Instant createdAt
) {}
