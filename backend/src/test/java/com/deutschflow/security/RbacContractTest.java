package com.deutschflow.security;

import com.deutschflow.testsupport.AbstractPostgresIntegrationTest;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Locks the role-gating of the admin-reports + actuator surface against regression through the REAL
 * Spring Security filter chain — the plain full-context setup of {@code OrgContextLoadIntegrationTest}
 * (mirrors {@link TeacherCenterClusterRbacTest} / {@link MockExamPackRbacTest}), so the real
 * {@code JwtAuthFilter} + {@code authenticationEntryPoint}/{@code accessDeniedHandler} are exercised
 * rather than mocked away.
 *
 * <ul>
 *   <li>{@link com.deutschflow.admin.controller.AdminManagementController} — {@code hasRole('ADMIN')}:
 *       GET {@code /api/admin/reports/student-plan-progress} rejects an anonymous caller (401) and a
 *       STUDENT (403).</li>
 *   <li>{@code /actuator/info} — {@code hasRole('ADMIN')} at the URL level: a STUDENT is forbidden (403).</li>
 * </ul>
 *
 * <p>Wrong-role denials come from an authenticated principal failing the role check → 403; missing-auth
 * denials are anonymous and hit the authentication entry point → 401. Self-skips when no Postgres is
 * available — see {@link AbstractPostgresIntegrationTest}.
 */
@SpringBootTest
@AutoConfigureMockMvc
@DisplayName("Admin reports + actuator RBAC contract")
class RbacContractTest extends AbstractPostgresIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    @DisplayName("Unauthenticated is rejected (401) on the admin student-plan-progress report")
    void adminReportShouldRequireAuthentication() throws Exception {
        mockMvc.perform(get("/api/admin/reports/student-plan-progress"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @WithMockUser(roles = "STUDENT")
    @DisplayName("STUDENT is forbidden (403) on the admin student-plan-progress report")
    void adminReportShouldRejectStudentRole() throws Exception {
        mockMvc.perform(get("/api/admin/reports/student-plan-progress"))
                .andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(roles = "STUDENT")
    @DisplayName("STUDENT is forbidden (403) on /actuator/info")
    void actuatorInfoRequiresAdmin() throws Exception {
        mockMvc.perform(get("/actuator/info"))
                .andExpect(status().isForbidden());
    }
}
