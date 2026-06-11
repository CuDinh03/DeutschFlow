package com.deutschflow.security;

import com.deutschflow.testsupport.AbstractPostgresIntegrationTest;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Locks the role-gating of the D11 teacher-center / cluster endpoints against regression. The
 * sensitive surface is teacher contact-email aggregation in the cluster endpoint, so the deny paths
 * are asserted through the real Spring Security filter chain (real {@code JwtAuthFilter}, real
 * {@code authenticationEntryPoint}/{@code accessDeniedHandler}).
 *
 * <ul>
 *   <li>{@link com.deutschflow.teacher.controller.TeacherCenterController} — {@code hasRole('TEACHER')}:
 *       a STUDENT is forbidden (403) on GET and PUT {@code /api/v2/teacher/center}.</li>
 *   <li>{@link com.deutschflow.marketing.controller.AdminMarketingLeadController} — {@code hasRole('ADMIN')}:
 *       a TEACHER is forbidden (403) on GET {@code /api/admin/marketing/teacher-clusters}.</li>
 *   <li>An unauthenticated caller is rejected (401) on both.</li>
 * </ul>
 *
 * <p>Wrong-role denials come from method security on an authenticated principal → 403; missing-auth
 * denials are anonymous and hit the authentication entry point → 401 (the
 * {@link com.deutschflow.common.exception.GlobalExceptionHandler} re-throws security exceptions so
 * Spring Security's translation filter, not a generic 500 handler, decides the status).
 *
 * <p>Uses the plain full-context setup of {@code OrgContextLoadIntegrationTest} (no
 * mocked-away security/media test beans) so the real security beans are exercised.
 * Self-skips when no Postgres is available — see {@link AbstractPostgresIntegrationTest}.
 */
@SpringBootTest
@AutoConfigureMockMvc
@DisplayName("D11 teacher-center / cluster RBAC contract")
class TeacherCenterClusterRbacTest extends AbstractPostgresIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    // ---------------------------------------------- TeacherCenterController (hasRole TEACHER)

    @Test
    @WithMockUser(roles = "STUDENT")
    @DisplayName("STUDENT is forbidden on GET /api/v2/teacher/center")
    void studentForbiddenOnGetTeacherCenter() throws Exception {
        mockMvc.perform(get("/api/v2/teacher/center"))
                .andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(roles = "STUDENT")
    @DisplayName("STUDENT is forbidden on PUT /api/v2/teacher/center")
    void studentForbiddenOnPutTeacherCenter() throws Exception {
        mockMvc.perform(put("/api/v2/teacher/center")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"centerName\":\"Goethe Hanoi\"}"))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Unauthenticated is rejected (401) on /api/v2/teacher/center")
    void unauthenticatedRejectedOnTeacherCenter() throws Exception {
        mockMvc.perform(get("/api/v2/teacher/center"))
                .andExpect(status().isUnauthorized());
    }

    // ---------------------------------------- AdminMarketingLeadController (hasRole ADMIN)

    @Test
    @WithMockUser(roles = "TEACHER")
    @DisplayName("TEACHER is forbidden on GET /api/admin/marketing/teacher-clusters")
    void teacherForbiddenOnTeacherClusters() throws Exception {
        mockMvc.perform(get("/api/admin/marketing/teacher-clusters"))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Unauthenticated is rejected (401) on /api/admin/marketing/teacher-clusters")
    void unauthenticatedRejectedOnTeacherClusters() throws Exception {
        mockMvc.perform(get("/api/admin/marketing/teacher-clusters"))
                .andExpect(status().isUnauthorized());
    }
}
