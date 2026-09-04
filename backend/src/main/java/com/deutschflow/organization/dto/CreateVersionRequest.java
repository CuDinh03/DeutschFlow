package com.deutschflow.organization.dto;

/** Tạo phiên bản DRAFT mới; null = sao chép nội dung từ phiên bản mới nhất của bộ. */
public record CreateVersionRequest(Long sourceVersionId) {}
