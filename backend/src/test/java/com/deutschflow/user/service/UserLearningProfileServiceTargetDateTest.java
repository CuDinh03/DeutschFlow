package com.deutschflow.user.service;

import com.deutschflow.common.exception.BadRequestException;
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

import java.time.LocalDate;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("UserLearningProfileService.updateTargetDate")
class UserLearningProfileServiceTargetDateTest {

    @Mock UserLearningProfileRepository profileRepository;
    @Mock StoredLearningPlanSupport storedLearningPlanSupport;
    @Mock ObjectMapper objectMapper;
    @Mock QuotaService quotaService;
    @Mock FixedMentorResolver fixedMentorResolver;
    @Mock OnboardingTypeResolver onboardingTypeResolver;

    @InjectMocks UserLearningProfileService service;

    private User userWithProfile(UserLearningProfile profile) {
        User user = mock(User.class);
        when(user.getId()).thenReturn(7L);
        when(profileRepository.findByUserId(7L)).thenReturn(Optional.ofNullable(profile));
        return user;
    }

    @Test
    @DisplayName("saves an exact future date")
    void savesFutureDate() {
        UserLearningProfile profile = UserLearningProfile.builder().build();
        LocalDate date = LocalDate.now().plusDays(45);

        service.updateTargetDate(userWithProfile(profile), date);

        assertThat(profile.getTargetDate()).isEqualTo(date);
        verify(profileRepository).save(profile);
    }

    @Test
    @DisplayName("rejects a past date and keeps the old one")
    void rejectsPastDate() {
        LocalDate old = LocalDate.now().plusDays(10);
        UserLearningProfile profile = UserLearningProfile.builder().targetDate(old).build();
        User user = userWithProfile(profile);

        assertThatThrownBy(() -> service.updateTargetDate(user, LocalDate.now().minusDays(1)))
                .isInstanceOf(BadRequestException.class);

        assertThat(profile.getTargetDate()).isEqualTo(old);
        verify(profileRepository, never()).save(profile);
    }

    @Test
    @DisplayName("throws NotFound when the learner has no profile yet")
    void throwsNotFound_whenNoProfile() {
        User user = userWithProfile(null);

        assertThatThrownBy(() -> service.updateTargetDate(user, LocalDate.now().plusDays(10)))
                .isInstanceOf(NotFoundException.class);
    }
}
