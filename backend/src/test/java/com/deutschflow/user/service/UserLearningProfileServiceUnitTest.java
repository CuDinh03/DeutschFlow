package com.deutschflow.user.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.deutschflow.user.dto.UpdateLearningProfileRequest;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.entity.UserLearningProfile;
import com.deutschflow.user.repository.UserLearningProfileRepository;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class UserLearningProfileServiceUnitTest {
    @Mock com.deutschflow.user.repository.UserLearningProfileRepository profileRepository;
    @Mock StoredLearningPlanSupport storedLearningPlanSupport;

    @InjectMocks
    UserLearningProfileService service;

    @Test
    void serviceConstructedWithMocks() {
        assertNotNull(service);
    }

    // ── partialUpdate: currentLevel + examType (trang Hồ sơ → tab Học tập) ──

    private UserLearningProfile stubProfile(UserLearningProfile.CurrentLevel level, String levelSource) {
        UserLearningProfile profile = new UserLearningProfile();
        profile.setCurrentLevel(level);
        profile.setLevelSource(levelSource);
        when(profileRepository.findByUserId(7L)).thenReturn(Optional.of(profile));
        when(profileRepository.save(any(UserLearningProfile.class))).thenAnswer(inv -> inv.getArgument(0));
        return profile;
    }

    private static User student() {
        return User.builder().id(7L).build();
    }

    /** Chỉ set field đang test — mọi field khác null = giữ nguyên (partial update). */
    private static UpdateLearningProfileRequest reqWith(String currentLevel, String examType) {
        return new UpdateLearningProfileRequest(null, null, currentLevel, examType, null, null, null, null, null);
    }

    @Test
    void partialUpdate_currentLevelChanged_setsLevelSourceSelf() {
        stubProfile(UserLearningProfile.CurrentLevel.A2, "PLACEMENT");

        UserLearningProfile updated = service.partialUpdate(student(), reqWith("B1", null));

        assertEquals(UserLearningProfile.CurrentLevel.B1, updated.getCurrentLevel());
        assertEquals("SELF", updated.getLevelSource());
    }

    @Test
    void partialUpdate_currentLevelUnchanged_keepsPlacementSource() {
        stubProfile(UserLearningProfile.CurrentLevel.A2, "PLACEMENT");

        UserLearningProfile updated = service.partialUpdate(student(), reqWith("A2", null));

        assertEquals(UserLearningProfile.CurrentLevel.A2, updated.getCurrentLevel());
        assertEquals("PLACEMENT", updated.getLevelSource());
    }

    @Test
    void partialUpdate_examTypeSetAndCleared() {
        UserLearningProfile profile = stubProfile(UserLearningProfile.CurrentLevel.A0, "SELF");

        service.partialUpdate(student(), reqWith(null, "TELC"));
        assertEquals("TELC", profile.getExamType());

        service.partialUpdate(student(), reqWith(null, "  "));
        assertNull(profile.getExamType());
    }
}
