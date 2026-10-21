package com.deutschflow.user.service;

import com.deutschflow.common.quota.PlanBadge;
import com.deutschflow.common.quota.QuotaService;
import com.deutschflow.interview.repository.OccupationRepository;
import com.deutschflow.user.dto.OnboardingProfileRequest;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.entity.UserLearningProfile;
import com.deutschflow.user.mentor.FixedMentorResolver;
import com.deutschflow.user.onboarding.OnboardingTypeResolver;
import com.deutschflow.user.repository.UserLearningProfileRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/** Đợt 2e A+B+E: hồ sơ onboarding lưu nghề + ngày mốc, dễ dãi với dữ liệu lạ. */
@ExtendWith(MockitoExtension.class)
class UserLearningProfileServiceOccupationTest {

    @Mock UserLearningProfileRepository profileRepository;
    @Mock StoredLearningPlanSupport storedLearningPlanSupport;
    @Mock QuotaService quotaService;
    @Mock OccupationRepository occupationRepository;

    private UserLearningProfileService service;

    @BeforeEach
    void setUp() {
        service = new UserLearningProfileService(profileRepository, storedLearningPlanSupport, new ObjectMapper(),
                quotaService, new FixedMentorResolver(), new OnboardingTypeResolver(), occupationRepository);
        lenient().when(quotaService.resolvePlanBadge(anyLong(), any()))
                .thenReturn(new PlanBadge("FREE", "BASIC", null, null, false, null, "WEB"));
        lenient().when(profileRepository.findByUserId(1L)).thenReturn(Optional.empty());
        lenient().when(profileRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
    }

    private static User user() {
        User u = mock(User.class);
        when(u.getId()).thenReturn(1L);
        return u;
    }

    private static OnboardingProfileRequest req(String occupationCode, LocalDate targetDate) {
        return new OnboardingProfileRequest("WORK", "B1", "A2", null, null, "Pflege", null, null, 5, 15,
                null, "JOB", 15, occupationCode, targetDate);
    }

    @Test
    void knownOccupation_andFutureDate_areSaved_andReturned() {
        when(occupationRepository.existsById("altenpfleger")).thenReturn(true);
        LocalDate date = LocalDate.now().plusMonths(4);

        UserLearningProfile p = service.upsertProfile(user(), req("altenpfleger", date), "web");

        assertThat(p.getOccupationCode()).isEqualTo("altenpfleger");
        assertThat(p.getTargetDate()).isEqualTo(date);
        assertThat(service.toResponse(p).occupationCode()).isEqualTo("altenpfleger");
        assertThat(service.toResponse(p).targetDate()).isEqualTo(date.toString());
    }

    @Test
    void unknownOccupation_isDropped_notAnError() {
        when(occupationRepository.existsById("astronaut")).thenReturn(false);

        UserLearningProfile p = service.upsertProfile(user(), req("astronaut", null), "web");

        assertThat(p.getOccupationCode()).isNull();
        assertThat(p.getTargetDate()).isNull();
    }

    @Test
    void targetDate_inPastOrTooFar_isDropped() {
        LocalDate today = LocalDate.of(2026, 10, 21);
        assertThat(UserLearningProfileService.plausibleTargetDateOrNull(today, today)).isEqualTo(today);
        assertThat(UserLearningProfileService.plausibleTargetDateOrNull(today.minusDays(1), today)).isNull();
        assertThat(UserLearningProfileService.plausibleTargetDateOrNull(today.plusYears(11), today)).isNull();
        assertThat(UserLearningProfileService.plausibleTargetDateOrNull(null, today)).isNull();
    }
}
