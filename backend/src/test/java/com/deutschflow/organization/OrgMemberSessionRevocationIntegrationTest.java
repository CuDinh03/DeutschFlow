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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Gói 2 (10/09/2026) — mất quyền trong trung tâm là MẤT PHIÊN: gỡ thành viên, tự rời, đổi vai,
 * chuyển quyền sở hữu đều thu hồi mọi refresh token của người bị tác động, qua đúng chuỗi thật:
 * Spring Security → OrgController → OrgMembershipService → Postgres, rồi trình chính token cũ cho
 * {@code POST /api/auth/refresh} và đọc sổ của trung tâm.
 *
 * <p>Ba điều phải đúng cùng lúc, chỉ DB thật mới chứng minh được:
 * <ol>
 *   <li>token cũ bị {@code refresh_tokens.revoked = TRUE} và endpoint refresh TỪ CHỐI (400) — tức
 *       sau khi access token (TTL 15 phút) hết hạn, người đó bắt buộc đăng nhập lại;</li>
 *   <li>vết {@code org_member_sessions_revoked} nằm ở {@code org_id} của trung tâm (kể cả khi người
 *       tự rời đã bị xoá {@code users.org_id} trước khi vết được ghi), chỉ id + số lượng, không email;</li>
 *   <li>phiên của người KHÔNG liên quan (chủ sở hữu bấm gỡ, giáo viên đứng ngoài) còn nguyên —
 *       revoke đúng người, không quét cả trung tâm.</li>
 * </ol>
 *
 * <p>Đường {@code force-owner} của admin đã có {@code AdminForceOwnerIntegrationTest} chốt phiên hai
 * bên bị thu hồi; ở đây không lặp lại. Tự bỏ qua khi không có Postgres — xem
 * {@link AbstractPostgresIntegrationTest}.
 */
@SpringBootTest
@AutoConfigureMockMvc
@DisplayName("Gói 2 — gỡ/rời/đổi vai/chuyển chủ thu hồi refresh token của người bị tác động")
class OrgMemberSessionRevocationIntegrationTest extends AbstractPostgresIntegrationTest {

    private static final String EVENT = "org_member_sessions_revoked";

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private UserRepository userRepository;
    @Autowired private OrganizationRepository organizationRepo;
    @Autowired private OrgMemberRepository memberRepo;
    @Autowired private RefreshTokenRepository refreshTokenRepository;
    @Autowired private JdbcTemplate jdbcTemplate;

    @Test
    @DisplayName("OWNER gỡ giáo viên: cả hai thiết bị của giáo viên bị thu hồi, refresh bằng token cũ → 400, vết revokedCount=2 ở org, phiên OWNER còn nguyên")
    void removeMember_revokesEveryDeviceOfTarget_refreshRejected_ledgerLine() throws Exception {
        Organization org = org();
        User owner = member(org, "OWNER");
        User teacher = member(org, "TEACHER");
        String phone = liveRefreshToken(teacher);
        String laptop = liveRefreshToken(teacher);
        liveRefreshToken(owner);

        mockMvc.perform(delete("/api/org/members/{userId}", teacher.getId()).with(user(owner)))
                .andExpect(status().isNoContent());

        // (1) Token cũ chết thật: cả hai thiết bị, và endpoint refresh từ chối chứ không cấp lại.
        assertThat(liveRefreshTokens(teacher)).isZero();
        assertThat(revokedRefreshTokens(teacher)).isEqualTo(2L);
        refresh(phone).andExpect(status().isBadRequest());
        refresh(laptop).andExpect(status().isBadRequest());

        // (2) Vết ở org của trung tâm, đúng người, đúng số lượng, không PII.
        assertThat(revokedTraces(org, teacher, owner, "removed", 2)).isEqualTo(1L);
        assertThat(jdbcTemplate.queryForObject("""
                SELECT COUNT(*) FROM audit_logs
                 WHERE event_name = ? AND org_id = ?
                   AND CAST(metadata_json AS text) LIKE '%@test.local%'
                """, Long.class, EVENT, org.getId())).isZero();

        // (3) Người bấm gỡ không bị vạ lây.
        assertThat(liveRefreshTokens(owner)).isEqualTo(1L);
    }

    @Test
    @DisplayName("Giáo viên tự rời: phiên của chính mình bị thu hồi, refresh → 400; vết vẫn ở org dù users.org_id đã bị xoá")
    void selfLeave_revokesOwnSessions_traceStaysInOrgLedger() throws Exception {
        Organization org = org();
        member(org, "OWNER");
        User teacher = member(org, "TEACHER");
        String token = liveRefreshToken(teacher);

        mockMvc.perform(post("/api/org/membership/leave").with(user(teacher)))
                .andExpect(status().isNoContent());

        assertThat(reload(teacher).getOrgId()).as("đã rời: users.org_id bị xoá").isNull();
        assertThat(liveRefreshTokens(teacher)).isZero();
        refresh(token).andExpect(status().isBadRequest());
        // Actor CHÍNH là người rời, users.org_id của họ đã NULL — vết vẫn phải rơi vào org này.
        assertThat(revokedTraces(org, teacher, teacher, "left", 1)).isEqualTo(1L);
    }

