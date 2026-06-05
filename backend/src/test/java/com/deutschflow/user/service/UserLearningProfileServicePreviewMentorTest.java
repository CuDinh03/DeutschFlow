package com.deutschflow.user.service;

import com.deutschflow.common.quota.PlanBadge;
import com.deutschflow.common.quota.QuotaService;
import com.deutschflow.user.dto.OnboardingMentorResponse;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.mentor.FixedMentorResolver;
import com.deutschflow.user.onboarding.OnboardingTypeResolver;
import com.deutschflow.user.repository.UserLearningProfileRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Tests {@link UserLearningProfileService#previewMentor} with a REAL
 * {@link FixedMentorResolver}, so the assigned-mentor and FREE→PRO upsell logic is
 * exercised end-to-end (only the subscription tier is stubbed).
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("UserLearningProfileService.previewMentor")
class UserLearningProfileServicePreviewMentorTest {

    @Mock UserLearningProfileRepository profileRepository;
    @Mock StoredLearningPlanSupport storedLearningPlanSupport;
    @Mock ObjectMapper objectMapper;
    @Mock QuotaService quotaService;
    @Mock OnboardingTypeResolver onboardingTypeResolver;

    private UserLearningProfileService service;

    @BeforeEach
    void setUp() {
        service = new UserLearningProfileService(
                profileRepository, storedLearningPlanSupport, objectMapper,
                quotaService, new FixedMentorResolver(), onboardingTypeResolver);
    }

    private User user() {
        User u = mock(User.class);
        when(u.getId()).thenReturn(1L);
        return u;
    }

    private void onPlan(String code) {
        when(quotaService.resolvePlanBadge(anyLong(), any()))
                .thenReturn(new PlanBadge(code, "BASIC", null, null));
    }

    @Test
    @DisplayName("FREE + WORK/IT → assigned ANNA, upsell LUKAS")
    void free_it_hasUpsell() {
        onPlan("FREE");
        OnboardingMentorResponse r = service.previewMentor(user(), "WORK", "IT", "B2");
        assertThat(r.code()).isEqualTo("ANNA");
        assertThat(r.displayName()).isEqualTo("Anna");
        assertThat(r.upsellCode()).isEqualTo("LUKAS");
        assertThat(r.upsellDisplayName()).isEqualTo("Lukas");
    }

    @Test
    @DisplayName("FREE + CERT → assigned ANNA, no upsell (ideal is also ANNA)")
    void free_cert_noUpsell() {
        onPlan("FREE");
        OnboardingMentorResponse r = service.previewMentor(user(), "CERT", "IT", "B2");
        assertThat(r.code()).isEqualTo("ANNA");
        assertThat(r.upsellCode()).isNull();
        assertThat(r.upsellDisplayName()).isNull();
    }

    @Test
    @DisplayName("FREE + WORK/Retail → assigned LENA, no upsell (already the ideal)")
    void free_retail_noUpsell() {
        onPlan("FREE");
        OnboardingMentorResponse r = service.previewMentor(user(), "WORK", "Verkauf Einzelhandel", "A1");
        assertThat(r.code()).isEqualTo("LENA");
        assertThat(r.upsellCode()).isNull();
    }

    @Test
    @DisplayName("PRO + WORK/IT → assigned LUKAS, no upsell (premium, ungated)")
    void pro_it_noUpsell() {
        onPlan("PRO");
        OnboardingMentorResponse r = service.previewMentor(user(), "WORK", "IT", "B2");
        assertThat(r.code()).isEqualTo("LUKAS");
        assertThat(r.upsellCode()).isNull();
    }
}
