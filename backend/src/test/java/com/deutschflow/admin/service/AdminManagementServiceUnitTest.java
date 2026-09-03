package com.deutschflow.admin.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import org.springframework.jdbc.core.JdbcTemplate;
import com.deutschflow.user.repository.UserRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.deutschflow.common.telemetry.ApiTelemetryService;
import com.deutschflow.vocabulary.service.WordQueryService;
import com.deutschflow.user.service.PersonalizationRulesetService;
import com.deutschflow.common.quota.QuotaService;
import com.deutschflow.vocabulary.service.TranslationUsageMeter;
import com.deutschflow.vocabulary.service.EnrichmentSuspendGate;
import com.deutschflow.common.config.VocabularyEnrichmentProperties;
import com.deutschflow.user.entity.User;
import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.common.exception.ConflictException;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AdminManagementServiceUnitTest {
    @Mock org.springframework.jdbc.core.JdbcTemplate jdbcTemplate;
    @Mock DemoDataFilter demoDataFilter;
    @Mock com.deutschflow.user.repository.UserRepository userRepository;
    @Mock com.fasterxml.jackson.databind.ObjectMapper objectMapper;
    @Mock com.deutschflow.common.telemetry.ApiTelemetryService apiTelemetryService;
    @Mock com.deutschflow.vocabulary.service.WordQueryService wordQueryService;
    @Mock com.deutschflow.user.service.PersonalizationRulesetService personalizationRulesetService;
    @Mock com.deutschflow.common.quota.QuotaService quotaService;
    @Mock com.deutschflow.vocabulary.service.TranslationUsageMeter translationUsageMeter;
    @Mock com.deutschflow.vocabulary.service.EnrichmentSuspendGate enrichmentSuspendGate;
    @Mock com.deutschflow.common.config.VocabularyEnrichmentProperties vocabularyEnrichmentProperties;
    @Mock org.springframework.security.crypto.password.PasswordEncoder passwordEncoder;
    @Mock com.deutschflow.organization.service.OrgMembershipService orgMembershipService;
    @Mock com.deutschflow.organization.repository.OrganizationRepository organizationRepository;
    @Mock com.deutschflow.user.repository.RefreshTokenRepository refreshTokenRepository;

    @InjectMocks
    AdminManagementService service;

    @org.junit.jupiter.api.BeforeEach
    void armDemoFilter() {
        // Pre-arm the demo-exclusion clause so COGS tests added to this class later don't NPE on
        // "...%s...".formatted(null). lenient() because the construction smoke test doesn't call it.
        org.mockito.Mockito.lenient().when(demoDataFilter.andExcludeDemo()).thenReturn("");
    }

    @Test
    void serviceConstructedWithMocks() {
        assertNotNull(service);
    }

    // ── createUser / setUserActive (admin account provisioning) ──────────────────

    @Test
    void createUser_student_happyPath_noOrg() {
        when(userRepository.existsByEmailIgnoreCase("new@x.com")).thenReturn(false);
        when(passwordEncoder.encode("secret123")).thenReturn("HASH");
        when(userRepository.save(any(User.class))).thenAnswer(inv -> {
            User u = inv.getArgument(0);
            u.setId(42L);
            return u;
        });

        var out = service.createUser("  New@X.com ", "New User", "secret123", "student", "vi", null, null);

        assertEquals(42L, out.get("id"));
        assertEquals("new@x.com", out.get("email"));   // normalized (trim + lowercase)
        assertEquals("STUDENT", out.get("role"));
        assertEquals(true, out.get("isActive"));
        assertNull(out.get("orgId"));
        verify(orgMembershipService, never()).upsertMember(anyLong(), anyLong(), anyString());
    }

    @Test
    void createUser_duplicateEmail_throwsConflict() {
        when(userRepository.existsByEmailIgnoreCase("dup@x.com")).thenReturn(true);
        assertThrows(ConflictException.class, () ->
                service.createUser("dup@x.com", "Dup", "secret123", "STUDENT", "vi", null, null));
    }

    @Test
    void createUser_invalidRole_throwsBadRequest() {
        assertThrows(BadRequestException.class, () ->
                service.createUser("a@x.com", "A", "secret123", "SUPERUSER", "vi", null, null));
    }

    @Test
    void createUser_shortPassword_throwsBadRequest() {
        assertThrows(BadRequestException.class, () ->
                service.createUser("a@x.com", "A", "123", "STUDENT", "vi", null, null));
    }

    @Test
    void createUser_manager_assignsOrgMembership() {
        when(userRepository.existsByEmailIgnoreCase("m@x.com")).thenReturn(false);
        when(passwordEncoder.encode(anyString())).thenReturn("HASH");
        when(organizationRepository.existsById(7L)).thenReturn(true);
        when(userRepository.save(any(User.class))).thenAnswer(inv -> {
            User u = inv.getArgument(0);
            u.setId(50L);
            return u;
        });

        var out = service.createUser("m@x.com", "Mgr", "secret123", "MANAGER", "vi", 7L, null);

        assertEquals("MANAGER", out.get("role"));
        assertEquals("MANAGER", out.get("orgRole"));
        assertEquals(7L, out.get("orgId"));
        verify(orgMembershipService).upsertMember(7L, 50L, "MANAGER");
    }

    @Test
    void createUser_managerWithoutOrg_throwsBadRequest() {
        when(userRepository.existsByEmailIgnoreCase("m@x.com")).thenReturn(false);
        // A MANAGER is a first-class org-admin platform role → it must belong to an organization.
        assertThrows(BadRequestException.class, () ->
                service.createUser("m@x.com", "M", "secret123", "MANAGER", "vi", null, null));
    }

    @Test
    void setUserActive_locksAccount() {
        User u = User.builder().id(9L).email("u@x.com").displayName("U")
                .role(User.Role.TEACHER).active(true).build();
        when(userRepository.findById(9L)).thenReturn(Optional.of(u));
        when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));

        var out = service.setUserActive(9L, false);

        assertEquals(9L, out.get("id"));
        assertEquals(false, out.get("isActive"));
    }

    @Test
    void setUserActive_unlocksAccount_reversible() {
        User u = User.builder().id(9L).email("u@x.com").displayName("U")
                .role(User.Role.TEACHER).active(false).build();
        when(userRepository.findById(9L)).thenReturn(Optional.of(u));
        when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));

        var out = service.setUserActive(9L, true);

        assertEquals(true, out.get("isActive")); // lock có thể mở lại — reversible
    }

    // ── F-M1: hệ thống luôn phải còn ít nhất một ADMIN hoạt động ────────────────────
    //
    // Controller đã chặn admin TỰ hạ quyền / tự khóa mình, nhưng hai admin vẫn tước quyền hoặc khóa
    // LẪN NHAU được → 0 admin, khoá cứng toàn hệ thống, chỉ gỡ được bằng cách sửa thẳng DB. Guard
    // nằm ở service nên mọi đường ghi đều qua, kể cả endpoint thêm sau này quên tự rào.

    @Test
    void updateUserRole_demotingLastActiveAdmin_isBlocked() {
        User lastAdmin = User.builder().id(20L).email("a@x.com").displayName("A")
                .role(User.Role.ADMIN).active(true).build();
        when(userRepository.findById(20L)).thenReturn(Optional.of(lastAdmin));
        when(orgMembershipService.hasActiveMembership(20L)).thenReturn(false);
        // R-M2: guard nay đếm DƯỚI khóa FOR UPDATE — chỉ còn 1 admin hoạt động → chặn.
        when(userRepository.lockActiveIdsByRoleForUpdate("ADMIN")).thenReturn(List.of(20L));

        assertThrows(BadRequestException.class, () -> service.updateUserRole(20L, "STUDENT"));

        assertEquals(User.Role.ADMIN, lastAdmin.getRole());   // không đổi
        verify(userRepository, never()).save(any(User.class));
        // R-M2: bất biến phải đếm DƯỚI khóa FOR UPDATE, không đọc trần → chống race.
        verify(userRepository).lockActiveIdsByRoleForUpdate("ADMIN");
    }

    @Test
    void updateUserRole_demotingAdminWhenAnotherExists_isAllowed() {
        User admin = User.builder().id(21L).email("a2@x.com").displayName("A2")
                .role(User.Role.ADMIN).active(true).build();
        when(userRepository.findById(21L)).thenReturn(Optional.of(admin));
        when(orgMembershipService.hasActiveMembership(21L)).thenReturn(false);
        // Có admin thứ hai (21L + 99L) → bất biến không chặn.
        when(userRepository.lockActiveIdsByRoleForUpdate("ADMIN")).thenReturn(List.of(21L, 99L));
        when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));

        service.updateUserRole(21L, "STUDENT");

        assertEquals(User.Role.STUDENT, admin.getRole());
    }

    @Test
    void setUserActive_lockingLastActiveAdmin_isBlocked() {
        User lastAdmin = User.builder().id(22L).email("a3@x.com").displayName("A3")
                .role(User.Role.ADMIN).active(true).build();
        when(userRepository.findById(22L)).thenReturn(Optional.of(lastAdmin));
        when(userRepository.lockActiveIdsByRoleForUpdate("ADMIN")).thenReturn(List.of(22L));

        assertThrows(BadRequestException.class, () -> service.setUserActive(22L, false));

        assertEquals(true, lastAdmin.isActive());
        verify(refreshTokenRepository, never()).revokeAllByUserId(anyLong());
    }

    @Test
    void setUserActive_lockingAdminWhenAnotherExists_isAllowed() {
        User admin = User.builder().id(23L).email("a4@x.com").displayName("A4")
                .role(User.Role.ADMIN).active(true).build();
        when(userRepository.findById(23L)).thenReturn(Optional.of(admin));
        when(userRepository.lockActiveIdsByRoleForUpdate("ADMIN")).thenReturn(List.of(23L, 99L));
        when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));

        var out = service.setUserActive(23L, false);

        assertEquals(false, out.get("isActive"));
    }

    @Test
    void setUserActive_lockingNonAdmin_neverCountsAdmins() {
        User teacher = User.builder().id(24L).email("t@x.com").displayName("T")
                .role(User.Role.TEACHER).active(true).build();
        when(userRepository.findById(24L)).thenReturn(Optional.of(teacher));
        when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));

        service.setUserActive(24L, false);

        // Khóa một TEACHER không được tốn thêm một truy vấn khóa admin trên bảng users.
        verify(userRepository, never()).lockActiveIdsByRoleForUpdate(anyString());
    }

    @Test
    void promotingToAdmin_isNeverBlockedByTheInvariant() {
        User student = User.builder().id(25L).email("s@x.com").displayName("S")
                .role(User.Role.STUDENT).active(true).build();
        when(userRepository.findById(25L)).thenReturn(Optional.of(student));
        when(orgMembershipService.hasActiveMembership(25L)).thenReturn(false);
        when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));

        service.updateUserRole(25L, "ADMIN");

        assertEquals(User.Role.ADMIN, student.getRole());
        verify(userRepository, never()).lockActiveIdsByRoleForUpdate(anyString());
    }

    // ── F-H3: thao tác đặc quyền của admin phải cắt phiên đang chạy của target ──────

    @Test
    void setUserActive_lock_revokesTargetSessions() {
        User u = User.builder().id(9L).email("u@x.com").displayName("U")
                .role(User.Role.TEACHER).active(true).build();
        when(userRepository.findById(9L)).thenReturn(Optional.of(u));
        when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));

        service.setUserActive(9L, false);

        // Không revoke thì access token đang cầm vẫn sống tới khi hết hạn và refresh token còn 7 ngày.
        verify(refreshTokenRepository).revokeAllByUserId(9L);
    }

    @Test
    void setUserActive_unlock_doesNotRevokeSessions() {
        User u = User.builder().id(9L).email("u@x.com").displayName("U")
                .role(User.Role.TEACHER).active(false).build();
        when(userRepository.findById(9L)).thenReturn(Optional.of(u));
        when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));

        service.setUserActive(9L, true);

        // Mở khóa không phải sự kiện bảo mật — không đá phiên nào cả.
        verify(refreshTokenRepository, never()).revokeAllByUserId(anyLong());
    }

    @Test
    void updateUserRole_revokesTargetSessions() {
        User u = User.builder().id(11L).email("r@x.com").displayName("R")
                .role(User.Role.ADMIN).active(true).build();
        when(userRepository.findById(11L)).thenReturn(Optional.of(u));
        when(orgMembershipService.hasActiveMembership(11L)).thenReturn(false);
        // Có admin khác → bất biến last-admin (F-M1/R-M2) không chặn; ca này chỉ nói về revoke session.
        when(userRepository.lockActiveIdsByRoleForUpdate("ADMIN")).thenReturn(List.of(11L, 99L));
        when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));

        var out = service.updateUserRole(11L, "student");

        assertEquals(User.Role.STUDENT, u.getRole());
        // F-M4: vết role.updated phải nói được đổi TỪ đâu, không chỉ vai trò mới.
        assertEquals("ADMIN", out.get("previousRole"));
        // Access token cũ mang authorities vai trò CŨ; JwtAuthFilter còn cache UserDetails 60s.
        verify(refreshTokenRepository).revokeAllByUserId(11L);
    }

    @Test
    void setUserPassword_revokesTargetSessions() {
        User u = User.builder().id(12L).email("p@x.com").displayName("P")
                .role(User.Role.STUDENT).active(true).build();
        when(userRepository.findById(12L)).thenReturn(Optional.of(u));
        when(passwordEncoder.encode("newsecret123")).thenReturn("HASH2");
        when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));

        service.setUserPassword(12L, "newsecret123");

        assertEquals("HASH2", u.getPasswordHash());
        // Self-service đổi mật khẩu và OTP quên-mật-khẩu đều revoke; đường admin phải khớp.
        verify(refreshTokenRepository).revokeAllByUserId(12L);
    }

    @Test
    void createUser_setsCreatedVia_ADMIN() {
        when(userRepository.existsByEmailIgnoreCase("cv@x.com")).thenReturn(false);
        when(passwordEncoder.encode(anyString())).thenReturn("HASH");
        org.mockito.ArgumentCaptor<User> cap = org.mockito.ArgumentCaptor.forClass(User.class);
        when(userRepository.save(any(User.class))).thenAnswer(inv -> {
            User u = inv.getArgument(0);
            u.setId(1L);
            return u;
        });

        service.createUser("cv@x.com", "CV", "secret123", "STUDENT", "vi", null, null);

        verify(userRepository).save(cap.capture());
        assertEquals(User.CreatedVia.ADMIN, cap.getValue().getCreatedVia());
    }

    @Test
    void setUserPassword_encodesAndSaves() {
        User u = User.builder().id(5L).email("u@x.com").displayName("U")
                .role(User.Role.TEACHER).passwordHash("OLD").build();
        when(userRepository.findById(5L)).thenReturn(Optional.of(u));
        when(passwordEncoder.encode("newsecret8")).thenReturn("NEWHASH");
        when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));

        service.setUserPassword(5L, "newsecret8");

        assertEquals("NEWHASH", u.getPasswordHash()); // mã hoá + lưu
    }

    @Test
    void setUserPassword_tooShort_throwsBadRequest() {
        assertThrows(BadRequestException.class, () -> service.setUserPassword(5L, "short")); // < 8 ký tự
    }
}
