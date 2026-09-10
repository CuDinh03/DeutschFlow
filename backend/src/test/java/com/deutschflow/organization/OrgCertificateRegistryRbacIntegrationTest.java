package com.deutschflow.organization;

import com.deutschflow.organization.entity.OrgMember;
import com.deutschflow.organization.entity.OrgMemberId;
import com.deutschflow.organization.entity.Organization;
import com.deutschflow.organization.repository.OrgMemberRepository;
import com.deutschflow.organization.repository.OrganizationRepository;
import com.deutschflow.teacher.entity.OrgCertificate;
import com.deutschflow.teacher.entity.TeacherClass;
import com.deutschflow.teacher.repository.OrgCertificateRepository;
import com.deutschflow.teacher.repository.TeacherClassRepository;
import com.deutschflow.testsupport.AbstractPostgresIntegrationTest;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsInAnyOrder;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.not;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * DEC-20 (chốt 09/09/2026) trên Postgres THẬT, qua filter chain thật: "giáo viên vẫn cấp, KHÔNG
 * thêm bước duyệt; nhưng giám đốc xem được danh sách toàn trung tâm và THU HỒI được" + ghi vết
 * (DEC-13). Cùng khuôn với {@code AdminAuditRbacTest}/{@code RoadmapTreeRbacTest}: principal là
 * entity {@link User} thật ({@code with(user(...))}) để {@code user.getOrgId()} có nghĩa.
 *
 * <ul>
 *   <li>OWNER → 200 danh sách + 200 thu hồi (kèm vết, kèm link công khai báo đã thu hồi).</li>
 *   <li>MANAGER → 200 danh sách, 403 thu hồi.</li>
 *   <li>TEACHER (thành viên trung tâm) → 403 cả hai.</li>
 *   <li>Trung tâm khác → 404 khi thu hồi, và không lọt vào danh sách.</li>
 *   <li>Ẩn danh → 401.</li>
 * </ul>
 *
 * Self-skips khi không có Postgres — xem {@link AbstractPostgresIntegrationTest}.
 */
@SpringBootTest
@AutoConfigureMockMvc
@DisplayName("Sổ chứng nhận toàn trung tâm — RBAC + thu hồi có lý do (DEC-20)")
class OrgCertificateRegistryRbacIntegrationTest extends AbstractPostgresIntegrationTest {

    private static final String LIST = "/api/org/certificates";
    private static final String REVOKE = "/api/org/certificates/{id}/revoke";
    private static final String PUBLIC_VERIFY = "/api/public/certificate/{token}";
    private static final String REASON_JSON = "{\"reason\":\"Cấp nhầm trình độ, lớp chưa thi cuối kỳ\"}";

    @Autowired private MockMvc mockMvc;
    @Autowired private OrganizationRepository organizationRepo;
    @Autowired private OrgMemberRepository memberRepo;
    @Autowired private UserRepository userRepository;
    @Autowired private TeacherClassRepository classRepository;
    @Autowired private OrgCertificateRepository certificateRepository;
    @Autowired private JdbcTemplate jdbcTemplate;
    @Autowired private ObjectMapper objectMapper;

    private Organization orgA;
    private Organization orgB;
    private User ownerA;
    private User managerA;
    private User teacherA;
    private User ownerB;
    private TeacherClass classA;
    /** Tên học viên có đuôi ngẫu nhiên để lọc `q` chỉ trúng đúng một dòng của lượt chạy này. */
    private String studentTag;
    private OrgCertificate certActive;
    private OrgCertificate certRevoked;
    private OrgCertificate certB;

