package com.deutschflow.user.dto;

/**
 * Success response cho tất cả auth endpoints.
 * Trả về trực tiếp (không wrap) theo RFC 7807 — chỉ error mới dùng ProblemDetail.
 */
public record AuthResponse(
        String accessToken,
        String refreshToken,
        Long userId,
        String email,
        String displayName,
        String role,
        String locale,
        /** Target CEFR from {@code user_learning_profiles} for students; null otherwise or if missing */
        String learningTargetLevel
) {}
