package com.deutschflow.admin;

import com.deutschflow.organization.entity.OrgMember;
import com.deutschflow.organization.entity.OrgMemberId;
import com.deutschflow.organization.entity.Organization;
import com.deutschflow.organization.repository.OrgMemberRepository;
import com.deutschflow.organization.repository.OrganizationRepository;
import com.deutschflow.teacher.entity.ClassTeacher;
import com.deutschflow.teacher.entity.ClassTeacherId;
import com.deutschflow.teacher.entity.TeacherClass;
import com.deutschflow.teacher.repository.ClassTeacherRepository;
import com.deutschflow.teacher.repository.TeacherClassRepository;
import com.deutschflow.testsupport.AbstractPostgresIntegrationTest;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Gói 2 (10/09/2026) — {@code POST /api/admin/classes/{classId}/students/bulk-assign} không còn là
 * lối tắt: mọi dòng đi qua {@code ClassEnrollmentService.bulkAssignByAdmin}, tức qua đúng các cổng
 * của đường ghi danh đơn lẻ. Kiểm qua chuỗi thật: Spring Security ({@code hasRole('ADMIN')}) →
 * AdminManagementController → ClassEnrollmentService → OrgGuard / OrgMembershipService → Postgres.
 *
 * <p>Bốn điều chỉ DB thật mới chứng minh được:
 * <ol>
 *   <li>hết ghế → 400 cùng câu với đường đơn lẻ, và CẢ lượt rollback (dòng hợp lệ đứng trước cũng
 *       không vào lớp) — ghế là tài nguyên tính tiền, không có nửa lô;</li>
 *   <li>học viên đang ACTIVE ở trung tâm khác → 400 rõ ràng, không ghi gì;</li>
 *   <li>trung tâm chỉ-đọc (D5) → 403 {@code ORG_READ_ONLY}, không ghi gì;</li>
 *   <li>thành công → học viên chưa thuộc trung tâm được cấp ghế STUDENT ACTIVE, dòng ghi danh
 *       ACTIVE, thông báo {@code ADDED_TO_CLASS} ({@code addedBy=ORG}) vào outbox, MỘT vết gộp
 *       {@code admin.class.students.bulk_assigned} ở org của lớp; gọi lại là idempotent.</li>
 * </ol>
 *
 * <p>Tự bỏ qua khi không có Postgres — xem {@link AbstractPostgresIntegrationTest}.
 */
@SpringBootTest
@AutoConfigureMockMvc
@DisplayName("Gói 2 — admin gán hàng loạt đi qua ClassEnrollmentService: POST /api/admin/classes/{id}/students/bulk-assign")
class AdminBulkAssignStudentsIntegrationTest extends AbstractPostgresIntegrationTest {

    private static final String EVENT = "admin.class.students.bulk_assigned";

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private UserRepository userRepository;
    @Autowired private OrganizationRepository organizationRepo;
    @Autowired private OrgMemberRepository memberRepo;
    @Autowired private TeacherClassRepository classRepo;
    @Autowired private ClassTeacherRepository classTeacherRepository;
    @Autowired private JdbcTemplate jdbcTemplate;

    @Test
    @DisplayName("Hết ghế: 400 cùng câu 'giới hạn chỗ ngồi' kèm id học viên; CẢ lượt rollback — dòng hợp lệ đứng trước cũng không vào lớp, không outbox, không vết")
    void seatFull_rejectsWholeBatch_nothingWritten() throws Exception {
        Organization org = org(1, "ACTIVE");          // đúng một ghế…
        User teacher = member(org, "TEACHER");
        User seated = member(org, "STUDENT");           // …và ghế đó đã có người
        User newcomer = account(User.Role.STUDENT);     // chưa thuộc trung tâm nào
        User admin = account(User.Role.ADMIN);
        TeacherClass klass = orgClass(org, teacher);

        String body = bulkAssign(admin, klass, List.of(seated.getId(), newcomer.getId()))
                .andExpect(status().isBadRequest())
                .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        assertThat(body).contains("giới hạn chỗ ngồi").contains("#" + newcomer.getId());

        // Rollback trọn lượt: người có ghế (dòng 1, đã enroll trước khi dòng 2 vỡ) cũng KHÔNG vào lớp.
        assertThat(rosterCount(klass)).isZero();
        assertThat(membershipRows(org, newcomer)).isZero();
        assertThat(outboxRows(klass)).isZero();
        assertThat(traceCount(org)).isZero();
    }

