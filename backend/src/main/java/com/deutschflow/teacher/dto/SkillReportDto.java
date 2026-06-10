package com.deutschflow.teacher.dto;

import java.util.List;

/**
 * Bảng điểm tổng hợp 4 kỹ năng (Hören/Lesen/Schreiben/Sprechen).
 * Mỗi học viên có điểm trung bình từng kỹ năng + điểm tổng + xếp loại.
 */
public record SkillReportDto(
        Long classId,
        String className,
        List<StudentSkillRow> students
) {
    public record StudentSkillRow(
            Long studentId,
            String name,
            String email,
            Double horen,
            Double lesen,
            Double schreiben,
            Double sprechen,
            Double total,
            String grade
    ) {}

    /** Xếp loại theo thang điểm 10 */
    public static String gradeOf(Double total) {
        if (total == null) return "—";
        if (total >= 9.0) return "Xuất sắc";
        if (total >= 8.0) return "Giỏi";
        if (total >= 6.5) return "Khá";
        if (total >= 5.0) return "Trung bình";
        return "Yếu";
    }
}