    @BeforeEach
    void seed() {
        orgA = org();
        orgB = org();
        ownerA = member(orgA, "OWNER");
        managerA = member(orgA, "MANAGER");
        teacherA = member(orgA, "TEACHER");
        ownerB = member(orgB, "OWNER");
        classA = classRepository.save(TeacherClass.builder()
                .teacherId(teacherA.getId()).orgId(orgA.getId())
                .name("B1 tối " + UUID.randomUUID().toString().substring(0, 6))
                .inviteCode("cert-" + UUID.randomUUID().toString().substring(0, 12))
                .build());
        studentTag = UUID.randomUUID().toString().substring(0, 8);
        certActive = cert(orgA, classA, teacherA, "Nguyễn Văn " + studentTag, true);
        certRevoked = cert(orgA, classA, teacherA, "Trần Thị Đã Thu Hồi", false);
        TeacherClass classB = classRepository.save(TeacherClass.builder()
                .teacherId(ownerB.getId()).orgId(orgB.getId()).name("A2 sáng")
                .inviteCode("cert-" + UUID.randomUUID().toString().substring(0, 12))
                .build());
        certB = cert(orgB, classB, ownerB, "Lê Văn Trung Tâm B", true);
    }

    // ── đọc ─────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("OWNER: 200, thấy đủ chứng nhận của trung tâm mình kèm tên lớp hiện tại, KHÔNG thấy trung tâm khác")
    void ownerListsWholeCenter() throws Exception {
        mockMvc.perform(get(LIST).param("size", "50").with(user(ownerA)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.total").value(2))
                .andExpect(jsonPath("$.page").value(0))
                .andExpect(jsonPath("$.size").value(50))
                .andExpect(jsonPath("$.items[*].id").value(containsInAnyOrder(
                        certActive.getId().intValue(), certRevoked.getId().intValue())))
                .andExpect(jsonPath("$.items[*].id").value(not(hasItem(certB.getId().intValue()))))
                .andExpect(jsonPath("$.items[?(@.id == %d)].className".formatted(certActive.getId()))
                        .value(hasItem(classA.getName())))
                .andExpect(jsonPath("$.items[?(@.id == %d)].active".formatted(certActive.getId()))
                        .value(hasItem(true)))
                .andExpect(jsonPath("$.items[?(@.id == %d)].verifyToken".formatted(certActive.getId()))
                        .value(hasItem(certActive.getVerifyToken())));
    }

    @Test
    @DisplayName("MANAGER: 200 danh sách (xem được, không thu hồi được)")
    void managerListsToo() throws Exception {
        mockMvc.perform(get(LIST).with(user(managerA)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.total").value(2));
    }

    @Test
    @DisplayName("Bộ lọc active / classId / q chạy phía máy chủ và KHÔNG vượt ra ngoài trung tâm")
    void filtersStayInsideOrg() throws Exception {
        mockMvc.perform(get(LIST).param("active", "true").with(user(ownerA)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.total").value(1))
                .andExpect(jsonPath("$.items[0].id").value(certActive.getId()));

        mockMvc.perform(get(LIST).param("active", "false").with(user(ownerA)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.total").value(1))
                .andExpect(jsonPath("$.items[0].id").value(certRevoked.getId()));

        mockMvc.perform(get(LIST).param("classId", String.valueOf(classA.getId())).with(user(ownerA)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.total").value(2));

        // Lớp của trung tâm B — dù đoán đúng id cũng không kéo được chứng nhận của B sang.
        mockMvc.perform(get(LIST).param("classId", String.valueOf(certB.getClassId())).with(user(ownerA)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.total").value(0));

        mockMvc.perform(get(LIST).param("q", studentTag.toUpperCase()).with(user(ownerA)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.total").value(1))
                .andExpect(jsonPath("$.items[0].id").value(certActive.getId()));
    }

    @Test
    @DisplayName("OWNER trung tâm B chỉ thấy chứng nhận của B")
    void otherOrgIsIsolated() throws Exception {
        mockMvc.perform(get(LIST).with(user(ownerB)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.total").value(1))
                .andExpect(jsonPath("$.items[0].id").value(certB.getId()));
    }

    @Test
    @DisplayName("TEACHER (thành viên trung tâm): 403 cả danh sách lẫn thu hồi")
    void teacherForbidden() throws Exception {
        mockMvc.perform(get(LIST).with(user(teacherA))).andExpect(status().isForbidden());
        mockMvc.perform(post(REVOKE, certActive.getId()).with(user(teacherA))
                        .contentType(MediaType.APPLICATION_JSON).content(REASON_JSON))
                .andExpect(status().isForbidden());
        assertThat(isActive(certActive.getId())).isTrue();
    }

    @Test
    @DisplayName("Ẩn danh: 401 cả danh sách lẫn thu hồi")
    void anonymousRejected() throws Exception {
        mockMvc.perform(get(LIST)).andExpect(status().isUnauthorized());
        mockMvc.perform(post(REVOKE, certActive.getId())
                        .contentType(MediaType.APPLICATION_JSON).content(REASON_JSON))
                .andExpect(status().isUnauthorized());
    }

    // ── thu hồi ──────────────────────────────────────────────────────────────

    @Test
    @DisplayName("OWNER thu hồi kèm lý do: 200 active=false, DB đổi, VẾT org.certificate.revoked mang lý do + by=OWNER, KHÔNG tên HV; link công khai báo đã thu hồi")
    void ownerRevokesWithReasonAndLeavesTrace() throws Exception {
        mockMvc.perform(post(REVOKE, certActive.getId()).with(user(ownerA))
                        .contentType(MediaType.APPLICATION_JSON).content(REASON_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(certActive.getId()))
                .andExpect(jsonPath("$.active").value(false))
                .andExpect(jsonPath("$.className").value(classA.getName()));

        assertThat(isActive(certActive.getId())).isFalse();

        List<Map<String, Object>> traces = revokeTraces(certActive.getId());
        assertThat(traces).hasSize(1);
        Map<String, Object> trace = traces.get(0);
        assertThat(trace.get("target_type")).isEqualTo("ORG_CERTIFICATE");
        assertThat(((Number) trace.get("actor_user_id")).longValue()).isEqualTo(ownerA.getId());
        assertThat(((Number) trace.get("org_id")).longValue()).isEqualTo(orgA.getId());
        // metadata_json là jsonb: Postgres trả về dạng đã chuẩn hoá lại (có khoảng trắng sau dấu hai
        // chấm, thứ tự khoá tuỳ ý), nên so khớp trên MAP đã parse chứ không trên chuỗi thô.
        String rawMeta = String.valueOf(trace.get("metadata_json"));
        Map<String, Object> meta = objectMapper.readValue(rawMeta, new TypeReference<Map<String, Object>>() {});
        assertThat(meta).containsEntry("by", "OWNER")
                .containsEntry("reason", "Cấp nhầm trình độ, lớp chưa thi cuối kỳ")
                .doesNotContainKeys("studentName", "score", "note"); // DEC-13: không tên HV, không điểm
        assertThat(((Number) meta.get("certificateId")).longValue()).isEqualTo(certActive.getId());
        assertThat(((Number) meta.get("classId")).longValue()).isEqualTo(classA.getId());
        assertThat(((Number) meta.get("studentUserId")).longValue()).isEqualTo(certActive.getStudentUserId());
        assertThat(((Number) meta.get("orgId")).longValue()).isEqualTo(orgA.getId());
        assertThat(rawMeta).doesNotContain(studentTag);

        // Link xác thực công khai: vẫn 200 nhưng cờ active=false — trang báo "đã thu hồi", không 404.
        mockMvc.perform(get(PUBLIC_VERIFY, certActive.getVerifyToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.active").value(false))
                .andExpect(jsonPath("$.certificateCode").value(certActive.getCertificateCode()));
    }

    @Test
    @DisplayName("Thu hồi lần hai: vẫn 200 active=false, KHÔNG thêm vết (idempotent)")
    void revokeIsIdempotent() throws Exception {
        for (int i = 0; i < 2; i++) {
            mockMvc.perform(post(REVOKE, certActive.getId()).with(user(ownerA))
                            .contentType(MediaType.APPLICATION_JSON).content(REASON_JSON))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.active").value(false));
        }
        assertThat(revokeTraces(certActive.getId())).hasSize(1);
    }

    @Test
    @DisplayName("MANAGER thu hồi → 403, chứng nhận còn nguyên, không vết")
    void managerCannotRevoke() throws Exception {
        mockMvc.perform(post(REVOKE, certActive.getId()).with(user(managerA))
                        .contentType(MediaType.APPLICATION_JSON).content(REASON_JSON))
                .andExpect(status().isForbidden());
        assertThat(isActive(certActive.getId())).isTrue();
        assertThat(revokeTraces(certActive.getId())).isEmpty();
    }

    @Test
    @DisplayName("OWNER thu hồi chứng nhận của trung tâm KHÁC → 404, chứng nhận kia còn nguyên")
    void otherOrgCertificateIs404() throws Exception {
        mockMvc.perform(post(REVOKE, certB.getId()).with(user(ownerA))
                        .contentType(MediaType.APPLICATION_JSON).content(REASON_JSON))
                .andExpect(status().isNotFound());
        assertThat(isActive(certB.getId())).isTrue();
    }

    @Test
    @DisplayName("Lý do trống hoặc thiếu thân → 400, chứng nhận còn nguyên")
    void blankReasonIs400() throws Exception {
        mockMvc.perform(post(REVOKE, certActive.getId()).with(user(ownerA))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"reason\":\"   \"}"))
                .andExpect(status().isBadRequest());
        mockMvc.perform(post(REVOKE, certActive.getId()).with(user(ownerA)))
                .andExpect(status().isBadRequest());
        assertThat(isActive(certActive.getId())).isTrue();
    }

    @Test
    @DisplayName("Link công khai của chứng nhận còn hiệu lực: 200 active=true (không đăng nhập)")
    void publicVerifyActiveCertificate() throws Exception {
        mockMvc.perform(get(PUBLIC_VERIFY, certActive.getVerifyToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.active").value(true))
                .andExpect(jsonPath("$.studentName").value(certActive.getStudentNameSnapshot()));
    }

    // ── helpers ─────────────────────────────────────────────────────────────

    private Organization org() {
        return organizationRepo.save(Organization.builder()
                .name("TT cert " + UUID.randomUUID().toString().substring(0, 8))
                .slug("cert-it-" + UUID.randomUUID())
                .seatLimit(50)
                .status("ACTIVE")
                .build());
    }

    private User member(Organization org, String orgRole) {
        User u = userRepository.save(User.builder()
                .email("cert-it-" + UUID.randomUUID() + "@test.local")
                .passwordHash("x")
                .displayName("Cert IT " + orgRole)
                .role(User.Role.TEACHER)
                .orgId(org.getId())
                .build());
        memberRepo.save(OrgMember.builder()
                .id(new OrgMemberId(org.getId(), u.getId()))
                .role(orgRole)
                .status("ACTIVE")
                .joinedAt(Instant.now())
                .build());
        return u;
    }

    private OrgCertificate cert(Organization org, TeacherClass cls, User issuer, String studentName, boolean active) {
        String token = UUID.randomUUID().toString().replace("-", "");
        return certificateRepository.save(OrgCertificate.builder()
                .verifyToken(token)
                .certificateCode("DF-B1-2026-" + token.substring(0, 8).toUpperCase())
                .classId(cls.getId())
                .orgId(org.getId())
                .orgNameSnapshot(org.getName())
                .studentUserId(issuer.getId()) // chỉ cần một user thật; sổ không join sang users
                .studentNameSnapshot(studentName)
                .cefrLevel("B1")
                .score(88)
                .issuedByUserId(issuer.getId())
                .issuedByNameSnapshot(issuer.getDisplayName())
                .active(active)
                .build());
    }

    private boolean isActive(Long certificateId) {
        return Boolean.TRUE.equals(jdbcTemplate.queryForObject(
                "SELECT active FROM org_certificates WHERE id = ?", Boolean.class, certificateId));
    }

    private List<Map<String, Object>> revokeTraces(Long certificateId) {
        return jdbcTemplate.queryForList(
                "SELECT actor_user_id, target_type, org_id, metadata_json FROM audit_logs "
                        + "WHERE event_name = 'org.certificate.revoked' AND target_id = ?",
                String.valueOf(certificateId));
    }
}
