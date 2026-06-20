package com.deutschflow.speaking.dto;

/**
 * Response of {@code POST /api/speaking/ai/roleplay} — mirrors the legacy
 * {@code {situation, rolePlay}} map 1:1 (echoed situation + AI role-play script).
 */
public record RolePlayResponseDto(String situation, String rolePlay) {}
