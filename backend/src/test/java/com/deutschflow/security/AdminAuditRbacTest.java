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
 * Locks role-gating on the admin audit read endpoint ({@code GET /api/admin/audit}, added for the
 * v2 admin-audit screen). The endpoint exposes who-did-what across the platform, so the deny paths
 * are asserted through the real Spring Security filter chain (same plain full-context setup as
 * {@link TeacherCenterClusterRbacTest} — no mocked-away security beans).
 *
 * <ul>
 *   <li>ADMIN → 200 (allowed).</li>
 *   <li>STUDENT / TEACHER → 403 (authenticated, wrong role → method security).</li>
 *   <li>anonymous → 401 (authentication entry point).</li>
 * </ul>
 *
 * Self-skips when no Postgres is available — see {@link AbstractPostgresIntegrationTest}.
 */
@SpringBootTest
@AutoConfigureMockMvc
@DisplayName("admin-audit read RBAC contract")
class AdminAuditRbacTest extends AbstractPostgresIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    @WithMockUser(roles = "ADMIN")
    @DisplayName("ADMIN can read GET /api/admin/audit")
    void adminAllowed() throws Exception {
        mockMvc.perform(get("/api/admin/audit").param("size", "5"))
                .andExpect(status().isOk());
    }

    @Test
    @WithMockUser(roles = "STUDENT")
    @DisplayName("STUDENT is forbidden on GET /api/admin/audit")
    void studentForbidden() throws Exception {
        mockMvc.perform(get("/api/admin/audit")).andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(roles = "TEACHER")
    @DisplayName("TEACHER is forbidden on GET /api/admin/audit")
    void teacherForbidden() throws Exception {
        mockMvc.perform(get("/api/admin/audit")).andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("anonymous is rejected on GET /api/admin/audit")
    void anonymousRejected() throws Exception {
        mockMvc.perform(get("/api/admin/audit")).andExpect(status().isUnauthorized());
    }
}
