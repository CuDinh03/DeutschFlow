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
 * Locks role-gating of the D3 mock-exam-pack and D6² teacher free-tier endpoints through the REAL
 * Spring Security filter chain — no mocked-away security/media test beans, so
 * the real {@code JwtAuthFilter} + entry-point/access-denied handlers are exercised (mirrors
 * {@link TeacherCenterClusterRbacTest}). Wrong-role → 403 (method security on an authenticated
 * principal); missing auth → 401 (anonymous hits the authentication entry point). Self-skips when no
 * Postgres is available — see {@link AbstractPostgresIntegrationTest}.
 *
 * <ul>
 *   <li>{@code TeacherFreeTierController} — {@code hasRole('TEACHER')}: STUDENT is forbidden on
 *       GET {@code /api/v2/teacher/free-tier-status}.</li>
 *   <li>{@code AdminMockExamPackController} — {@code hasRole('ADMIN')}: TEACHER is forbidden on
 *       GET {@code /api/admin/mock-exam-packs}.</li>
 *   <li>{@code MockExamPackController} — authenticated-only: an anonymous caller is rejected on
 *       GET {@code /api/mock-exams/packs/{id}}.</li>
 * </ul>
 */
@SpringBootTest
@AutoConfigureMockMvc
@DisplayName("D3/D6² mock-exam-pack + free-tier RBAC contract")
class MockExamPackRbacTest extends AbstractPostgresIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    // ---------------------------------------------- TeacherFreeTierController (hasRole TEACHER)

    @Test
    @WithMockUser(roles = "STUDENT")
    @DisplayName("STUDENT is forbidden (403) on GET /api/v2/teacher/free-tier-status")
    void studentForbiddenOnFreeTierStatus() throws Exception {
        mockMvc.perform(get("/api/v2/teacher/free-tier-status"))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Unauthenticated is rejected (401) on /api/v2/teacher/free-tier-status")
    void unauthenticatedRejectedOnFreeTierStatus() throws Exception {
        mockMvc.perform(get("/api/v2/teacher/free-tier-status"))
                .andExpect(status().isUnauthorized());
    }

    // ---------------------------------------------- AdminMockExamPackController (hasRole ADMIN)

    @Test
    @WithMockUser(roles = "TEACHER")
    @DisplayName("TEACHER is forbidden (403) on GET /api/admin/mock-exam-packs")
    void teacherForbiddenOnAdminMockExamPacks() throws Exception {
        mockMvc.perform(get("/api/admin/mock-exam-packs"))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Unauthenticated is rejected (401) on /api/admin/mock-exam-packs")
    void unauthenticatedRejectedOnAdminMockExamPacks() throws Exception {
        mockMvc.perform(get("/api/admin/mock-exam-packs"))
                .andExpect(status().isUnauthorized());
    }

    // ---------------------------------------------- MockExamPackController (authenticated-only)

    @Test
    @DisplayName("Unauthenticated is rejected (401) on GET /api/mock-exams/packs/{id}")
    void unauthenticatedRejectedOnPackDetail() throws Exception {
        mockMvc.perform(get("/api/mock-exams/packs/1"))
                .andExpect(status().isUnauthorized());
    }
}
