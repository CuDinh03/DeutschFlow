package com.deutschflow.organization.dto;

/** Một nhóm phân bố trình độ CEFR (level → số học viên). */
public record CefrBucket(
        String level,
        long count
) {}
