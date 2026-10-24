package com.deutschflow.marketing.dto;

import com.deutschflow.marketing.entity.SchoolDemoRequest;

import java.time.Instant;

/** Một yêu cầu đặt lịch demo cho admin liên hệ lại (KHÔNG lộ ipHash). */
public record SchoolDemoRequestDto(
        Long id,
        String name,
        String organization,
        String country,
        String studentCount,
        String contactChannel,
        String contact,
        String message,
        String locale,
        Instant createdAt
) {
    public static SchoolDemoRequestDto from(SchoolDemoRequest r) {
        return new SchoolDemoRequestDto(
                r.getId(),
                r.getName(),
                r.getOrganization(),
                r.getCountry(),
                r.getStudentCount(),
                r.getContactChannel(),
                r.getContact(),
                r.getMessage(),
                r.getLocale(),
                r.getCreatedAt());
    }
}
