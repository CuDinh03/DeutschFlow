package com.deutschflow.organization.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Hồ sơ đánh giá của một học viên trong MỘT lớp, nhìn từ phía trung tâm (R12, owner chốt
 * 10/09/2026). Cùng số liệu mà giáo viên thấy ở tab Đánh giá, nhưng gom theo học viên thay vì theo
 * lớp, và kèm tình trạng ghi danh để phân biệt lớp đang học với lớp đã kết thúc.
 *
 * <p>⛔ KHÔNG mang tên/email học viên: người gọi endpoint này vừa mở đúng trang chi tiết của học
 * viên đó ({@code GET /api/org/students/{id}}) nên danh tính đã có sẵn; lặp lại ở đây chỉ nhân bản
 * dữ liệu cá nhân qua thêm một đường mạng mà không thêm thông tin nào.
 *
 * @param enrollmentStatus   {@code ACTIVE} · {@code RESERVED} (bảo lưu) · {@code ENDED} ·
 *                           {@code TRANSFERRED} — nguyên văn {@code class_students.status}
 * @param avgScore           trung bình bài đã CHỐT điểm, thang 0–100; điểm AI chưa được giáo viên
 *                           xác nhận không tính (xem {@code StudentEvaluationService})
 * @param recordedSessions   số buổi CÓ ghi nhận điểm danh cho chính học viên này — mẫu số của tỉ lệ
 *                           chuyên cần, không phải tổng số buổi của lớp
 * @param certificateEligible đủ điều kiện chứng nhận theo ngưỡng của trung tâm ({@code org_settings}:
 *                           {@code certificate_min_avg}, {@code certificate_min_attendance_pct})
 */
public record OrgStudentEvaluationDto(
        Long classId,
        String className,
        String enrollmentStatus,
        LocalDateTime joinedAt,
        LocalDateTime endedAt,
        String teacherComment,
        BigDecimal skillHoren,
        BigDecimal skillLesen,
        BigDecimal skillSchreiben,
        BigDecimal skillSprechen,
        Double avgScore,
        int recordedSessions,
        int presentCount,
        int absentCount,
        int lateCount,
        boolean certificateEligible,
        LocalDateTime evaluatedAt
) {}
