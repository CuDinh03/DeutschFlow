package com.deutschflow.gamification.controller;

import com.deutschflow.gamification.entity.Achievement;
import com.deutschflow.gamification.repository.AchievementRepository;
import com.deutschflow.gamification.repository.UserAchievementRepository;
import com.deutschflow.unittest.support.MockMvcWithValidation;
import com.deutschflow.user.entity.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class AchievementControllerUnitTest {

    private MockMvc mvc;

    @Mock
    private AchievementRepository achievementRepository;

    @Mock
    private UserAchievementRepository userAchievementRepository;

    @InjectMocks
    private AchievementController controller;

    private final User mockUser = User.builder().id(1L).build();

    @BeforeEach
    void setUp() {
        mvc = MockMvcWithValidation.standalone(controller, null, mockUser);
    }

    @Test
    void getMyAchievements_returnsOkWithUnlockedStatus() throws Exception {
        var a1 = Achievement.builder().id(1L).code("FIRST_WORD").nameVi("Từ đầu tiên")
                .descriptionVi("Học từ đầu tiên").iconEmoji("🌱").xpReward(10).rarity("COMMON").build();
        var a2 = Achievement.builder().id(2L).code("STREAK_7").nameVi("7 ngày liên tiếp")
                .descriptionVi("Học 7 ngày liên tiếp").iconEmoji("🔥").xpReward(50).rarity("RARE").build();
        when(achievementRepository.findAll()).thenReturn(List.of(a1, a2));
        when(userAchievementRepository.existsByUserIdAndAchievementId(1L, 1L)).thenReturn(true);
        when(userAchievementRepository.existsByUserIdAndAchievementId(1L, 2L)).thenReturn(false);

        mvc.perform(get("/api/achievements/me"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].code").value("FIRST_WORD"))
                .andExpect(jsonPath("$[0].unlocked").value(true))
                .andExpect(jsonPath("$[1].code").value("STREAK_7"))
                .andExpect(jsonPath("$[1].unlocked").value(false));
    }

    @Test
    void getMyAchievements_emptyWhenNoAchievements() throws Exception {
        when(achievementRepository.findAll()).thenReturn(List.of());

        mvc.perform(get("/api/achievements/me"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));
    }
}
