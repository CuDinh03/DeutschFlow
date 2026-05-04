package com.deutschflow.notification.dto;

import java.util.List;

public record NotificationPageResponse(
        List<NotificationItemResponse> items,
        int page,
        int size,
        long totalElements,
        int totalPages
) {}
