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
        /**
         * Trung tâm sở hữu lớp; {@code null} = lớp B2C của riêng giáo viên.
         *
         * <p>Thêm ở đợt D5/E1 để giao diện giáo viên khoá nút GHI ĐÚNG những lớp mà máy chủ đang
         * khoá ({@code OrgGuard.assertClassOrgWritable} quyết theo {@code teacher_classes.org_id},
         * không theo org của người đang gõ). Thiếu trường này thì một giáo viên vừa dạy lớp trung
         * tâm vừa dạy lớp riêng sẽ bị khoá nhầm cả lớp riêng — chặn oan một đường máy chủ vẫn cho.
         */
        Long orgId,
        LocalDateTime createdAt
) {}
