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

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * G-1: locks role-gating of the 1:1 booking endpoint through the REAL Spring Security filter
 * chain (mirrors {@link MockExamPackRbacTest}). {@code POST /api/teacher-sessions} is gated
 * {@code hasRole('STUDENT')} — the 1:1 marketplace is a B2C product, so every non-STUDENT staff
 * role is forbidden at the method-security gate and an anonymous caller is rejected at the entry
 * point. The org-teacher-hidden (404) and happy-path behaviour are unit-tested in
 * {@code TeacherSessionServiceTest} (no DB). Self-skips when no Postgres is available —
 * see {@link AbstractPostgresIntegrationTest}.
 */
@SpringBootTest
@AutoConfigureMockMvc
@DisplayName("G-1 1:1 booking RBAC contract")
class TeacherSessionBookingRbacTest extends AbstractPostgresIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    /** Syntactically valid body so @Valid arg-resolution passes and the @PreAuthorize gate is the decider. */
    private static final String BODY = """
            {"teacherProfileId":1,"title":"Ôn B1","scheduledAt":"2030-01-01T10:00:00","durationMinutes":60}
            """;

    @Test
    @WithMockUser(roles = "TEACHER")
    @DisplayName("TEACHER is forbidden (403) on POST /api/teacher-sessions")
    void teacherForbidden() throws Exception {
        mockMvc.perform(post("/api/teacher-sessions").contentType(MediaType.APPLICATION_JSON).content(BODY))
                .andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(roles = "MANAGER")
    @DisplayName("MANAGER is forbidden (403) on POST /api/teacher-sessions")
    void managerForbidden() throws Exception {
        mockMvc.perform(post("/api/teacher-sessions").contentType(MediaType.APPLICATION_JSON).content(BODY))
                .andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(roles = "OWNER")
    @DisplayName("OWNER is forbidden (403) on POST /api/teacher-sessions")
    void ownerForbidden() throws Exception {
        mockMvc.perform(post("/api/teacher-sessions").contentType(MediaType.APPLICATION_JSON).content(BODY))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Unauthenticated is rejected (401) on POST /api/teacher-sessions")
    void unauthenticatedRejected() throws Exception {
        mockMvc.perform(post("/api/teacher-sessions").contentType(MediaType.APPLICATION_JSON).content(BODY))
                .andExpect(status().isUnauthorized());
    }
}
