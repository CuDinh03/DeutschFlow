package com.deutschflow.teacher.dto;

import java.util.List;

/**
 * Phân bổ nội dung của một buổi + số liệu khung: {@code teachingMinutes} là phút HỌC của buổi
 * (D04 — không phân bổ vào 15′ giải lao); {@code plannedTotalMinutes} để FE cảnh báo vượt khung;
 * {@code unallocatedCarryMinutes} = tổng phút phần dở KHÔNG còn buổi kế để bố trí (hiển thị
 * "chưa bố trí" — không lặng lẽ nuốt, nền cho AC17).
 */
public record SessionContentsDto(
        Long sessionId,
        int teachingMinutes,
        int plannedTotalMinutes,
        int unallocatedCarryMinutes,
        List<SessionContentDto> contents
) {}