    @Test
    @DisplayName("Học viên đang ACTIVE ở trung tâm KHÁC: 400 nói rõ 'trung tâm khác', không ghi gì")
    void studentActiveElsewhere_rejected() throws Exception {
        Organization org = org(0, "ACTIVE");
        Organization other = org(0, "ACTIVE");
        User teacher = member(org, "TEACHER");
        User foreign = member(other, "STUDENT");
        User admin = account(User.Role.ADMIN);
        TeacherClass klass = orgClass(org, teacher);

        String body = bulkAssign(admin, klass, List.of(foreign.getId()))
                .andExpect(status().isBadRequest())
                .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        assertThat(body).contains("trung tâm khác").contains("#" + foreign.getId());

        assertThat(rosterCount(klass)).isZero();
        assertThat(membershipRows(org, foreign)).isZero();
        assertThat(jdbcTemplate.queryForObject(
                "SELECT status FROM org_members WHERE org_id = ? AND user_id = ?",
                String.class, other.getId(), foreign.getId())).isEqualTo("ACTIVE"); // ghế cũ còn nguyên
        assertThat(traceCount(org)).isZero();
    }

    @Test
    @DisplayName("D5: trung tâm bị đình chỉ (chỉ-đọc) → 403 ORG_READ_ONLY, không ai vào lớp, không vết")
    void orgReadOnly_rejected() throws Exception {
        Organization org = org(0, "SUSPENDED");
        User teacher = member(org, "TEACHER");
        User student = member(org, "STUDENT");
        User admin = account(User.Role.ADMIN);
        TeacherClass klass = orgClass(org, teacher);

        String body = bulkAssign(admin, klass, List.of(student.getId()))
                .andExpect(status().isForbidden())
                .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        assertThat(body).contains("ORG_READ_ONLY");

        assertThat(rosterCount(klass)).isZero();
        assertThat(outboxRows(klass)).isZero();
        assertThat(traceCount(org)).isZero();
    }

