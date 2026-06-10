package com.deutschflow.organization.dto;

import java.time.Instant;

/** Một lời mời tham gia tổ chức (PENDING|ACCEPTED|REVOKED|EXPIRED). */
public record OrgInvitationDto(
        Long id,
        String email,
        String role,
        String status,
        Instant expiresAt,
        Instant createdAt
) {}
