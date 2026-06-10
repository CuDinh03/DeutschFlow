package com.deutschflow.organization.dto;

/** Xem trước lời mời (public, token là secret). */
public record InvitationPreviewDto(
        String orgName,
        String role,
        String email,
        boolean expired,
        boolean requiresRegistration
) {}
