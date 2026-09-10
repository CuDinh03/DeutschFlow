package com.deutschflow.organization;

import com.deutschflow.organization.entity.OrgMember;
import com.deutschflow.organization.entity.OrgMemberId;
import com.deutschflow.organization.entity.Organization;
import com.deutschflow.organization.repository.OrgMemberRepository;
import com.deutschflow.organization.repository.OrganizationRepository;
import com.deutschflow.testsupport.AbstractPostgresIntegrationTest;
import com.deutschflow.user.entity.RefreshToken;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.RefreshTokenRepository;
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
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Đường khôi phục quyền giám đốc (DEC-13 / A6, owner chốt 10/09/2026) —
 * {@code POST /api/admin/organizations/{id}/force-owner}, kiểm qua đúng chuỗi thật: Spring Security
 * filter chain → AdminOrganizationController (@Valid) → AdminOrgService → OrgMembershipService →
 * Postgres, rồi đọc ngược lại bằng chính sổ của trung tâm ({@code GET /api/org/audit-logs}).
 *
 * <p>Ba điều phải đúng CÙNG LÚC, và chỉ DB thật mới chứng minh được:
 * <ol>
 *   <li>trung tâm về đúng MỘT OWNER ACTIVE — kể cả xuất phát từ 0 OWNER (ca khôi phục) hay gọi hai
 *       lần liên tiếp (idempotent);</li>
 *   <li>phiên đăng nhập của chủ mới lẫn chủ cũ bị thu hồi ({@code refresh_tokens.revoked});</li>
 *   <li>vết {@code admin.org.owner.forced} nằm ở {@code org_id} của trung tâm với
 *       {@code actor_role = ADMIN} — giám đốc MỚI đọc được qua sổ của mình, giám đốc CŨ (nay là
 *       MANAGER) bị 403. Đây là điểm DEC-13 muốn: admin không còn vô hình với trung tâm.</li>
 * </ol>
 *
 * <p>Tự bỏ qua khi không có Postgres — xem {@link AbstractPostgresIntegrationTest}.
 */
@SpringBootTest
@AutoConfigureMockMvc
@DisplayName("Đường khôi phục quyền giám đốc: POST /api/admin/organizations/{id}/force-owner (DEC-13 / A6)")
class AdminForceOwnerIntegrationTest extends AbstractPostgresIntegrationTest {

    private static final String EVENT = "admin.org.owner.forced";
    private static final String REASON = "Giám đốc cũ nghỉ việc, không bàn giao tài khoản.";

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private UserRepository userRepository;
    @Autowired private OrganizationRepository organizationRepo;
    @Autowired private OrgMemberRepository memberRepo;
    @Autowired private RefreshTokenRepository refreshTokenRepository;
    @Autowired private JdbcTemplate jdbcTemplate;

