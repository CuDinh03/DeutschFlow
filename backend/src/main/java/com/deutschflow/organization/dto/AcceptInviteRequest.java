package com.deutschflow.organization.dto;

/** Nhận lời mời (public). Bắt buộc displayName+password khi user chưa tồn tại. */
public record AcceptInviteRequest(
        String displayName,
        String password
) {}
