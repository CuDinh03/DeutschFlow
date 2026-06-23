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
