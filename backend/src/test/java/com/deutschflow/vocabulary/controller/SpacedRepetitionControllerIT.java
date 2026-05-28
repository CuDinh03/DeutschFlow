package com.deutschflow.vocabulary.controller;

import com.deutschflow.testsupport.AbstractPostgresIntegrationTest;
import com.deutschflow.vocabulary.dto.RecordReviewRequest;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@DisplayName("SpacedRepetitionController Integration Tests")
class SpacedRepetitionControllerIT extends AbstractPostgresIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    private RecordReviewRequest validRequest;

    @BeforeEach
    void setUp() {
        validRequest = new RecordReviewRequest(1L, 3);
    }

    @Test
    @DisplayName("recordReview returns 401 when unauthenticated")
    void recordReview_unauthenticated_returns401() throws Exception {
        mockMvc.perform(post("/api/vocabulary/srs/record-review")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(validRequest)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @WithMockUser(roles = "STUDENT")
    @DisplayName("recordReview returns 200 with valid request for authenticated user")
    void recordReview_validRequest_authenticated_returns200() throws Exception {
        mockMvc.perform(post("/api/vocabulary/srs/record-review")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(validRequest)))
                .andExpect(status().isOk());
    }

    @Test
    @WithMockUser(roles = "STUDENT")
    @DisplayName("recordReview returns 400 for confidence below minimum")
    void recordReview_confidenceBelowMin_returns400() throws Exception {
        RecordReviewRequest invalidRequest = new RecordReviewRequest(1L, 0);
        mockMvc.perform(post("/api/vocabulary/srs/record-review")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(invalidRequest)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.title").value("Bad Request"));
    }

    @Test
    @WithMockUser(roles = "STUDENT")
    @DisplayName("recordReview returns 400 for confidence above maximum")
    void recordReview_confidenceAboveMax_returns400() throws Exception {
        RecordReviewRequest invalidRequest = new RecordReviewRequest(1L, 6);
        mockMvc.perform(post("/api/vocabulary/srs/record-review")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(invalidRequest)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.title").value("Bad Request"));
    }

    @Test
    @WithMockUser(roles = "STUDENT")
    @DisplayName("recordReview returns 400 when wordId is null")
    void recordReview_nullWordId_returns400() throws Exception {
        RecordReviewRequest invalidRequest = new RecordReviewRequest(null, 3);
        mockMvc.perform(post("/api/vocabulary/srs/record-review")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(invalidRequest)))
                .andExpect(status().isBadRequest());
    }

    @Test
    @WithMockUser(roles = "STUDENT")
    @DisplayName("getLearningProgress returns 401 when unauthenticated")
    void getLearningProgress_unauthenticated_returns401() throws Exception {
        mockMvc.perform(get("/api/vocabulary/srs/progress"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @WithMockUser(roles = "STUDENT")
    @DisplayName("getLearningProgress returns 200 for authenticated user")
    void getLearningProgress_authenticated_returns200() throws Exception {
        mockMvc.perform(get("/api/vocabulary/srs/progress"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalWords").exists())
                .andExpect(jsonPath("$.masteredWords").exists())
                .andExpect(jsonPath("$.masteryPercentage").exists());
    }

    @Test
    @WithMockUser(roles = "TEACHER")
    @DisplayName("recordReview returns 200 for TEACHER role")
    void recordReview_teacherRole_returns200() throws Exception {
        mockMvc.perform(post("/api/vocabulary/srs/record-review")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(validRequest)))
                .andExpect(status().isOk());
    }
}
