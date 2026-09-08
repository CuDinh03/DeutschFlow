package com.deutschflow.teacher.dto;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Chi tiết một lớp NHÌN TỪ PHÍA HỌC VIÊN (chỉ {@code StudentClassroomController} dùng — đường
 * giáo viên đi qua {@code TeacherClassDto}, đường trung tâm qua {@code OrgClassDto}).
 *
 * @param inviteCode Mã mời lớp — chỉ trả cho lớp B2C ({@code orgId == null}); với lớp của TRUNG TÂM
 *                   luôn {@code null} (V-04). Lý do: mỗi lượt chia sẻ mã lớp trung tâm là một GHẾ có
 *                   thể bị người lạ chiếm, mà học viên không phải người có quyền mời. Giữ lại cho lớp
 *                   B2C vì ở đó không có ghế/hoá đơn và web vẫn hiện dòng "Mã lớp" cho học viên.
 */
public record ClassroomDetailDto(
        Long id,
        String name,
        String inviteCode,
        List<TeacherSummaryDto> teachers,
        long studentCount,
        long assignmentCount,
        long pendingCount,
        long submittedCount,
        long gradedCount,
        Double avgScore,
        long lessonTotal,
        long lessonCompleted,
        String currentLessonTitle,
        LocalDateTime joinedAt,
        LocalDateTime createdAt
) {}
