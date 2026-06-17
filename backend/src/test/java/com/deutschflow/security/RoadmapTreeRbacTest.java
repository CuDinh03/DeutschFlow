package com.deutschflow.security;

import com.deutschflow.testsupport.AbstractPostgresIntegrationTest;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Contract for the learning-tree endpoints ({@code GET /api/roadmap/tree} and friends, added for the
 * v2 student-roadmap screen). The tree is per-learner, so the security boundary is asserted through
 * the real Spring Security filter chain (same plain full-context setup as {@link AdminAuditRbacTest} —
 * no mocked-away security beans):
 *
 * <ul>
 *   <li>authenticated learner → 200 with a usable tree (user header + path).</li>
 *   <li>anonymous → 401 on read and on the completion write.</li>
 * </ul>
 *
 * Self-skips when no Postgres is available — see {@link AbstractPostgresIntegrationTest}.
 */
@SpringBootTest
@AutoConfigureMockMvc
@DisplayName("learning-tree RBAC contract")
class RoadmapTreeRbacTest extends AbstractPostgresIntegrationTest {

    private static final String EMAIL = "tree-rbac@local.test";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private UserRepository userRepository;

    private User learner;

    @BeforeEach
    void seedLearner() {
        learner = userRepository.findByEmail(EMAIL).orElseGet(() -> userRepository.save(User.builder()
                .email(EMAIL)
                .passwordHash("x")
                .displayName("Tree RBAC")
                .role(User.Role.STUDENT)
                .build()));
    }

    @Test
    @DisplayName("authenticated learner gets 200 with a tree (user header + path)")
    void authenticatedGetsTree() throws Exception {
        mockMvc.perform(get("/api/roadmap/tree").with(user(learner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.user.id").value("u_" + learner.getId()))
                .andExpect(jsonPath("$.user.currentLevel").value("A0"))
                .andExpect(jsonPath("$.path").isArray())
                .andExpect(jsonPath("$.path[0].level").value("A0"));
    }

    @Test
    @DisplayName("anonymous is rejected (401) on GET /api/roadmap/tree")
    void anonymousRejectedOnGet() throws Exception {
        mockMvc.perform(get("/api/roadmap/tree")).andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("anonymous is rejected (401) on POST /api/roadmap/tree/node/{id}/complete")
    void anonymousRejectedOnComplete() throws Exception {
        mockMvc.perform(post("/api/roadmap/tree/node/a1_h_greetings_1/complete"))
                .andExpect(status().isUnauthorized());
    }
}
