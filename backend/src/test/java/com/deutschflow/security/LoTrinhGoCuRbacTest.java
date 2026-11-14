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
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Đường cũ đã gỡ ở đợt 1 thiết kế lại lộ trình (14/11/2026): cây manifest ({@code /api/roadmap/tree},
 * ROUTE-05) và nhánh phụ do AI sinh ({@code /unlock}, {@code /generate-satellite}, ROUTE-06).
 *
 * <ul>
 *   <li>học viên đã đăng nhập nhận 410 kèm mã ổn định, không 5xx (AC-ROUTE-06, AC-ROUTE-07);</li>
 *   <li>người chưa đăng nhập vẫn bị chặn 401 như trước.</li>
 * </ul>
 *
 * Tự bỏ qua khi không có Postgres — xem {@link AbstractPostgresIntegrationTest}.
 */
@SpringBootTest
@AutoConfigureMockMvc
@DisplayName("đường lộ trình cũ đã gỡ")
class LoTrinhGoCuRbacTest extends AbstractPostgresIntegrationTest {

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
    @DisplayName("GET /api/roadmap/tree trả 410 ROADMAP_TREE_RETIRED")
    void manifestTreeRetired() throws Exception {
        mockMvc.perform(get("/api/roadmap/tree").with(user(learner)))
                .andExpect(status().isGone())
                .andExpect(jsonPath("$.code").value("ROADMAP_TREE_RETIRED"));
    }

    @Test
    @DisplayName("POST /api/roadmap/tree/node/{id}/complete trả 410, không ghi gì")
    void manifestTreeWriteRetired() throws Exception {
        mockMvc.perform(post("/api/roadmap/tree/node/a1_h_greetings_1/complete").with(user(learner)).with(csrf()))
                .andExpect(status().isGone())
                .andExpect(jsonPath("$.code").value("ROADMAP_TREE_RETIRED"));
    }

    @Test
    @DisplayName("người chưa đăng nhập vẫn bị chặn 401 ở /api/roadmap/tree")
    void anonymousRejected() throws Exception {
        mockMvc.perform(get("/api/roadmap/tree")).andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("nhánh phụ AI: /unlock và /generate-satellite trả 410 SATELLITE_RETIRED")
    void satelliteRetired() throws Exception {
        mockMvc.perform(post("/api/skill-tree/1/unlock").with(user(learner)).with(csrf()))
                .andExpect(status().isGone())
                .andExpect(jsonPath("$.code").value("SATELLITE_RETIRED"));
        mockMvc.perform(post("/api/skill-tree/node/1/generate-satellite").with(user(learner)).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"hobby\":\"Kochen\"}"))
                .andExpect(status().isGone())
                .andExpect(jsonPath("$.code").value("SATELLITE_RETIRED"));
    }
}
