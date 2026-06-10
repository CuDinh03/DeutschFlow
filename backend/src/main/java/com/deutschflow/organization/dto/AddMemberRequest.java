package com.deutschflow.organization.dto;

/** Gán thành viên thủ công vào tổ chức (platform-admin). */
public record AddMemberRequest(
        String email,
        String role
) {}
