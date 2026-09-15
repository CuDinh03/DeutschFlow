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

    /** Mã xếp loại — cùng ngưỡng với {@link #gradeOf}; nhãn dịch ở client/i18n (R8). */
    public static final String GRADE_EXCELLENT = "EXCELLENT";
    public static final String GRADE_GOOD = "GOOD";
    public static final String GRADE_FAIR = "FAIR";
    public static final String GRADE_AVERAGE = "AVERAGE";
    public static final String GRADE_WEAK = "WEAK";

    /**
     * Xếp loại dạng MÃ ({@code EXCELLENT|GOOD|FAIR|AVERAGE|WEAK}, {@code null} khi chưa có điểm) cho
     * payload phiếu phụ huynh (thiết kế 10/09 §3.4: backend không hard-code chuỗi tiếng Việt vào bản
     * đóng băng — ba ngôn ngữ dịch ở nơi hiển thị). {@link #gradeOf} giữ nguyên cho các API đang chạy.
     */
    public static String gradeCodeOf(Double total) {
        if (total == null) return null;
        if (total >= 9.0) return GRADE_EXCELLENT;
        if (total >= 8.0) return GRADE_GOOD;
        if (total >= 6.5) return GRADE_FAIR;
        if (total >= 5.0) return GRADE_AVERAGE;
        return GRADE_WEAK;
    }
}