    @Test
    @DisplayName("OWNER hạ MANAGER → TEACHER: phiên của người bị đổi vai bị thu hồi, phiên OWNER còn nguyên")
    void changeRole_revokesTargetOnly() throws Exception {
        Organization org = org();
        User owner = member(org, "OWNER");
        User manager = member(org, "MANAGER");
        liveRefreshToken(manager);
        liveRefreshToken(owner);

        mockMvc.perform(patch("/api/org/members/{userId}/role", manager.getId())
                        .with(user(owner))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("role", "TEACHER"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.role").value("TEACHER"));

        assertThat(liveRefreshTokens(manager)).isZero();
        assertThat(liveRefreshTokens(owner)).isEqualTo(1L);
        assertThat(revokedTraces(org, manager, owner, "role_changed", 1)).isEqualTo(1L);
    }

    @Test
    @DisplayName("Chuyển quyền sở hữu: CẢ chủ cũ lẫn chủ mới bị thu hồi phiên (hai vết), giáo viên đứng ngoài không bị đụng")
    void transferOwnership_revokesBothParties_bystanderUntouched() throws Exception {
        Organization org = org();
        User owner = member(org, "OWNER");
        User manager = member(org, "MANAGER");
        User bystander = member(org, "TEACHER");
        liveRefreshToken(owner);
        liveRefreshToken(manager);
        liveRefreshToken(bystander);

        mockMvc.perform(post("/api/org/members/{userId}/transfer-ownership", manager.getId())
                        .with(user(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.role").value("OWNER"));

        assertThat(liveRefreshTokens(owner)).isZero();
        assertThat(liveRefreshTokens(manager)).isZero();
        assertThat(liveRefreshTokens(bystander)).isEqualTo(1L);
        assertThat(revokedTraces(org, owner, owner, "ownership_transferred", 1)).isEqualTo(1L);
        assertThat(revokedTraces(org, manager, owner, "ownership_transferred", 1)).isEqualTo(1L);
    }

    @Test
    @DisplayName("Thao tác bị chặn (MANAGER gỡ MANAGER khác → 403) thì không ai mất phiên, không vết")
    void blockedRemoval_revokesNothing() throws Exception {
        Organization org = org();
        member(org, "OWNER");
        User manager = member(org, "MANAGER");
        User otherManager = member(org, "MANAGER");
        liveRefreshToken(otherManager);

        mockMvc.perform(delete("/api/org/members/{userId}", otherManager.getId()).with(user(manager)))
                .andExpect(status().isForbidden());

        assertThat(liveRefreshTokens(otherManager)).isEqualTo(1L);
        assertThat(jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM audit_logs WHERE event_name = ? AND org_id = ?",
                Long.class, EVENT, org.getId())).isZero();
    }

    // ── helpers ─────────────────────────────────────────────────────────────

    /** Đúng lời gọi của client: web gửi cookie, mobile/client cũ gửi body — ở đây dùng body. */
    private ResultActions refresh(String refreshToken) throws Exception {
        return mockMvc.perform(post("/api/auth/refresh")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of("refreshToken", refreshToken)))
                .characterEncoding(StandardCharsets.UTF_8));
    }

    private Long revokedTraces(Organization org, User target, User actor, String reason, int revokedCount) {
        return jdbcTemplate.queryForObject("""
                SELECT COUNT(*) FROM audit_logs
                 WHERE event_name = ?
                   AND org_id = ?
                   AND target_type = 'ORG_MEMBER'
                   AND target_id = ?
                   AND actor_user_id = ?
                   AND metadata_json ->> 'reason' = ?
                   AND CAST(metadata_json ->> 'revokedCount' AS int) = ?
                   AND CAST(metadata_json ->> 'targetUserId' AS bigint) = ?
                """, Long.class, EVENT, org.getId(), String.valueOf(target.getId()), actor.getId(),
                reason, revokedCount, target.getId());
    }

    private Organization org() {
        return organizationRepo.save(Organization.builder()
                .name("TT " + UUID.randomUUID().toString().substring(0, 8))
                .slug("session-revoke-" + UUID.randomUUID())
                .seatLimit(50)
                .status("ACTIVE")
                .build());
    }

    private User account(User.Role role) {
        return userRepository.save(User.builder()
                .email("session-revoke-" + UUID.randomUUID() + "@test.local")
                .passwordHash("x")
                .displayName("SR " + role.name())
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

    /** Một phiên đang sống (một thiết bị) — trả về chuỗi token để trình lại cho /api/auth/refresh. */
    private String liveRefreshToken(User u) {
        String token = "sr-" + UUID.randomUUID();
        refreshTokenRepository.save(RefreshToken.builder()
                .user(u)
                .token(token)
                .expiresAt(LocalDateTime.now().plusDays(7))
                .build());
        return token;
    }

    private User reload(User u) {
        return userRepository.findById(u.getId()).orElseThrow();
    }

    private Long liveRefreshTokens(User u) {
        return jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM refresh_tokens WHERE user_id = ? AND revoked = FALSE", Long.class, u.getId());
    }

    private Long revokedRefreshTokens(User u) {
        return jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM refresh_tokens WHERE user_id = ? AND revoked = TRUE", Long.class, u.getId());
    }
}
