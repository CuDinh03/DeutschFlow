package com.deutschflow.teacher.dto;

import java.time.LocalDateTime;

public record TeacherClassDto(
        Long id,
        String name,
        String inviteCode,
        long studentCount,
        long quizCount,
        /**
         * Bài đang chờ giáo viên xử lý (SUBMITTED/AI_GRADED/GRADING_FAILED — đúng tập
         * AssignmentStatus.AWAITING_TEACHER). Nguồn của badge "chờ chấm" trên thẻ lớp: FE vốn đọc
         * field này từ lâu nhưng DTO chưa từng trả nên badge chết vĩnh viễn (F05).
         */
        long pendingReviewCount,
        LocalDateTime createdAt
) {}
