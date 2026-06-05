package com.deutschflow.user.service;

import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.common.quota.QuotaService;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.entity.UserLearningProfile;
import com.deutschflow.user.mentor.FixedMentorResolver;
import com.deutschflow.user.onboarding.OnboardingTypeResolver;
import com.deutschflow.user.repository.UserLearningProfileRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("UserLearningProfileService.recordUpsellInterest")
class UserLearningProfileServiceUpsellTest {

    @Mock UserLearningProfileRepository profileRepository;
    @Mock StoredLearningPlanSupport storedLearningPlanSupport;
    @Mock ObjectMapper objectMapper;
    @Mock QuotaService quotaService;
    @Mock FixedMentorResolver fixedMentorResolver;
    @Mock OnboardingTypeResolver onboardingTypeResolver;

    @InjectMocks UserLearningProfileService service;

    private User userWithId(long id) {
        User user = mock(User.class);
        when(user.getId()).thenReturn(id);
        return user;
    }

    @Test
    @DisplayName("sets the opt-in timestamp and saves when not yet opted in")
    void setsTimestamp_whenNotOptedIn() {
        User user = userWithId(7L);
        UserLearningProfile profile = UserLearningProfile.builder().build(); // upsellOptInAt == null
        when(profileRepository.findByUserId(7L)).thenReturn(Optional.of(profile));

        service.recordUpsellInterest(user);

        assertThat(profile.getUpsellOptInAt()).isNotNull();
        verify(profileRepository).save(profile);
    }

    @Test
    @DisplayName("is idempotent — keeps the original timestamp and does not save again")
    void idempotent_whenAlreadyOptedIn() {
        User user = userWithId(7L);
        LocalDateTime original = LocalDateTime.of(2026, 6, 1, 10, 0);
        UserLearningProfile profile = UserLearningProfile.builder().upsellOptInAt(original).build();
        when(profileRepository.findByUserId(7L)).thenReturn(Optional.of(profile));

        service.recordUpsellInterest(user);

        assertThat(profile.getUpsellOptInAt()).isEqualTo(original);
        verify(profileRepository, never()).save(profile);
    }

    @Test
    @DisplayName("throws NotFound when the learner has no profile yet")
    void throwsNotFound_whenNoProfile() {
        User user = userWithId(99L);
        when(profileRepository.findByUserId(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.recordUpsellInterest(user))
                .isInstanceOf(NotFoundException.class)
                .hasMessageContaining("profile");
    }
}
