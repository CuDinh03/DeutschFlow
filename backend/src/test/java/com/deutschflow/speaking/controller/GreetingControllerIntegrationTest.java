package com.deutschflow.speaking.controller;

import com.deutschflow.common.quota.QuotaVnCalendar;
import com.deutschflow.testsupport.AbstractPostgresIntegrationTest;
import com.deutschflow.speaking.dto.CreateGreetingSessionRequest;
import com.deutschflow.speaking.dto.SubmitResponseRequest;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import java.sql.Date;
import java.sql.Timestamp;
import java.time.Instant;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@DisplayName("GreetingController Integration Tests")
class GreetingControllerIntegrationTest extends AbstractPostgresIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private JdbcTemplate jdbc;

    private static final String EMAIL = "greeting-it-quota@test.com";

    private CreateGreetingSessionRequest validSessionRequest;
    private SubmitResponseRequest validResponseRequest;

    /**
     * A user funded well enough to clear {@code QuotaService.assertAllowed}. The POST endpoints gate on
     * quota BEFORE they look the template/session up, so a principal with an empty wallet gets 429 and
     * never reaches the 404 these tests are about.
     */
    private long fundedUserId;

    @BeforeEach
    void setUp() {
        validSessionRequest = new CreateGreetingSessionRequest(1L, 2);
        validResponseRequest = new SubmitResponseRequest("Hallo!", 3);

        cleanupFundedUser();
        User u = userRepository.save(User.builder()
                .email(EMAIL)
                .passwordHash("$2a$10$h")
                .displayName("Greeting IT")
                .role(User.Role.STUDENT)
                .build());
        userRepository.flush();
        fundedUserId = u.getId();
        jdbc.update("""
                INSERT INTO user_subscriptions (user_id, plan_code, status, starts_at, ends_at)
                VALUES (?, 'PRO', 'ACTIVE', ?, NULL)
                """, fundedUserId, Timestamp.from(Instant.now().minusSeconds(600)));
        jdbc.update("""
                INSERT INTO user_ai_token_wallets (user_id, balance, last_accrual_local_date)
                VALUES (?, 400000, ?)
                """, fundedUserId, Date.valueOf(QuotaVnCalendar.localDateOf(Instant.now())));
    }

    @AfterEach
    void tearDown() {
        cleanupFundedUser();
    }

    private void cleanupFundedUser() {
        jdbc.update("DELETE FROM ai_token_usage_events WHERE user_id IN (SELECT id FROM users WHERE email = ?)", EMAIL);
        jdbc.update("DELETE FROM user_ai_token_wallets WHERE user_id IN (SELECT id FROM users WHERE email = ?)", EMAIL);
        jdbc.update("DELETE FROM user_subscriptions WHERE user_id IN (SELECT id FROM users WHERE email = ?)", EMAIL);
        jdbc.update("DELETE FROM users WHERE email = ?", EMAIL);
    }

    @Test
    @DisplayName("createGreetingSession returns 401 when unauthenticated")
    void createGreetingSession_unauthenticated_returns401() throws Exception {
        mockMvc.perform(post("/api/ai-speaking/greeting-session")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(validSessionRequest)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @WithMockUser(username = "1", roles = "STUDENT")
    @DisplayName("createGreetingSession returns 400 for invalid difficulty below 1")
    void createGreetingSession_difficultyBelowMin_returns400() throws Exception {
        CreateGreetingSessionRequest invalidRequest = new CreateGreetingSessionRequest(1L, 0);
        mockMvc.perform(post("/api/ai-speaking/greeting-session")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(invalidRequest)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.title").value("Validation Failed"));
    }

    @Test
    @WithMockUser(username = "1", roles = "STUDENT")
    @DisplayName("createGreetingSession returns 400 for invalid difficulty above 5")
    void createGreetingSession_difficultyAboveMax_returns400() throws Exception {
        CreateGreetingSessionRequest invalidRequest = new CreateGreetingSessionRequest(1L, 6);
        mockMvc.perform(post("/api/ai-speaking/greeting-session")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(invalidRequest)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.title").value("Validation Failed"));
    }

    @Test
    @WithMockUser(username = "1", roles = "STUDENT")
    @DisplayName("createGreetingSession returns 400 for null difficulty")
    void createGreetingSession_nullDifficulty_returns400() throws Exception {
        CreateGreetingSessionRequest invalidRequest = new CreateGreetingSessionRequest(1L, null);
        mockMvc.perform(post("/api/ai-speaking/greeting-session")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(invalidRequest)))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("createGreetingSession returns 404 for non-existent template")
    void createGreetingSession_templateNotFound_returns404() throws Exception {
        CreateGreetingSessionRequest requestWithInvalidTemplate = new CreateGreetingSessionRequest(999L, 2);
        mockMvc.perform(post("/api/ai-speaking/greeting-session")
                .with(user(String.valueOf(fundedUserId)).roles("STUDENT"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(requestWithInvalidTemplate)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.title").value("Not Found"));
    }

    @Test
    @DisplayName("submitResponse returns 401 when unauthenticated")
    void submitResponse_unauthenticated_returns401() throws Exception {
        mockMvc.perform(post("/api/ai-speaking/greeting-session/1/submit-response")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(validResponseRequest)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @WithMockUser(username = "1", roles = "STUDENT")
    @DisplayName("submitResponse returns 400 for blank user input")
    void submitResponse_blankUserInput_returns400() throws Exception {
        SubmitResponseRequest invalidRequest = new SubmitResponseRequest("   ", 3);
        mockMvc.perform(post("/api/ai-speaking/greeting-session/1/submit-response")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(invalidRequest)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.title").value("Validation Failed"));
    }

    @Test
    @WithMockUser(username = "1", roles = "STUDENT")
    @DisplayName("submitResponse returns 400 for null user input")
    void submitResponse_nullUserInput_returns400() throws Exception {
        SubmitResponseRequest invalidRequest = new SubmitResponseRequest(null, 3);
        mockMvc.perform(post("/api/ai-speaking/greeting-session/1/submit-response")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(invalidRequest)))
                .andExpect(status().isBadRequest());
    }

    @Test
    @WithMockUser(username = "1", roles = "STUDENT")
    @DisplayName("submitResponse returns 400 for confidence below 1")
    void submitResponse_confidenceBelowMin_returns400() throws Exception {
        SubmitResponseRequest invalidRequest = new SubmitResponseRequest("Hallo!", 0);
        mockMvc.perform(post("/api/ai-speaking/greeting-session/1/submit-response")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(invalidRequest)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.title").value("Validation Failed"));
    }

    @Test
    @WithMockUser(username = "1", roles = "STUDENT")
    @DisplayName("submitResponse returns 400 for confidence above 5")
    void submitResponse_confidenceAboveMax_returns400() throws Exception {
        SubmitResponseRequest invalidRequest = new SubmitResponseRequest("Hallo!", 6);
        mockMvc.perform(post("/api/ai-speaking/greeting-session/1/submit-response")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(invalidRequest)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.title").value("Validation Failed"));
    }

    @Test
    @DisplayName("submitResponse returns 404 for non-existent session")
    void submitResponse_sessionNotFound_returns404() throws Exception {
        mockMvc.perform(post("/api/ai-speaking/greeting-session/999/submit-response")
                .with(user(String.valueOf(fundedUserId)).roles("STUDENT"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(validResponseRequest)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.title").value("Not Found"));
    }

    @Test
    @DisplayName("getGreetingSession returns 401 when unauthenticated")
    void getGreetingSession_unauthenticated_returns401() throws Exception {
        mockMvc.perform(get("/api/ai-speaking/greeting-session/1"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @WithMockUser(username = "1", roles = "STUDENT")
    @DisplayName("getGreetingSession returns 404 for non-existent session")
    void getGreetingSession_sessionNotFound_returns404() throws Exception {
        mockMvc.perform(get("/api/ai-speaking/greeting-session/999"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.title").value("Not Found"));
    }
}
