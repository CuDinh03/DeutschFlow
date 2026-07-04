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
        long activeStudents7d = activeStudents7d(orgId);
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
     * Số HỌC VIÊN (distinct) có ít nhất 1 sự kiện AI trong 7 ngày qua, scope theo org.
     * Audit M-6: join {@code org_members} STUDENT/ACTIVE (không chỉ {@code users.org_id}) để staff
     * (OWNER/MANAGER/TEACHER) dùng AI KHÔNG bị đếm là "active student" — nhất quán với {@code studentCount}.
     */
    private long activeStudents7d(Long orgId) {
        Long count = jdbcTemplate.queryForObject("""
                SELECT COUNT(DISTINCT e.user_id)
                FROM ai_token_usage_events e
                JOIN org_members om ON om.user_id = e.user_id
                WHERE om.org_id = ?
                  AND om.role = 'STUDENT'
                  AND om.status = 'ACTIVE'
                  AND e.created_at >= now() - INTERVAL '7 days'
                """, Long.class, orgId);
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
