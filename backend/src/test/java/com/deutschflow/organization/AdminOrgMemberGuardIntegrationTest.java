package com.deutschflow.organization;

import com.deutschflow.organization.entity.Organization;
import com.deutschflow.organization.repository.OrganizationRepository;
import com.deutschflow.testsupport.AbstractPostgresIntegrationTest;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserRepository;
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
import org.springframework.test.web.servlet.ResultActions;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * AC-ORG-CT-01 (DEC-13, owner chốt 09/09/2026) — <b>admin nền tảng KHÔNG BAO GIỜ là thành viên
 * trung tâm</b>, kiểm qua đúng chuỗi thật: Spring Security filter chain → AdminOrganizationController
 * → AdminOrgService → OrgMembershipService → Postgres.
 *
 * <p>Đây là đường khai thác trực tiếp nhất và cũng là thứ chỉ DB thật mới chứng minh được: một lệnh
 * HTTP {@code POST /api/admin/organizations/{id}/members} với CHÍNH email của mình là mở trọn console
 * trung tâm, vì 9 controller {@code /api/org/**} chỉ khai {@code isAuthenticated()} ở cấp lớp — phân
 * quyền thật nằm ở {@code OrgGuard} đọc bảng {@code org_members}. Nên ba thứ phải đúng CÙNG LÚC:
 * <ol>
 *   <li>lời gọi bị từ chối 400 với thông báo nói rõ lý do;</li>
 *   <li>KHÔNG một dòng {@code org_members} nào ra đời — cả khi hỏi xin bất kỳ vai nào trong bốn vai;</li>
 *   <li>{@code /api/org/**} vẫn 403 với admin đó, <b>kể cả khi {@code users.org_id} bị dán tay</b> —
 *       chứng minh 403 đến từ việc thiếu dòng thành viên, không phải từ một lỗi dựng cảnh.</li>
 * </ol>
 *
 * <p>Ca đối chứng {@link #sameCallForRegularTeacher_succeeds()} bắn CÙNG lời gọi bằng một tài khoản
 * TEACHER bình thường và đòi 200 + vào được {@code /api/org} — không có nó, một test luôn-403 vẫn
 * xanh khi endpoint hỏng hoàn toàn.
 *
 * <p>Đây là <b>nửa Java</b> của AC-ORG-CT-01. Nửa DB — hai trigger của V318 chặn cả đường đi vòng
 * service (SQL thô, {@code memberRepo.save}) — nằm ở {@link PlatformAdminOrgMembershipTriggerIntegrationTest}.
 * Ca {@link #stampedOrgId_withoutMembershipRow_isStillForbidden()} vẫn dán tay được {@code users.org_id}
 * vì V318 cố ý KHÔNG gắn trigger lên bản sao nhanh đó: cổng thật là dòng {@code org_members}.
 *
 * <p>Tự bỏ qua khi không có Postgres — xem {@link AbstractPostgresIntegrationTest}.
 */
@SpringBootTest
@AutoConfigureMockMvc
@DisplayName("AC-ORG-CT-01: admin nền tảng không kết nạp được vào trung tâm (DEC-13)")
class AdminOrgMemberGuardIntegrationTest extends AbstractPostgresIntegrationTest {

    /** Đúng bốn vai mà AdminOrgService.normalizeRole chấp nhận — không vai nào là cửa sau. */
    private static final List<String> MEMBER_ROLES = List.of("OWNER", "MANAGER", "TEACHER", "STUDENT");

    /**
     * Kiểm CẢ nội dung thông báo, không chỉ mã 400: endpoint này có sẵn ba đường 400 khác
     * (vai không hợp lệ, hạ vai OWNER, OWNER thứ hai) nên một assert "isBadRequest" trần vẫn xanh
     * khi guard DEC-13 biến mất.
     */
    private static final String BLOCKED_MESSAGE =
            "Quản trị viên nền tảng không được là thành viên trung tâm";

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private UserRepository userRepository;
    @Autowired private OrganizationRepository organizationRepo;
    @Autowired private JdbcTemplate jdbcTemplate;

    private Organization org;
    private User admin;

    @BeforeEach
    void seedOrgAndPlatformAdmin() {
        org = newOrg();
        admin = account(User.Role.ADMIN);
    }

    @Test
    @DisplayName("Admin nền tảng tự thêm mình bằng chính email của mình ⇒ 400, không sinh dòng org_members")
    void adminAddingSelf_isRejected_andCreatesNoMembershipRow() throws Exception {
        assertThat(rejectAddMember(admin.getEmail(), "OWNER")).contains(BLOCKED_MESSAGE);
        assertThat(membershipRows(admin)).isZero();

        // Tài khoản không bị đụng tới: vẫn là ADMIN, vẫn không thuộc trung tâm nào.
        User after = reload(admin);
        assertThat(after.getRole()).isEqualTo(User.Role.ADMIN);
        assertThat(after.getOrgId()).isNull();
    }

    @Test
    @DisplayName("Không vai nào lọt: OWNER, MANAGER, TEACHER, STUDENT đều bị từ chối như nhau")
    void everyRequestedRole_isRejected() throws Exception {
        for (String role : MEMBER_ROLES) {
            assertThat(rejectAddMember(admin.getEmail(), role))
                    .as("vai được yêu cầu: %s", role)
                    .contains(BLOCKED_MESSAGE);
        }

        assertThat(membershipRows(admin)).isZero();
    }

    @Test
    @DisplayName("Sau lần thử bị chặn, admin gọi /api/org/** vẫn 403 — console trung tâm không hé ra")
    void afterBlockedAttempt_orgConsoleStaysForbidden() throws Exception {
        assertThat(rejectAddMember(admin.getEmail(), "OWNER")).contains(BLOCKED_MESSAGE);

        User stillOutside = reload(admin);
        mockMvc.perform(get("/api/org").with(user(stillOutside))).andExpect(status().isForbidden());
        mockMvc.perform(get("/api/org/seats").with(user(stillOutside))).andExpect(status().isForbidden());
        mockMvc.perform(get("/api/org/members").with(user(stillOutside))).andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Dán tay users.org_id cho admin cũng không mở được cửa — org_members mới là cổng")
    void stampedOrgId_withoutMembershipRow_isStillForbidden() throws Exception {
        // Không đi qua service (service đã chặn) — dán thẳng vào DB để loại bỏ cách giải thích
        // "403 chỉ vì orgId null". Cổng thật là OrgGuard.assertMember đọc org_members.
        jdbcTemplate.update("UPDATE users SET org_id = ? WHERE id = ?", org.getId(), admin.getId());

        User stamped = reload(admin);
        assertThat(stamped.getOrgId()).isEqualTo(org.getId()); // cảnh đã dựng đúng
        mockMvc.perform(get("/api/org").with(user(stamped))).andExpect(status().isForbidden());
        mockMvc.perform(get("/api/org/members").with(user(stamped))).andExpect(status().isForbidden());
        assertThat(membershipRows(admin)).isZero();
    }

    @Test
    @DisplayName("Lần thử bị chặn để lại vết admin.org.admin_membership.blocked — rollback không cuốn vết đi")
    void blockedAttempt_leavesAuditTrail() throws Exception {
        assertThat(rejectAddMember(admin.getEmail(), "OWNER")).contains(BLOCKED_MESSAGE);

        Long traces = jdbcTemplate.queryForObject("""
                SELECT COUNT(*) FROM audit_logs
                 WHERE event_name = 'admin.org.admin_membership.blocked'
                   AND target_type = 'ORG'
                   AND target_id = ?
                   AND actor_user_id = ?
                   AND CAST(metadata_json AS text) LIKE '%platform_admin%'
                """, Long.class, String.valueOf(org.getId()), admin.getId());

        assertThat(traces).isEqualTo(1L);

        // 🔴 org_id phải được đóng dấu: sổ hoạt động của trung tâm (GET /api/org/audit) lọc theo cột
        // này, nên vết NULL nằm trong bảng mà giám đốc không bao giờ thấy — đúng người cần thấy nhất.
        Long stampedOrg = jdbcTemplate.queryForObject("""
                SELECT org_id FROM audit_logs
                 WHERE event_name = 'admin.org.admin_membership.blocked'
                   AND target_id = ?
                 ORDER BY id DESC LIMIT 1
                """, Long.class, String.valueOf(org.getId()));
        assertThat(stampedOrg).isEqualTo(org.getId());
    }

    @Test
    @DisplayName("Đối chứng: CÙNG lời gọi với tài khoản giáo viên bình thường thì THÀNH CÔNG")
    void sameCallForRegularTeacher_succeeds() throws Exception {
        User teacher = account(User.Role.TEACHER);

        addMember(admin, teacher.getEmail(), "TEACHER").andExpect(status().isOk());

        assertThat(membershipRows(teacher)).isEqualTo(1L);
        assertThat(memberRole(teacher)).isEqualTo("TEACHER");

        User joined = reload(teacher);
        assertThat(joined.getOrgId()).isEqualTo(org.getId());
        mockMvc.perform(get("/api/org").with(user(joined))).andExpect(status().isOk());
    }

    // ── helpers ─────────────────────────────────────────────────────────────

    /** Admin nền tảng bấm "Thêm thành viên" trong console admin — đúng lời gọi HTTP của màn đó. */
    private ResultActions addMember(User actor, String email, String role) throws Exception {
        return mockMvc.perform(post("/api/admin/organizations/{id}/members", org.getId())
                .with(user(actor))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of("email", email, "role", role))));
    }

    /** Lời gọi trên phải trả 400; trả về thân phản hồi (UTF-8) để soi đúng lý do từ chối. */
    private String rejectAddMember(String email, String role) throws Exception {
        return addMember(admin, email, role)
                .andExpect(status().isBadRequest())
                .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
    }

    private Organization newOrg() {
        return organizationRepo.save(Organization.builder()
                .name("TT " + UUID.randomUUID().toString().substring(0, 8))
                .slug("ct01-" + UUID.randomUUID())
                .seatLimit(50)
                .status("ACTIVE")
                .build());
    }

    private User account(User.Role role) {
        return userRepository.save(User.builder()
                .email("ct01-" + UUID.randomUUID() + "@test.local")
                .passwordHash("x")
                .displayName("CT01 " + role.name())
                .role(role)
                .build());
    }

    private User reload(User u) {
        return userRepository.findById(u.getId()).orElseThrow();
    }

    private Long membershipRows(User u) {
        return jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM org_members WHERE user_id = ?", Long.class, u.getId());
    }

    private String memberRole(User u) {
        return jdbcTemplate.queryForObject(
                "SELECT role FROM org_members WHERE user_id = ?", String.class, u.getId());
    }
}
