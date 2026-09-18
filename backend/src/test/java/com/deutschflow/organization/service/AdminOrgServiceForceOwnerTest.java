package com.deutschflow.organization.service;

import com.deutschflow.common.audit.AuditActor;
import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.common.exception.PrivilegedActionBlockedException;
import com.deutschflow.organization.dto.OrgMemberDto;
import com.deutschflow.organization.entity.Organization;
import com.deutschflow.organization.repository.OrgMemberRepository;
import com.deutschflow.organization.repository.OrganizationRepository;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.catchThrowableOfType;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * {@link AdminOrgService#forceOwner} — lớp façade của đường khôi phục quyền giám đốc (DEC-13 / A6).
 * Lõi đổi vai đã có ca riêng ở {@code OrgMembershipServiceTest}; ở đây kiểm hai việc façade phải
 * làm ĐÚNG THỨ TỰ trước khi chạm lõi: lý do hợp lệ, người nhận không phải admin nền tảng. Việc thu
 * hồi phiên của chủ mới lẫn mọi chủ cũ từ Gói 2 nằm TRONG lõi ({@code forceOwnership}) — façade
 * không còn tự revoke, ca tương ứng ở {@code OrgMembershipServiceTest}.
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("AdminOrgService.forceOwner — đường khôi phục quyền giám đốc (DEC-13 / A6)")
class AdminOrgServiceForceOwnerTest {

    private static final Long ORG_ID = 5L;
    private static final Long NEW_OWNER_ID = 77L;
    private static final AuditActor ADMIN = new AuditActor(1L, "admin@deutschflow.vn", "ADMIN");
    private static final String REASON = "Giám đốc cũ nghỉ việc, không bàn giao tài khoản.";

    @Mock private OrganizationRepository organizationRepository;
    @Mock private OrgMembershipService orgMembershipService;
    @Mock private OrgInvitationService orgInvitationService;
    @Mock private OrgMemberRepository orgMemberRepository;
    @Mock private OrgEntitlementService orgEntitlementService;
    @Mock private UserRepository userRepository;
    @Mock private org.springframework.security.crypto.password.PasswordEncoder passwordEncoder;
    @Mock private com.deutschflow.notification.service.UserNotificationService userNotificationService;
    @Mock private com.deutschflow.common.audit.AuditLogService auditLogService;

    private AdminOrgService service;

    @BeforeEach
    void setUp() {
        service = new AdminOrgService(organizationRepository, orgMembershipService, orgInvitationService,
                orgMemberRepository, orgEntitlementService, userRepository, passwordEncoder,
                userNotificationService, auditLogService);
    }

    private Organization org() {
        Organization org = new Organization();
        org.setId(ORG_ID);
        org.setName("TT Test");
        org.setSlug("tt-test");
        org.setStatus("ACTIVE");
        return org;
    }

    private static OrgMemberDto ownerDto() {
        return new OrgMemberDto(NEW_OWNER_ID, "u77@trungtam.com", "U77", "OWNER", "ACTIVE", Instant.now(), null);
    }

    private static User userWithRole(User.Role role) {
        return User.builder().id(NEW_OWNER_ID).email("u77@trungtam.com").displayName("U77").role(role).build();
    }

    private void assertNothingHappened() {
        verify(orgMembershipService, never()).forceOwnership(any(), any(), any(), any());
    }

    // ── happy path ────────────────────────────────────────────────────────

    @Test
    @DisplayName("uỷ quyền xuống lõi với lý do đã trim, trả về chủ mới — kể cả khi lõi hạ nhiều chủ cũ")
    void forceOwner_delegatesWithTrimmedReason() {
        when(organizationRepository.findById(ORG_ID)).thenReturn(Optional.of(org()));
        when(userRepository.findById(NEW_OWNER_ID)).thenReturn(Optional.of(userWithRole(User.Role.TEACHER)));
        when(orgMembershipService.forceOwnership(ADMIN, ORG_ID, NEW_OWNER_ID, REASON))
                .thenReturn(new OrgMembershipService.ForcedOwnership(ownerDto(), List.of(5L, 6L)));

        OrgMemberDto out = service.forceOwner(ADMIN, ORG_ID, NEW_OWNER_ID, "  " + REASON + "  ");

        assertThat(out.userId()).isEqualTo(NEW_OWNER_ID);
        assertThat(out.role()).isEqualTo("OWNER");
        // Gói 2: thu hồi phiên chủ mới + chủ cũ là việc của lõi (forceOwnership), façade chỉ uỷ quyền
        // ĐÚNG MỘT lần với lý do đã trim.
        verify(orgMembershipService).forceOwnership(ADMIN, ORG_ID, NEW_OWNER_ID, REASON);
    }

    @Test
    @DisplayName("ca khôi phục: lõi báo 0 chủ cũ → façade vẫn trả về chủ mới bình thường")
    void forceOwner_ownerlessOrg_returnsNewOwner() {
        when(organizationRepository.findById(ORG_ID)).thenReturn(Optional.of(org()));
        when(userRepository.findById(NEW_OWNER_ID)).thenReturn(Optional.empty()); // guard ADMIN bỏ qua khi không có dòng users
        when(orgMembershipService.forceOwnership(ADMIN, ORG_ID, NEW_OWNER_ID, REASON))
                .thenReturn(new OrgMembershipService.ForcedOwnership(ownerDto(), List.of()));

        OrgMemberDto out = service.forceOwner(ADMIN, ORG_ID, NEW_OWNER_ID, REASON);

        assertThat(out.userId()).isEqualTo(NEW_OWNER_ID);
        verify(orgMembershipService).forceOwnership(ADMIN, ORG_ID, NEW_OWNER_ID, REASON);
    }

    // ── guards, đúng thứ tự: org → người nhận → lý do → ADMIN → lõi ─────────

    @Test
    @DisplayName("org không tồn tại → 404, không chạm lõi")
    void forceOwner_orgMissing_throwsNotFound() {
        when(organizationRepository.findById(ORG_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.forceOwner(ADMIN, ORG_ID, NEW_OWNER_ID, REASON))
                .isInstanceOf(NotFoundException.class);

        assertNothingHappened();
    }

    @Test
    @DisplayName("thiếu người nhận → 400, không chạm lõi")
    void forceOwner_nullTarget_throwsBadRequest() {
        when(organizationRepository.findById(ORG_ID)).thenReturn(Optional.of(org()));

        assertThatThrownBy(() -> service.forceOwner(ADMIN, ORG_ID, null, REASON))
                .isInstanceOf(BadRequestException.class);

        assertNothingHappened();
    }

    @Test
    @DisplayName("lý do trống / toàn khoảng trắng / dưới 10 ký tự / trên 500 ký tự → 400, không chạm lõi")
    void forceOwner_badReason_throwsBadRequest() {
        when(organizationRepository.findById(ORG_ID)).thenReturn(Optional.of(org()));

        for (String bad : new String[] {null, "", "        ", "quá ngắn", "x".repeat(501)}) {
            assertThatThrownBy(() -> service.forceOwner(ADMIN, ORG_ID, NEW_OWNER_ID, bad))
                    .as("lý do: [%s]", bad)
                    .isInstanceOf(BadRequestException.class)
                    .hasMessageContaining("Lý do");
        }
        // Đúng 500 ký tự sau trim thì qua — biên trên là bao gồm.
        when(userRepository.findById(NEW_OWNER_ID)).thenReturn(Optional.empty());
        when(orgMembershipService.forceOwnership(eq(ADMIN), eq(ORG_ID), eq(NEW_OWNER_ID), anyString()))
                .thenReturn(new OrgMembershipService.ForcedOwnership(ownerDto(), List.of()));
        service.forceOwner(ADMIN, ORG_ID, NEW_OWNER_ID, "y".repeat(500));
        verify(orgMembershipService).forceOwnership(ADMIN, ORG_ID, NEW_OWNER_ID, "y".repeat(500));
    }

    @Test
    @DisplayName("DEC-13: người nhận là ADMIN nền tảng → chặn kèm chất liệu vết admin.org.admin_membership.blocked, không chạm lõi")
    void forceOwner_adminTarget_blockedWithAuditMaterial() {
        when(organizationRepository.findById(ORG_ID)).thenReturn(Optional.of(org()));
        when(userRepository.findById(NEW_OWNER_ID)).thenReturn(Optional.of(userWithRole(User.Role.ADMIN)));

        PrivilegedActionBlockedException ex = catchThrowableOfType(
                () -> service.forceOwner(ADMIN, ORG_ID, NEW_OWNER_ID, REASON),
                PrivilegedActionBlockedException.class);

        assertThat(ex).isNotNull();
        assertThat(ex.getMessage()).contains("quản trị viên nền tảng");
        assertThat(ex.getAuditEvent()).isEqualTo("admin.org.admin_membership.blocked");
        assertThat(ex.getTargetType()).isEqualTo("ORG");
        assertThat(ex.getTargetId()).isEqualTo(String.valueOf(ORG_ID));
        assertThat(ex.getAuditMeta())
                .containsEntry("reason", "platform_admin")
                .containsEntry("targetUserId", NEW_OWNER_ID)
                .containsEntry("requestedRole", "OWNER");
        assertNothingHappened();
    }

    @Test
    @DisplayName("lõi từ chối (học viên / không phải thành viên) → 400 lan ra ngoài nguyên vẹn")
    void forceOwner_coreRejects_propagates() {
        when(organizationRepository.findById(ORG_ID)).thenReturn(Optional.of(org()));
        when(userRepository.findById(NEW_OWNER_ID)).thenReturn(Optional.of(userWithRole(User.Role.STUDENT)));
        when(orgMembershipService.forceOwnership(ADMIN, ORG_ID, NEW_OWNER_ID, REASON))
                .thenThrow(new BadRequestException("Chỉ chỉ định được quản lý hoặc giáo viên làm giám đốc"));

        assertThatThrownBy(() -> service.forceOwner(ADMIN, ORG_ID, NEW_OWNER_ID, REASON))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("quản lý hoặc giáo viên");
    }
}
