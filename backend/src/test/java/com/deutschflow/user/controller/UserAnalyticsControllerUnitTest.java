package com.deutschflow.user.controller;

import com.deutschflow.unittest.support.MockMvcWithValidation;
import com.deutschflow.user.dto.ErrorAnalyticsDto;
import com.deutschflow.user.dto.LearningAnalyticsSummaryDto;
import com.deutschflow.user.dto.RecommendationDto;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.service.ErrorAnalyticsService;
import com.deutschflow.user.service.LearningAnalyticsService;
import com.deutschflow.user.service.RecommendationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.Map;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class UserAnalyticsControllerUnitTest {

    private MockMvc mvc;

    @Mock
    private LearningAnalyticsService analyticsService;

    @Mock
    private RecommendationService recommendationService;

    @Mock
    private ErrorAnalyticsService errorAnalyticsService;

    @InjectMocks
    private UserAnalyticsController controller;

    private final User mockUser = User.builder().id(1L).build();

    @BeforeEach
    void setUp() {
        mvc = MockMvcWithValidation.standalone(controller, null, mockUser);
    }

    @Test
    void getAnalytics_returnsOkWithSummary() throws Exception {
        var summary = new LearningAnalyticsSummaryDto(
                120, 85, 45, 7, 12L, List.of(), Map.of(), List.of("Artikel", "Dativ"));
        when(analyticsService.getWeeklySummary(eq(1L))).thenReturn(summary);

        mvc.perform(get("/api/user/analytics"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalWordsLearned").value(120))
                .andExpect(jsonPath("$.totalSessionsCompleted").value(7));
    }

    @Test
    void getRecommendations_returnsOkWithItems() throws Exception {
        var item = new RecommendationDto.RecommendationItem(
                "VOCABULARY", "Ôn tập từ vựng", "Có 12 từ cần ôn", "HIGH", "/student/vocabulary");
        var dto = new RecommendationDto(List.of(item));
        when(recommendationService.getRecommendations(eq(1L))).thenReturn(dto);

        mvc.perform(get("/api/user/recommendations"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items.length()").value(1))
                .andExpect(jsonPath("$.items[0].type").value("VOCABULARY"));
    }

    @Test
    void getErrorAnalytics_returnsOkWithSummary() throws Exception {
        var dto = new ErrorAnalyticsDto(List.of(), List.of(), List.of(), 5, 3);
        when(errorAnalyticsService.getErrorAnalytics(eq(1L))).thenReturn(dto);

        mvc.perform(get("/api/user/error-analytics"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalErrorsThisWeek").value(5))
                .andExpect(jsonPath("$.openErrors").value(3));
    }
}
