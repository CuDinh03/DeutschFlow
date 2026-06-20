package com.deutschflow.notification.dto;

/**
 * Response of {@code POST /api/notifications/teacher/announce} — mirrors the legacy
 * {@code {recipientCount, status}} map ({@code status} is always {@code "sent"}).
 */
public record AnnounceResultDto(int recipientCount, String status) {}
