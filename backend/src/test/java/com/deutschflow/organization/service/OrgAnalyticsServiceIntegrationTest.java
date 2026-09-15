package com.deutschflow.organization.service;

import com.deutschflow.organization.dto.OrgAnalyticsDto;
import com.deutschflow.organization.entity.OrgMember;
import com.deutschflow.organization.entity.OrgMemberId;
import com.deutschflow.organization.entity.Organization;
import com.deutschflow.organization.repository.OrgMemberRepository;
import com.deutschflow.organization.repository.OrganizationRepository;
import com.deutschflow.teacher.entity.TeacherClass;
import com.deutschflow.teacher.repository.TeacherClassRepository;
import com.deutschflow.testsupport.AbstractPostgresIntegrationTest;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.Instant;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * DEC-20 (10/09/2026) trên PostgreSQL thật: "học viên hoạt động" = có NỘP BÀI hoặc ĐIỂM DANH có mặt
 * (PRESENT/LATE) trong cửa sổ 7 / 30 ngày, scope theo thành viên STUDENT/ACTIVE của trung tâm.
 * Định nghĩa cũ "có sự kiện AI" đã bỏ — ca "gọi AI nhưng không nộp/điểm danh ⇒ KHÔNG đếm" khoá lại điều đó.
 */
@SpringBootTest
@DisplayName("OrgAnalyticsService Integration Tests (DEC-20: học viên hoạt động 7/30 ngày)")
class OrgAnalyticsServiceIntegrationTest extends AbstractPostgresIntegrationTest {

    @Autowired private OrgAnalyticsService analyticsService;
    @Autowired private OrganizationRepository organizationRepo;
    @Autowired private OrgMemberRepository memberRepo;
    @Autowired private TeacherClassRepository classRepo;
    @Autowired private UserRepository userRepository;
    @Autowired private JdbcTemplate jdbcTemplate;

    @Test
    @DisplayName("Nộp bài 3 ngày trước → đếm; chỉ ABSENT → không; PRESENT 20 ngày trước → 30d nhưng không 7d; chỉ gọi AI → không")
    void activeStudents_bySubmissionOrAttendance_notByAi() {
        Organization org = newOrg();
        User teacher = member(org, "TEACHER", User.Role.TEACHER);
        TeacherClass klass = newClass(teacher.getId(), org.getId());
        Long assignmentId = jdbcTemplate.queryForObject(
                "INSERT INTO class_assignments (class_id, topic, created_at) VALUES (?, 'HW', now()) RETURNING id",
                Long.class, klass.getId());

        User submitted3d = member(org, "STUDENT", User.Role.STUDENT);      // nộp bài 3 ngày trước → 7d + 30d
        User absentOnly = member(org, "STUDENT", User.Role.STUDENT);       // chỉ ABSENT hôm qua → không
        User present20d = member(org, "STUDENT", User.Role.STUDENT);       // PRESENT 20 ngày trước → 30d, không 7d
        User aiOnly = member(org, "STUDENT", User.Role.STUDENT);           // chỉ gọi AI hôm qua → không (định nghĩa cũ)
        User late1d = member(org, "STUDENT", User.Role.STUDENT);           // LATE hôm qua → 7d + 30d
        User submitted40d = member(org, "STUDENT", User.Role.STUDENT);     // nộp 40 ngày trước → ngoài cả hai cửa sổ
        User withdrawn = member(org, "STUDENT", User.Role.STUDENT);        // nộp rồi rút bài (is_deleted) → không

        submit(assignmentId, submitted3d.getId(), 3, false);
        submit(assignmentId, submitted40d.getId(), 40, false);
        submit(assignmentId, withdrawn.getId(), 2, true);
        attend(klass.getId(), 1, absentOnly.getId(), "ABSENT");
        attend(klass.getId(), 20, present20d.getId(), "PRESENT");
        attend(klass.getId(), 1, late1d.getId(), "LATE");
        jdbcTemplate.update(
                "INSERT INTO ai_token_usage_events (user_id, total_tokens, created_at) VALUES (?, 10, now() - INTERVAL '1 day')",
                aiOnly.getId());
        // Giáo viên có điểm danh (dạy) cũng không phải học viên hoạt động (audit M-6).
        attend(klass.getId(), 1, teacher.getId(), "PRESENT");

        // Học viên của TRUNG TÂM KHÁC nộp hôm qua — không rò sang.
        Organization other = newOrg();
        User outsider = member(other, "STUDENT", User.Role.STUDENT);
        submit(assignmentId, outsider.getId(), 1, false);

        OrgAnalyticsDto dto = analyticsService.getAnalytics(org.getId());

        assertThat(dto.studentCount()).isEqualTo(7);
        assertThat(dto.activeStudents7d()).isEqualTo(2);    // submitted3d + late1d
        assertThat(dto.activeStudents30d()).isEqualTo(3);   // + present20d
        assertThat(dto.activeStudents30d()).isGreaterThanOrEqualTo(dto.activeStudents7d());

        OrgAnalyticsDto otherDto = analyticsService.getAnalytics(other.getId());
        assertThat(otherDto.activeStudents7d()).isEqualTo(1);
        assertThat(otherDto.activeStudents30d()).isEqualTo(1);
    }