    @Test
    @DisplayName("Thành công: HV chưa thuộc trung tâm được cấp ghế, cả hai vào lớp ACTIVE, outbox ADDED_TO_CLASS addedBy=ORG, một vết gộp không PII; gọi lại idempotent; OWNER gọi → 403")
    void success_admitsSeatEnrollsNotifiesAudits_idempotent() throws Exception {
        Organization org = org(10, "ACTIVE");
        User owner = member(org, "OWNER");
        User teacher = member(org, "TEACHER");
        User insider = member(org, "STUDENT");
        User newcomer = account(User.Role.STUDENT);
        User admin = account(User.Role.ADMIN);
        TeacherClass klass = orgClass(org, teacher);

        // teacher.getId() là "không phải học viên"; insider lặp lại để chốt bỏ trùng.
        bulkAssign(admin, klass, Arrays.asList(insider.getId(), newcomer.getId(), teacher.getId(), insider.getId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.requestedCount").value(3))
                .andExpect(jsonPath("$.assignedCount").value(2))
                .andExpect(jsonPath("$.results.length()").value(3))
                .andExpect(jsonPath("$.results[0].studentId").value(insider.getId()))
                .andExpect(jsonPath("$.results[0].outcome").value("ASSIGNED"))
                .andExpect(jsonPath("$.results[1].studentId").value(newcomer.getId()))
                .andExpect(jsonPath("$.results[1].outcome").value("ASSIGNED"))
                .andExpect(jsonPath("$.results[2].studentId").value(teacher.getId()))
                .andExpect(jsonPath("$.results[2].outcome").value("NOT_STUDENT"));

        // Ghi danh ACTIVE cho đúng hai học viên; giáo viên không bị nhét vào roster.
        assertThat(rosterCount(klass)).isEqualTo(2L);
        assertThat(rosterStatus(klass, insider)).isEqualTo("ACTIVE");
        assertThat(rosterStatus(klass, newcomer)).isEqualTo("ACTIVE");

        // Người mới nhận GHẾ của trung tâm (org_members STUDENT ACTIVE + users.org_id) — trước Gói 2
        // đường này chỉ ghi class_students, trung tâm có lớp đầy học viên mà ghế đếm 0.
        assertThat(jdbcTemplate.queryForObject(
                "SELECT role || '/' || status FROM org_members WHERE org_id = ? AND user_id = ?",
                String.class, org.getId(), newcomer.getId())).isEqualTo("STUDENT/ACTIVE");
        assertThat(reload(newcomer).getOrgId()).isEqualTo(org.getId());

        // Thông báo phân lớp qua outbox — đúng một dòng mỗi học viên, do "trung tâm xếp lớp".
        assertThat(outboxRows(klass)).isEqualTo(2L);
        assertThat(outboxRowsFor(klass, newcomer)).isEqualTo(1L);
        assertThat(outboxRowsFor(klass, insider)).isEqualTo(1L);

        // MỘT vết gộp ở org của lớp, actor là admin, số lượng đúng, không email.
        assertThat(jdbcTemplate.queryForObject("""
                SELECT COUNT(*) FROM audit_logs
                 WHERE event_name = ?
                   AND org_id = ?
                   AND target_type = 'CLASS'
                   AND target_id = ?
                   AND actor_user_id = ?
                   AND actor_role = 'ADMIN'
                   AND CAST(metadata_json ->> 'requestedCount' AS int) = 3
                   AND CAST(metadata_json ->> 'assignedCount' AS int) = 2
                   AND CAST(metadata_json ->> 'notStudentCount' AS int) = 1
                   AND CAST(metadata_json ->> 'alreadyEnrolledCount' AS int) = 0
                   AND CAST(metadata_json ->> 'orgId' AS bigint) = ?
                   AND CAST(metadata_json AS text) NOT LIKE '%@test.local%'
                """, Long.class, EVENT, org.getId(), String.valueOf(klass.getId()), admin.getId(), org.getId()))
                .isEqualTo(1L);
        assertThat(traceCount(org)).isEqualTo(1L);

        // Gọi lại: ai cũng đã ở trong lớp → ALREADY_ENROLLED, không báo lần hai, thêm một vết gộp mới.
        bulkAssign(admin, klass, List.of(insider.getId(), newcomer.getId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.assignedCount").value(0))
                .andExpect(jsonPath("$.results[0].outcome").value("ALREADY_ENROLLED"))
                .andExpect(jsonPath("$.results[1].outcome").value("ALREADY_ENROLLED"));
        assertThat(outboxRows(klass)).isEqualTo(2L);
        assertThat(traceCount(org)).isEqualTo(2L);

        // Hợp đồng quyền: endpoint admin — chủ trung tâm gọi bị 403, ẩn danh 401.
        bulkAssign(owner, klass, List.of(insider.getId())).andExpect(status().isForbidden());
        mockMvc.perform(post("/api/admin/classes/{classId}/students/bulk-assign", klass.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("studentIds", List.of(insider.getId())))))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("Lớp không tồn tại → 404; danh sách rỗng → 200 với 0, không vết")
    void classMissing_andEmptyList() throws Exception {
        Organization org = org(0, "ACTIVE");
        User teacher = member(org, "TEACHER");
        User admin = account(User.Role.ADMIN);
        TeacherClass klass = orgClass(org, teacher);

        mockMvc.perform(post("/api/admin/classes/{classId}/students/bulk-assign", 999_999_999L)
                        .with(user(admin))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("studentIds", List.of(1L)))))
                .andExpect(status().isNotFound());

        bulkAssign(admin, klass, List.of())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.assignedCount").value(0))
                .andExpect(jsonPath("$.requestedCount").value(0));
        assertThat(traceCount(org)).isZero();
    }

    // ── helpers ─────────────────────────────────────────────────────────────

    private ResultActions bulkAssign(User actor, TeacherClass klass, List<Long> studentIds) throws Exception {
        Map<String, Object> body = new java.util.LinkedHashMap<>();
        body.put("studentIds", studentIds);
        return mockMvc.perform(post("/api/admin/classes/{classId}/students/bulk-assign", klass.getId())
                .with(user(actor))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(body)));
    }

    private Organization org(int seatLimit, String status) {
        Organization.OrganizationBuilder b = Organization.builder()
                .name("TT " + UUID.randomUUID().toString().substring(0, 8))
                .slug("bulk-assign-" + UUID.randomUUID())
                .seatLimit(seatLimit)
                .status(status);
        if (!"ACTIVE".equals(status)) {
            b.suspendedAt(Instant.now()); // mốc neo ân hạn → READ_ONLY (không neo là CUT — cũng chặn ghi)
        }
        return organizationRepo.save(b.build());
    }

    private User account(User.Role role) {
        return userRepository.save(User.builder()
                .email("bulk-assign-" + UUID.randomUUID() + "@test.local")
                .passwordHash("x")
                .displayName("BA " + role.name())
                .role(role)
                .build());
    }

    /** Thành viên ACTIVE của trung tâm với vai org đã cho; users.role khớp vai (như syncPlatformRole giữ). */
    private User member(Organization org, String orgRole) {
        User u = account(User.Role.valueOf(orgRole));
        u.setOrgId(org.getId());
        u = userRepository.save(u);

        OrgMember m = new OrgMember();
        m.setId(new OrgMemberId(org.getId(), u.getId()));
        m.setRole(orgRole);
        m.setStatus("ACTIVE");
        m.setJoinedAt(Instant.now());
        memberRepo.save(m);
        return u;
    }

    private TeacherClass orgClass(Organization org, User teacher) {
        TeacherClass klass = classRepo.save(TeacherClass.builder()
                .teacherId(teacher.getId())
                .orgId(org.getId())
                .name("A1 — " + UUID.randomUUID().toString().substring(0, 8))
                .inviteCode("INV-" + UUID.randomUUID())
                .createdAt(LocalDateTime.now())
                .build());
        classTeacherRepository.save(ClassTeacher.builder()
                .id(new ClassTeacherId(klass.getId(), teacher.getId())).role("PRIMARY").build());
        return klass;
    }

    private User reload(User u) {
        return userRepository.findById(u.getId()).orElseThrow();
    }

    private Long rosterCount(TeacherClass klass) {
        return jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM class_students WHERE class_id = ? AND status IN ('ACTIVE', 'RESERVED')",
                Long.class, klass.getId());
    }

    private String rosterStatus(TeacherClass klass, User student) {
        return jdbcTemplate.queryForObject(
                "SELECT status FROM class_students WHERE class_id = ? AND student_id = ?",
                String.class, klass.getId(), student.getId());
    }

    private Long membershipRows(Organization org, User u) {
        return jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM org_members WHERE org_id = ? AND user_id = ?", Long.class,
                org.getId(), u.getId());
    }

    private Long outboxRows(TeacherClass klass) {
        return jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM notification_outbox WHERE class_id = ? AND notification_type = 'ADDED_TO_CLASS'",
                Long.class, klass.getId());
    }

    private Long outboxRowsFor(TeacherClass klass, User student) {
        return jdbcTemplate.queryForObject("""
                SELECT COUNT(*) FROM notification_outbox
                 WHERE class_id = ? AND recipient_id = ?
                   AND notification_type = 'ADDED_TO_CLASS'
                   AND payload ->> 'addedBy' = 'ORG'
                """, Long.class, klass.getId(), student.getId());
    }

    private Long traceCount(Organization org) {
        return jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM audit_logs WHERE event_name = ? AND org_id = ?", Long.class,
                EVENT, org.getId());
    }
}
