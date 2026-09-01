package com.deutschflow.teacher.dto;

import java.time.LocalDate;

/** Tạo/sửa mốc lớp (PR-6). PATCH: trường null = giữ nguyên; đổi {@code plannedDate} trên lớp
 *  đã gắn giáo trình đi qua luồng đề xuất MOVE_MILESTONE (P05). */
public record UpsertMilestoneRequest(
        String kind,
        String title,
        LocalDate plannedDate,
        String note
) {}