    @Test
    @DisplayName("ADMIN chỉ định MANAGER: chủ cũ → MANAGER, phiên hai bên bị thu hồi, giám đốc MỚI đọc được vết actorRole=ADMIN, chủ cũ 403")
    void adminForcesOwner_demotesOld_revokesSessions_ledgerReadableByNewOwner() throws Exception {
        Organization org = org();
        User oldOwner = member(org, "OWNER");
        User manager = member(org, "MANAGER");
        User admin = account(User.Role.ADMIN);
        liveRefreshToken(oldOwner);
        liveRefreshToken(manager);

        forceOwner(admin, org, manager.getId(), REASON)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.userId").value(manager.getId()))
                .andExpect(jsonPath("$.role").value("OWNER"))
                .andExpect(jsonPath("$.status").value("ACTIVE"));

        // (1) Đúng một OWNER, cả org_members lẫn users.role đều đồng bộ.
        assertThat(memberRole(org, manager)).isEqualTo("OWNER");
        assertThat(memberRole(org, oldOwner)).isEqualTo("MANAGER");
        assertThat(activeOwnerCount(org)).isEqualTo(1L);
        assertThat(reload(manager).getRole()).isEqualTo(User.Role.OWNER);
        assertThat(reload(manager).getOrgId()).isEqualTo(org.getId());
        assertThat(reload(oldOwner).getRole()).isEqualTo(User.Role.MANAGER);

        // (2) Phiên của CẢ HAI bị thu hồi — chủ cũ không giữ được orgRole=OWNER trong token cũ.
        assertThat(liveRefreshTokens(oldOwner)).isZero();
        assertThat(liveRefreshTokens(manager)).isZero();

        // (3) Vết nằm ở org_id của trung tâm, actor là ADMIN, mang lý do và danh sách chủ cũ —
        // KHÔNG mang email/tên (metadata_json là jsonb: so bằng toán tử jsonb, đừng LIKE chuỗi).
        Long traces = jdbcTemplate.queryForObject("""
                SELECT COUNT(*) FROM audit_logs
                 WHERE event_name = ?
                   AND org_id = ?
                   AND actor_user_id = ?
                   AND actor_role = 'ADMIN'
                   AND target_type = 'ORG'
                   AND target_id = ?
                   AND metadata_json -> 'previousOwnerUserIds' = CAST(? AS jsonb)
                   AND metadata_json ->> 'reason' = ?
                   AND CAST(metadata_json ->> 'newOwnerUserId' AS bigint) = ?
                   AND CAST(metadata_json AS text) NOT LIKE '%@test.local%'
                """, Long.class, EVENT, org.getId(), admin.getId(), String.valueOf(org.getId()),
                "[" + oldOwner.getId() + "]", REASON, manager.getId());
        assertThat(traces).isEqualTo(1L);

        // Giám đốc MỚI đọc sổ của mình: thấy đúng vết, actorRole=ADMIN, orgId = trung tâm mình.
        mockMvc.perform(get("/api/org/audit-logs").with(user(reload(manager))).param("q", EVENT))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.total").value(1))
                .andExpect(jsonPath("$.items[0].eventName").value(EVENT))
                .andExpect(jsonPath("$.items[0].actorRole").value("ADMIN"))
                .andExpect(jsonPath("$.items[0].actorEmail").value(admin.getEmail()))
                .andExpect(jsonPath("$.items[0].orgId").value(org.getId()));

        // Chủ CŨ (nay là MANAGER) không còn đọc được sổ — quyền đi theo org_members, không theo ký ức.
        mockMvc.perform(get("/api/org/audit-logs").with(user(reload(oldOwner))).param("q", EVENT))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Ca khôi phục: trung tâm 0 OWNER → giáo viên được đặt làm OWNER, vết ghi previousOwnerUserIds rỗng")
    void ownerlessOrg_isRecovered() throws Exception {
        Organization org = org();
        User teacher = member(org, "TEACHER");
        User admin = account(User.Role.ADMIN);
        assertThat(activeOwnerCount(org)).isZero(); // cảnh đã dựng đúng: trung tâm mồ côi

        forceOwner(admin, org, teacher.getId(), REASON).andExpect(status().isOk());

        assertThat(memberRole(org, teacher)).isEqualTo("OWNER");
        assertThat(activeOwnerCount(org)).isEqualTo(1L);
        assertThat(reload(teacher).getRole()).isEqualTo(User.Role.OWNER);
        Long traces = jdbcTemplate.queryForObject("""
                SELECT COUNT(*) FROM audit_logs
                 WHERE event_name = ? AND org_id = ?
                   AND metadata_json -> 'previousOwnerUserIds' = CAST('[]' AS jsonb)
                """, Long.class, EVENT, org.getId());
        assertThat(traces).isEqualTo(1L);
    }

    @Test
    @DisplayName("Idempotent: gọi hai lần liên tiếp cùng người → cả hai 200, vẫn đúng một OWNER, không ai bị hạ thêm")
    void secondCall_isNoOpWithTrace() throws Exception {
        Organization org = org();
        User oldOwner = member(org, "OWNER");
        User manager = member(org, "MANAGER");
        User admin = account(User.Role.ADMIN);

        forceOwner(admin, org, manager.getId(), REASON).andExpect(status().isOk());
        forceOwner(admin, org, manager.getId(), REASON + " (gọi lại)").andExpect(status().isOk());

        assertThat(memberRole(org, manager)).isEqualTo("OWNER");
        assertThat(memberRole(org, oldOwner)).isEqualTo("MANAGER");
        assertThat(activeOwnerCount(org)).isEqualTo(1L);
        // Lần hai không có ai để hạ: vết vẫn ghi (có lý do), previousOwnerUserIds rỗng.
        Long second = jdbcTemplate.queryForObject("""
                SELECT COUNT(*) FROM audit_logs
                 WHERE event_name = ? AND org_id = ?
                   AND metadata_json -> 'previousOwnerUserIds' = CAST('[]' AS jsonb)
                """, Long.class, EVENT, org.getId());
        assertThat(second).isEqualTo(1L);
        assertThat(traceCount(org)).isEqualTo(2L);
    }

    @Test
    @DisplayName("Lý do trống hoặc dưới 10 ký tự → 400 tại cổng @Valid, không đổi gì, không vết")
    void blankOrShortReason_isRejectedAtTheGate() throws Exception {
        Organization org = org();
        User oldOwner = member(org, "OWNER");
        User manager = member(org, "MANAGER");
        User admin = account(User.Role.ADMIN);

        for (String bad : new String[] {"", "   ", "ngắn quá"}) {
            String body = forceOwner(admin, org, manager.getId(), bad)
                    .andExpect(status().isBadRequest())
                    .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
            assertThat(body).as("lý do: [%s]", bad).contains("reason");
        }

        assertThat(memberRole(org, oldOwner)).isEqualTo("OWNER");
        assertThat(memberRole(org, manager)).isEqualTo("MANAGER");
        assertThat(traceCount(org)).isZero();
    }

    @Test
    @DisplayName("Học viên (STUDENT) không nhận vai giám đốc → 400 nói rõ, chủ cũ giữ nguyên, không vết")
    void studentTarget_isRejected() throws Exception {
        Organization org = org();
        User oldOwner = member(org, "OWNER");
        User student = member(org, "STUDENT");
        User admin = account(User.Role.ADMIN);

        String body = forceOwner(admin, org, student.getId(), REASON)
                .andExpect(status().isBadRequest())
                .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        assertThat(body).contains("học viên");

        assertThat(memberRole(org, oldOwner)).isEqualTo("OWNER");
        assertThat(memberRole(org, student)).isEqualTo("STUDENT");
        assertThat(traceCount(org)).isZero();
    }

    @Test
    @DisplayName("Người ngoài trung tâm (không có dòng org_members) → 400, chủ cũ giữ nguyên")
    void outsiderTarget_isRejected() throws Exception {
        Organization org = org();
        User oldOwner = member(org, "OWNER");
        User outsider = account(User.Role.TEACHER);
        User admin = account(User.Role.ADMIN);

        forceOwner(admin, org, outsider.getId(), REASON).andExpect(status().isBadRequest());

        assertThat(memberRole(org, oldOwner)).isEqualTo("OWNER");
        assertThat(activeOwnerCount(org)).isEqualTo(1L);
        assertThat(traceCount(org)).isZero();
    }

    @Test
    @DisplayName("DEC-13: chỉ định một ADMIN nền tảng khác làm giám đốc → 400 + vết admin.org.admin_membership.blocked, chủ cũ giữ nguyên")
    void adminTarget_isBlockedWithTrace() throws Exception {
        Organization org = org();
        User oldOwner = member(org, "OWNER");
        User admin = account(User.Role.ADMIN);
        User otherAdmin = account(User.Role.ADMIN);

        String body = forceOwner(admin, org, otherAdmin.getId(), REASON)
                .andExpect(status().isBadRequest())
                .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        assertThat(body).contains("quản trị viên nền tảng");

        assertThat(memberRole(org, oldOwner)).isEqualTo("OWNER");
        assertThat(jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM org_members WHERE user_id = ?", Long.class, otherAdmin.getId())).isZero();
        Long blocked = jdbcTemplate.queryForObject("""
                SELECT COUNT(*) FROM audit_logs
                 WHERE event_name = 'admin.org.admin_membership.blocked'
                   AND target_type = 'ORG' AND target_id = ?
                   AND actor_user_id = ?
                   AND metadata_json ->> 'reason' = 'platform_admin'
                   AND metadata_json ->> 'requestedRole' = 'OWNER'
                   AND CAST(metadata_json ->> 'targetUserId' AS bigint) = ?
                """, Long.class, String.valueOf(org.getId()), admin.getId(), otherAdmin.getId());
        assertThat(blocked).isEqualTo(1L);
        assertThat(traceCount(org)).isZero();
    }

    @Test
    @DisplayName("Chính OWNER của trung tâm gọi endpoint admin → 403; ẩn danh → 401; org không tồn tại → 404")
    void authorizationContract() throws Exception {
        Organization org = org();
        User owner = member(org, "OWNER");
        User manager = member(org, "MANAGER");
        User admin = account(User.Role.ADMIN);

        forceOwner(owner, org, manager.getId(), REASON).andExpect(status().isForbidden());
        assertThat(memberRole(org, owner)).isEqualTo("OWNER");

        mockMvc.perform(post("/api/admin/organizations/{id}/force-owner", org.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                Map.of("newOwnerUserId", manager.getId(), "reason", REASON))))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(post("/api/admin/organizations/{id}/force-owner", 999_999_999L)
                        .with(user(admin))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                Map.of("newOwnerUserId", manager.getId(), "reason", REASON))))
                .andExpect(status().isNotFound());
        assertThat(traceCount(org)).isZero();
    }

    // ── helpers ─────────────────────────────────────────────────────────────

    /** Admin bấm "Chỉ định giám đốc" trong console admin — đúng lời gọi HTTP của màn đó. */
    private ResultActions forceOwner(User actor, Organization org, Long newOwnerUserId, String reason)
            throws Exception {
        return mockMvc.perform(post("/api/admin/organizations/{id}/force-owner", org.getId())
                .with(user(actor))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(
                        Map.of("newOwnerUserId", newOwnerUserId, "reason", reason))));
    }

    private Organization org() {
        return organizationRepo.save(Organization.builder()
                .name("TT " + UUID.randomUUID().toString().substring(0, 8))
                .slug("force-owner-" + UUID.randomUUID())
                .seatLimit(50)
                .status("ACTIVE")
                .build());
    }

    private User account(User.Role role) {
        return userRepository.save(User.builder()
                .email("force-owner-" + UUID.randomUUID() + "@test.local")
                .passwordHash("x")
                .displayName("FO " + role.name())
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

    private void liveRefreshToken(User u) {
        refreshTokenRepository.save(RefreshToken.builder()
                .user(u)
                .token("fo-" + UUID.randomUUID())
                .expiresAt(LocalDateTime.now().plusDays(7))
                .build());
    }

    private User reload(User u) {
        return userRepository.findById(u.getId()).orElseThrow();
    }

    private String memberRole(Organization org, User u) {
        return jdbcTemplate.queryForObject(
                "SELECT role FROM org_members WHERE org_id = ? AND user_id = ?", String.class,
                org.getId(), u.getId());
    }

    private Long activeOwnerCount(Organization org) {
        return jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM org_members WHERE org_id = ? AND role = 'OWNER' AND status = 'ACTIVE'",
                Long.class, org.getId());
    }

    private Long liveRefreshTokens(User u) {
        return jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM refresh_tokens WHERE user_id = ? AND revoked = FALSE", Long.class, u.getId());
    }

    private Long traceCount(Organization org) {
        return jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM audit_logs WHERE event_name = ? AND org_id = ?", Long.class,
                EVENT, org.getId());
    }
}
