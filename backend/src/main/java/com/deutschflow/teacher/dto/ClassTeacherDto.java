package com.deutschflow.teacher.dto;

import java.time.LocalDateTime;

/** Một giáo viên trong lớp (PRIMARY = giáo viên chính, ASSISTANT = trợ giảng). */
public record ClassTeacherDto(
        Long teacherId,
        String name,
        String email,
        String role,
        LocalDateTime joinedAt
) {}
