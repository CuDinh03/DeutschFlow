package com.deutschflow.notification;

import com.deutschflow.common.security.JwtService;
import com.deutschflow.testsupport.AbstractPostgresIntegrationTest;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Map;
import java.util.UUID;

import static org.hamcrest.Matchers.greaterThanOrEqualTo;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class UserNotificationIntegrationTest extends AbstractPostgresIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private JwtService jwtService;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void register_creates_unread_for_each_active_admin() throws Exception {
        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "email", "notif-" + UUID.randomUUID() + "@example.com",
                                "password", "secret12",
                                "displayName", "New Learner"
                        ))))
                .andExpect(status().isCreated());

        User admin = userRepository.findByEmail("admin@deutschflow.com").orElseThrow();
        String bearer = jwtService.generateAccessToken(admin);

        mockMvc.perform(get("/api/notifications/unread-count")
                        .header("Authorization", "Bearer " + bearer))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.unreadCount", greaterThanOrEqualTo(1)));
    }

    @Test
    void admin_patch_plan_notifies_learner_and_admins() throws Exception {
        User student = userRepository.findByEmail("student@deutschflow.com").orElseThrow();
        User admin = userRepository.findByEmail("admin@deutschflow.com").orElseThrow();
        String adminBearer = jwtService.generateAccessToken(admin);

        mockMvc.perform(patch("/api/admin/users/{id}/plan", student.getId())
                        .header("Authorization", "Bearer " + adminBearer)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("planCode", "PRO"))))
                .andExpect(status().isOk());

        String studentBearer = jwtService.generateAccessToken(student);
        mockMvc.perform(get("/api/notifications").param("unreadOnly", "true")
                        .header("Authorization", "Bearer " + studentBearer))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].type").value("LEARNER_PLAN_UPDATED"));

        mockMvc.perform(get("/api/notifications").param("unreadOnly", "true")
                        .header("Authorization", "Bearer " + adminBearer))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].type").value("ADMIN_LEARNER_PLAN_CHANGED"));
    }
}
