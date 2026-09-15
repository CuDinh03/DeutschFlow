package com.deutschflow.speaking.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.deutschflow.common.WebRoutes;
import com.deutschflow.speaking.dto.SpeakingPolicy;
import com.deutschflow.speaking.dto.TodayPlanDto;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertNotNull;

@ExtendWith(MockitoExtension.class)
class AdaptivePolicyServiceUnitTest {
    @Mock com.deutschflow.speaking.repository.SpeakingUserStateRepository stateRepository;
    @Mock com.deutschflow.speaking.repository.ErrorReviewTaskRepository taskRepository;
    @Mock com.deutschflow.speaking.repository.UserErrorSkillRepository skillRepository;
    @Mock com.deutschflow.speaking.repository.AiSpeakingSessionRepository sessionRepository;
    @Mock com.fasterxml.jackson.databind.ObjectMapper objectMapper;

    @InjectMocks
    AdaptivePolicyService service;

    @Test
    void serviceConstructedWithMocks() {
        assertNotNull(service);
    }

    private static SpeakingPolicy policy(String cefr) {
        return new SpeakingPolicy(true, cefr, 0, List.of(), List.of(), List.of("weil-Satz"),
                "Alltag", false, null, null);
    }

    // ── V-12a: gợi ý "bài nói theo tuần" phải trỏ vào màn NỘP BÀI TUẦN ────────────

    @Test
    @DisplayName("kế hoạch hôm nay: href bài nói theo tuần trỏ vào màn nộp bài tuần, KHÔNG phải trang chủ luyện nói")
    void todayPlan_weeklyHref_pointsToWeeklySpeakingPage() {
        TodayPlanDto plan = service.computeTodayPlan(1L, List.of(), null, policy("B1"), 0);

        assertThat(plan.recommendedWeeklySpeaking().href())
                .startsWith(WebRoutes.STUDENT_WEEKLY_SPEAKING + "?")
                .contains("cefBand=B1");
        // Ô "Speaking tuần" nằm ngay trên trang chủ khu luyện nói — trỏ về đó là tự trỏ về mình.
        assertThat(plan.recommendedWeeklySpeaking().href())
                .doesNotStartWith(WebRoutes.STUDENT_SPEAKING + "?");
    }

    @Test
    @DisplayName("kế hoạch hôm nay: href luyện nói tự do vẫn trỏ màn chọn chủ đề (không bị đổi nhầm)")
    void todayPlan_speakingHref_unchanged() {
        TodayPlanDto plan = service.computeTodayPlan(1L, List.of(), null, policy("B1"), 0);

        assertThat(plan.recommendedSpeaking().href())
                .startsWith(WebRoutes.STUDENT_SPEAKING_SETUP + "?");
    }
}
