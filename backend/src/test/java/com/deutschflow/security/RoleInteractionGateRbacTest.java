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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Role-interaction audit — locks the method-security gates of three endpoints through the REAL
 * Spring Security filter chain (mirrors {@link MockExamPackRbacTest}; self-skips without Postgres).
 *
 * <ul>
 *   <li><b>G-2</b> {@code POST /api/classes/join} — gated {@code hasRole('STUDENT')}: joining a class
 *       is a learner action, so TEACHER/MANAGER/OWNER/ADMIN are forbidden (the legacy endpoint used to
 *       have no gate at all).</li>
 *   <li><b>L4</b> {@code /api/v2/teacher/certificates/**} — gated {@code hasRole('TEACHER')}:
 *       MANAGER/OWNER/STUDENT are forbidden. The public verify endpoint stays reachable.</li>
 *   <li><b>F7</b> {@code /api/v2/teacher/materials/**} — gated {@code hasRole('TEACHER') or ADMIN}:
 *       STUDENT is forbidden.</li>
 * </ul>
 *
 * IDOR/ownership for these (cross-teacher jobs/certs) is unit-tested without a DB in
 * {@code TeacherMaterialControllerTest} / {@code OrgCertificateServiceTest}.
 */
@SpringBootTest
@AutoConfigureMockMvc
@DisplayName("Role-interaction audit RBAC gates — join (G-2) · certificates (L4) · materials (F7)")
class RoleInteractionGateRbacTest extends AbstractPostgresIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    private static final String JOB_PATH = "/api/v2/teacher/materials/jobs/11111111-1111-1111-1111-111111111111";

    // ── G-2: POST /api/classes/join is STUDENT-only ─────────────────────────────

    @Test
    @WithMockUser(roles = "TEACHER")
    @DisplayName("G-2: TEACHER is forbidden (403) on POST /api/classes/join")
    void g2_teacherForbidden() throws Exception {
        mockMvc.perform(post("/api/classes/join").contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(roles = "MANAGER")
    @DisplayName("G-2: MANAGER is forbidden (403) on POST /api/classes/join")
    void g2_managerForbidden() throws Exception {
        mockMvc.perform(post("/api/classes/join").contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    @DisplayName("G-2: ADMIN is forbidden (403) on POST /api/classes/join")
    void g2_adminForbidden() throws Exception {
        mockMvc.perform(post("/api/classes/join").contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("G-2: unauthenticated is rejected (401) on POST /api/classes/join")
    void g2_unauthenticatedRejected() throws Exception {
        mockMvc.perform(post("/api/classes/join").contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isUnauthorized());
    }

    // ── L4: /api/v2/teacher/certificates is TEACHER-only ────────────────────────

    @Test
    @WithMockUser(roles = "STUDENT")
    @DisplayName("L4: STUDENT is forbidden (403) on POST /api/v2/teacher/certificates")
    void l4_studentForbiddenOnIssue() throws Exception {
        mockMvc.perform(post("/api/v2/teacher/certificates").contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(roles = "MANAGER")
    @DisplayName("L4: MANAGER is forbidden (403) on GET /api/v2/teacher/certificates/class/{id}")
    void l4_managerForbiddenOnList() throws Exception {
        mockMvc.perform(get("/api/v2/teacher/certificates/class/1"))
                .andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(roles = "OWNER")
    @DisplayName("L4: OWNER is forbidden (403) on GET /api/v2/teacher/certificates/class/{id}")
    void l4_ownerForbiddenOnList() throws Exception {
        mockMvc.perform(get("/api/v2/teacher/certificates/class/1"))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("L4: unauthenticated is rejected (401) on /api/v2/teacher/certificates/**")
    void l4_unauthenticatedRejected() throws Exception {
        mockMvc.perform(get("/api/v2/teacher/certificates/class/1"))
                .andExpect(status().isUnauthorized());
    }

    // ── L5: public verify is reachable (permitAll); an unknown token → 404, not 401 ─

    @Test
    @DisplayName("L5: public verify with an unknown token → 404 (no enumeration leak, no auth wall)")
    void l5_publicVerifyUnknownToken404() throws Exception {
        mockMvc.perform(get("/api/public/certificate/this-token-does-not-exist"))
                .andExpect(status().isNotFound());
    }

    // ── F7: /api/v2/teacher/materials/** is TEACHER/ADMIN-only ──────────────────

    @Test
    @WithMockUser(roles = "STUDENT")
    @DisplayName("F7: STUDENT is forbidden (403) on GET /api/v2/teacher/materials/jobs/{jobId}")
    void f7_studentForbidden() throws Exception {
        mockMvc.perform(get(JOB_PATH))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("F7: unauthenticated is rejected (401) on /api/v2/teacher/materials/**")
    void f7_unauthenticatedRejected() throws Exception {
        mockMvc.perform(get(JOB_PATH))
                .andExpect(status().isUnauthorized());
    }
}