    @Test
    @DisplayName("Trung tâm chưa có dữ liệu → 0 (không lỗi); học viên đã rời trung tâm không được đếm dù có điểm danh")
    void activeStudents_emptyOrgIsZero_andLeftMemberExcluded() {
        Organization org = newOrg();
        assertThat(analyticsService.getAnalytics(org.getId()).activeStudents7d()).isZero();
        assertThat(analyticsService.getAnalytics(org.getId()).activeStudents30d()).isZero();

        User teacher = member(org, "TEACHER", User.Role.TEACHER);
        TeacherClass klass = newClass(teacher.getId(), org.getId());
        User left = member(org, "STUDENT", User.Role.STUDENT);
        attend(klass.getId(), 1, left.getId(), "PRESENT");
        jdbcTemplate.update("UPDATE org_members SET status = 'LEFT' WHERE org_id = ? AND user_id = ?",
                org.getId(), left.getId());

        OrgAnalyticsDto dto = analyticsService.getAnalytics(org.getId());
        assertThat(dto.studentCount()).isZero();
        assertThat(dto.activeStudents7d()).isZero();
        assertThat(dto.activeStudents30d()).isZero();
    }

    // ── fixture ──────────────────────────────────────────────────────────────

    private void submit(Long assignmentId, Long studentId, int daysAgo, boolean deleted) {
        jdbcTemplate.update("""
                INSERT INTO student_assignments (assignment_id, student_id, status, submitted_at, is_deleted)
                VALUES (?, ?, 'SUBMITTED', now() - CAST(? AS integer) * INTERVAL '1 day', ?)
                """, assignmentId, studentId, daysAgo, deleted);
    }

    private void attend(Long classId, int daysAgo, Long studentId, String status) {
        // Một lớp một ngày chỉ có MỘT nhật ký buổi (uq_class_lesson_logs_date) — dùng lại nếu đã có.
        List<Long> existing = jdbcTemplate.queryForList(
                "SELECT id FROM class_lesson_logs WHERE class_id = ? AND session_date = CURRENT_DATE - CAST(? AS integer)",
                Long.class, classId, daysAgo);
        Long logId = existing.isEmpty()
                ? jdbcTemplate.queryForObject(
                        "INSERT INTO class_lesson_logs (class_id, session_date) VALUES (?, CURRENT_DATE - CAST(? AS integer)) RETURNING id",
                        Long.class, classId, daysAgo)
                : existing.get(0);
        jdbcTemplate.update("INSERT INTO class_attendance (lesson_log_id, student_id, status) VALUES (?, ?, ?)",
                logId, studentId, status);
    }

    private Organization newOrg() {
        return organizationRepo.save(Organization.builder()
                .name("TT analytics " + UUID.randomUUID().toString().substring(0, 8))
                .slug("org-an-" + UUID.randomUUID())
                .seatLimit(0)
                .status("ACTIVE")
                .build());
    }

    private User member(Organization org, String orgRole, User.Role userRole) {
        User u = userRepository.save(User.builder()
                .email("an-" + UUID.randomUUID() + "@test.local")
                .passwordHash("x")
                .displayName("Analytics " + orgRole)
                .role(userRole)
                .build());
        u.setOrgId(org.getId());
        userRepository.save(u);
        memberRepo.save(OrgMember.builder()
                .id(new OrgMemberId(org.getId(), u.getId()))
                .role(orgRole)
                .status("ACTIVE")
                .joinedAt(Instant.now())
                .build());
        return u;
    }

    private TeacherClass newClass(Long teacherId, Long orgId) {
        return classRepo.save(TeacherClass.builder()
                .teacherId(teacherId)
                .orgId(orgId)
                .name("A1 " + UUID.randomUUID().toString().substring(0, 8))
                .inviteCode("INV-" + UUID.randomUUID())
                .createdAt(LocalDateTime.now())
                .build());
    }
}
