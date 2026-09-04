package com.deutschflow.organization.dto;

/** Tạo (POST — title bắt buộc) hoặc sửa (PATCH — field null giữ nguyên) một Lektion bản DRAFT. */
public record UpsertLektionRequest(
        String title,
        String description
) {}
