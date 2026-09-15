package com.deutschflow.organization;

import com.deutschflow.common.audit.AuditActor;
import com.deutschflow.common.audit.AuditLogService;
import com.deutschflow.organization.entity.OrgMember;
import com.deutschflow.organization.entity.OrgMemberId;
import com.deutschflow.organization.entity.Organization;
import com.deutschflow.organization.repository.OrgMemberRepository;
import com.deutschflow.organization.repository.OrganizationRepository;
import com.deutschflow.testsupport.AbstractPostgresIntegrationTest;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Hợp đồng phân quyền của {@code GET /api/org/audit-logs} (C6 — sổ hoạt động của giám đốc trung
 * tâm), kiểm qua đúng chuỗi thật: Spring Security filter chain → {@code OrgAuditController} →
 * {@code OrgGuard} đọc bảng {@code org_members} → Postgres.
 *
 * <p><b>Vì sao endpoint này cần ca riêng.</b> Nó khai {@code @PreAuthorize("isAuthenticated()")} ở
 * cấp lớp — giống 9 controller {@code /api/org/**} khác — nên method security KHÔNG phân biệt vai.
 * Toàn bộ khác biệt OWNER/MANAGER/TEACHER nằm trong một dòng {@code orgGuard.assertOrgOwner(...)}
 * bên trong thân hàm. Một dòng như vậy biến mất trong lúc refactor thì không có gì đỏ, mà hậu quả
 * là mọi giáo viên đọc được sổ vận hành của trung tâm: ai gỡ ai khỏi lớp, ai đổi ghế, ai xoá gì.
 *
 * <ul>
 *   <li>OWNER → 200;</li>
 *   <li>MANAGER, TEACHER (thành viên ACTIVE, sai vai) → 403;</li>
 *   <li>người ngoài trung tâm → 403, <b>kể cả khi {@code users.org_id} đã bị dán tay</b>;</li>
 *   <li>ẩn danh → 401.</li>
 * </ul>
 *
 * <p>Ca quyết định là {@link #platformAdminTrace_readableByTouchedOrgOwnerOnly()}: DEC-13 (owner
 * chốt 09/09/2026) nói admin nền tảng không bao giờ là thành viên trung tâm, nên
 * {@code users.org_id} của họ luôn NULL và — trước bản vá — mọi vết họ ghi ra rơi vào {@code org_id
 * NULL}, mà đường đọc ở đây lọc {@code AND org_id = ?} nên loại sạch. Ca đó chốt rằng giám đốc ĐỌC
 * ĐƯỢC thao tác admin trên trung tâm mình, và chỉ mình mình.
 *
 * <p>Tự bỏ qua khi không có Postgres — xem {@link AbstractPostgresIntegrationTest}.
 */
@SpringBootTest
@AutoConfigureMockMvc
@DisplayName("org-audit read RBAC contract (C6, DEC-13)")
class OrgAuditControllerRbacIntegrationTest extends AbstractPostgresIntegrationTest {

    private static final String PATH = "/api/org/audit-logs";

    @Autowired private MockMvc mockMvc;
    @Autowired private AuditLogService auditLogService;
    @Autowired private OrganizationRepository organizationRepo;
    @Autowired private OrgMemberRepository memberRepo;
    @Autowired private UserRepository userRepository;
    @Autowired private JdbcTemplate jdbcTemplate;

    @Test
    @DisplayName("OWNER đọc được sổ của trung tâm mình (200)")
    void ownerAllowed() throws Exception {
        Organization org = org();
        User owner = member(org, "OWNER");
        String evt = "RBAC_OWNER_" + UUID.randomUUID();
        auditLogService.log(evt, actor(owner, "OWNER"), "ORG", String.valueOf(org.getId()),
                org.getId(), Map.of("k", "v"));

        mockMvc.perform(get(PATH).with(user(owner)).param("q", evt).param("size", "5"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.total").value(1))
                .andExpect(jsonPath("$.items[0].eventName").value(evt))
                // orgId phải ra tới JSON: màn sổ dùng nó để xác nhận "đúng là vết của trung tâm tôi".
                .andExpect(jsonPath("$.items[0].orgId").value(org.getId()));
    }

    @Test
    @DisplayName("MANAGER là org-admin nhưng KHÔNG đọc được sổ (403)")
    void managerForbidden() throws Exception {
        Organization org = org();
        mockMvc.perform(get(PATH).with(user(member(org, "MANAGER"))))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("TEACHER của chính trung tâm đó cũng không đọc được sổ (403)")
    void teacherForbidden() throws Exception {
        Organization org = org();
        mockMvc.perform(get(PATH).with(user(member(org, "TEACHER"))))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Người ngoài trung tâm: không thuộc trung tâm nào ⇒ 403")
    void outsiderWithoutOrgForbidden() throws Exception {
        mockMvc.perform(get(PATH).with(user(account(User.Role.STUDENT))))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Người ngoài trung tâm: dán tay users.org_id vẫn 403 — org_members mới là cổng")
    void outsiderWithStampedOrgIdForbidden() throws Exception {
        Organization org = org();
        member(org, "OWNER"); // trung tâm có thật, có giám đốc thật — chỉ kẻ gọi là người lạ
        User outsider = account(User.Role.TEACHER);

        // Không đi qua service: dán thẳng vào DB để loại bỏ cách giải thích "403 chỉ vì orgId null".
        jdbcTemplate.update("UPDATE users SET org_id = ? WHERE id = ?", org.getId(), outsider.getId());
        User stamped = reload(outsider);
        assertThat(stamped.getOrgId()).isEqualTo(org.getId()); // cảnh đã dựng đúng

        mockMvc.perform(get(PATH).with(user(stamped))).andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Ẩn danh bị chặn ở cổng xác thực (401)")
    void anonymousRejected() throws Exception {
        mockMvc.perform(get(PATH)).andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("🔴 Admin nền tảng thao tác trên trung tâm A ⇒ OWNER A ĐỌC ĐƯỢC, OWNER B KHÔNG")
    void platformAdminTrace_readableByTouchedOrgOwnerOnly() throws Exception {
        Organization orgA = org();
        Organization orgB = org();
        User ownerA = member(orgA, "OWNER");
        User ownerB = member(orgB, "OWNER");
        User platformAdmin = account(User.Role.ADMIN); // DEC-13: org_id luôn NULL
        assertThat(platformAdmin.getOrgId()).isNull();

        String evt = "RBAC_ADMIN_ON_A_" + UUID.randomUUID();
        auditLogService.log(evt, actor(platformAdmin, "ADMIN"), "ORG", String.valueOf(orgA.getId()),
                orgA.getId(), Map.of("action", "seat.changed"));

        mockMvc.perform(get(PATH).with(user(ownerA)).param("q", evt))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.total").value(1))
                .andExpect(jsonPath("$.items[0].actorEmail").value(platformAdmin.getEmail()))
                .andExpect(jsonPath("$.items[0].orgId").value(orgA.getId()));

        // Cách ly tenant: giám đốc B mở đúng URL đó, đoán đúng tên sự kiện, vẫn không thấy gì —
        // orgId lấy từ người gọi chứ không nhận từ tham số, nên không có đường nào để hỏi sổ của A.
        mockMvc.perform(get(PATH).with(user(ownerB)).param("q", evt))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.total").value(0));
    }

    // ── helpers ─────────────────────────────────────────────────────────────

    private Organization org() {
        return organizationRepo.save(Organization.builder()
                .name("TT " + UUID.randomUUID().toString().substring(0, 8))
                .slug("rbac-audit-" + UUID.randomUUID())
                .seatLimit(50)
                .status("ACTIVE")
                .build());
    }

    private User account(User.Role role) {
        return userRepository.save(User.builder()
                .email("rbac-audit-" + UUID.randomUUID() + "@test.local")
                .passwordHash("x")
                .displayName("RBAC " + role.name())
                .role(role)
                .build());
    }

    /** Thành viên ACTIVE của trung tâm với vai org đã cho ({@code org_members.role}). */
    private User member(Organization org, String orgRole) {
        User u = account(User.Role.TEACHER);
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

    private User reload(User u) {
        return userRepository.findById(u.getId()).orElseThrow();
    }

    private static AuditActor actor(User u, String role) {
        return new AuditActor(u.getId(), u.getEmail(), role);
    }
}
