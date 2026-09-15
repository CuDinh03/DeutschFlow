package com.deutschflow.organization.service;

import com.deutschflow.organization.dto.CefrBucket;
import com.deutschflow.organization.dto.OrgAnalyticsDto;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * Read-only số liệu phân tích cho org-admin (GET /api/org/analytics).
 *
 * <p>Tất cả query đều scope theo {@code users.org_id} và phòng thủ với COALESCE /
 * danh sách rỗng để org chưa có dữ liệu vẫn trả về 0 thay vì lỗi.
 */
@Service
@Slf4j
public class OrgAnalyticsService {

    private final JdbcTemplate jdbcTemplate;
    private final OrgQuotaService orgQuotaService;

    public OrgAnalyticsService(JdbcTemplate jdbcTemplate, OrgQuotaService orgQuotaService) {
        this.jdbcTemplate = jdbcTemplate;
        this.orgQuotaService = orgQuotaService;
    }

    @Transactional(readOnly = true)
    public OrgAnalyticsDto getAnalytics(Long orgId) {
        long studentCount = countMembers(orgId, "STUDENT");
        long teacherCount = countMembers(orgId, "TEACHER");
        long classCount = countClasses(orgId);
        long tokensThisMonth = tokensThisMonth(orgId);
        long monthlyTokenPool = orgQuotaService.monthlyPool(orgId);
        int poolUsagePercent = OrgQuotaService.usagePercent(monthlyTokenPool, tokensThisMonth);
        boolean poolUnlimited = orgQuotaService.isPoolUnlimited(orgId);
        long activeStudents7d = activeStudents(orgId, 7);
        long activeStudents30d = activeStudents(orgId, 30);
        List<CefrBucket> cefrDistribution = cefrDistribution(orgId);

        return new OrgAnalyticsDto(
                studentCount,
                teacherCount,
                classCount,
                tokensThisMonth,
                monthlyTokenPool,
                poolUsagePercent,
                poolUnlimited,
                activeStudents7d,
                activeStudents30d,
                cefrDistribution);
    }

    /** Số thành viên ACTIVE theo vai trò trong org. */
    private long countMembers(Long orgId, String role) {
        Long count = jdbcTemplate.queryForObject("""
                SELECT COUNT(*) FROM org_members
                WHERE org_id = ? AND role = ? AND status = 'ACTIVE'
                """, Long.class, orgId, role);
        return count != null ? count : 0L;
    }

    /** Số lớp thuộc org. */
    private long countClasses(Long orgId) {
        Long count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM teacher_classes WHERE org_id = ?",
                Long.class, orgId);
        return count != null ? count : 0L;
    }

    /**
     * Tổng token AI dùng trong tháng hiện tại bởi mọi user của org.
     *
     * <p>Uỷ quyền cho {@link OrgQuotaService#orgUsageThisMonth} — nguồn sự thật duy nhất cho
     * truy vấn "usage tháng này", để một thay đổi ranh giới tháng theo timezone VN sau này chỉ
     * cần sửa một nơi (DRY với phần enforcement của quota).
     */
    private long tokensThisMonth(Long orgId) {
        return orgQuotaService.orgUsageThisMonth(orgId);
    }

    /**
     * "Học viên hoạt động" (DEC-20, 10/09/2026): học viên STUDENT/ACTIVE của trung tâm có ít nhất
     * MỘT dấu vết học tập thật trong {@code days} ngày qua — NỘP BÀI
     * ({@code student_assignments.submitted_at}, bỏ bài đã rút {@code is_deleted}) HOẶC ĐIỂM DANH
     * có mặt ({@code class_attendance} PRESENT/LATE, tính theo ngày buổi
     * {@code class_lesson_logs.session_date}; ABSENT KHÔNG tính).
     *
     * <p>Định nghĩa cũ "có sự kiện AI 7 ngày" đã bỏ: dùng AI không phải là đi học, và trung tâm
     * không cấp AI cho học viên (2 kênh token) nên con số đó gần như luôn 0 với lớp trung tâm.
     * Owner G1: trả cả 7 ngày (giữ tên trường) lẫn 30 ngày; G2: pilot có điểm danh thật.
     *
     * <p>Audit M-6 giữ nguyên: đi từ {@code org_members} STUDENT/ACTIVE (không chỉ
     * {@code users.org_id}) để nhân sự OWNER/MANAGER/TEACHER không bị đếm là học viên — nhất quán với
     * {@code studentCount}. Phạm vi là THÀNH VIÊN của trung tâm, không lọc theo lớp thuộc trung tâm:
     * học viên nộp bài ở lớp nào cũng là đang học.
     *
     * <p>Chỉ số: {@code idx_student_assignments_student_id} phục vụ vế nộp bài; vế điểm danh dò
     * {@code class_attendance} theo {@code student_id} (khoá chính là (lesson_log_id, student_id)) —
     * nợ chỉ số {@code class_attendance(student_id)} nếu pilot lớn (không thêm migration ở đợt này).
     */
    private long activeStudents(Long orgId, int days) {
        Long count = jdbcTemplate.queryForObject("""
                SELECT COUNT(*)
                FROM org_members om
                WHERE om.org_id = ?
                  AND om.role = 'STUDENT'
                  AND om.status = 'ACTIVE'
                  AND (
                    EXISTS (
                        SELECT 1 FROM student_assignments sa
                        WHERE sa.student_id = om.user_id
                          AND COALESCE(sa.is_deleted, FALSE) = FALSE
                          AND sa.submitted_at >= now() - CAST(? AS integer) * INTERVAL '1 day'
                    )
                    OR EXISTS (
                        SELECT 1 FROM class_attendance a
                        JOIN class_lesson_logs l ON l.id = a.lesson_log_id
                        WHERE a.student_id = om.user_id
                          AND a.status IN ('PRESENT', 'LATE')
                          AND l.session_date >= CURRENT_DATE - CAST(? AS integer)
                    )
                  )
                """, Long.class, orgId, days, days);
        return count != null ? count : 0L;
    }

    /**
     * Phân bố trình độ CEFR (current_level) của HỌC VIÊN trong org.
     * Audit M-6: chỉ tính org_members STUDENT/ACTIVE (không gồm learning-profile của staff).
     * Defensive: COALESCE NULL/blank về 'A0'; org chưa có profile → danh sách rỗng.
     */
    private List<CefrBucket> cefrDistribution(Long orgId) {
        return jdbcTemplate.query("""
                SELECT COALESCE(NULLIF(p.current_level, ''), 'A0') AS level,
                       COUNT(*) AS cnt
                FROM user_learning_profiles p
                JOIN org_members om ON om.user_id = p.user_id
                WHERE om.org_id = ?
                  AND om.role = 'STUDENT'
                  AND om.status = 'ACTIVE'
                GROUP BY COALESCE(NULLIF(p.current_level, ''), 'A0')
                ORDER BY level
                """,
                (rs, rowNum) -> new CefrBucket(rs.getString("level"), rs.getLong("cnt")),
                orgId);
    }
}
