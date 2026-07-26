package com.deutschflow.gamification.service;

import com.deutschflow.gamification.entity.UserXpEvent;
import com.deutschflow.gamification.entity.UserXpEvent.XpEventType;
import com.deutschflow.gamification.repository.AchievementRepository;
import com.deutschflow.gamification.repository.UserAchievementRepository;
import com.deutschflow.gamification.repository.UserXpEventRepository;
import com.deutschflow.notification.service.UserNotificationService;
import com.deutschflow.user.repository.LearningSessionProgressRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.Set;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Audit speaking 24/07 — R-M7: a speaking session can be "ended" more than once — the backend
 * auto-ends on CLOSING_FAREWELL and the learner can then tap "Kết thúc" (or a client-timeout retry
 * re-hits PATCH /end, which is idempotent server-side). Before the guard, every end awarded another
 * +30 SESSION_COMPLETE. This locks the dedup: a session that already has a SESSION_COMPLETE event
 * awards nothing more.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class XpServiceSessionCompleteDedupTest {

    @Mock UserXpEventRepository xpEventRepository;
    @Mock AchievementRepository achievementRepository;
    @Mock UserAchievementRepository userAchievementRepository;
    @Mock LearningSessionProgressRepository sessionProgressRepository;
    @Mock UserNotificationService userNotificationService;
    @Mock JdbcTemplate jdbcTemplate;

    private XpService xpService;

    private static final Long USER = 1L;
    private static final Long SESSION = 7L;

    @BeforeEach
    void setUp() {
        xpService = new XpService(xpEventRepository, achievementRepository, userAchievementRepository,
                sessionProgressRepository, userNotificationService, jdbcTemplate);
        when(userAchievementRepository.findUnlockedAchievementIdsByUserId(any())).thenReturn(Set.of());
    }

    @Test
    @DisplayName("session already completed → no second SESSION_COMPLETE is recorded")
    void secondEndAwardsNothing() {
        when(xpEventRepository.existsByUserIdAndEventTypeAndRefSessionId(
                USER, XpEventType.SESSION_COMPLETE, SESSION)).thenReturn(true);

        xpService.awardSessionComplete(USER, SESSION);

        verify(xpEventRepository, never()).save(any(UserXpEvent.class));
    }

    @Test
    @DisplayName("first end still records SESSION_COMPLETE exactly once")
    void firstEndAwardsOnce() {
        when(xpEventRepository.existsByUserIdAndEventTypeAndRefSessionId(
                USER, XpEventType.SESSION_COMPLETE, SESSION)).thenReturn(false);
        when(xpEventRepository.existsByUserIdAndEventType(USER, XpEventType.FIRST_SESSION)).thenReturn(true);
        when(xpEventRepository.sumXpByUserId(USER)).thenReturn(0L);

        xpService.awardSessionComplete(USER, SESSION);

        verify(xpEventRepository, times(1)).save(argThatIsSessionComplete());
    }

    private static UserXpEvent argThatIsSessionComplete() {
        return org.mockito.ArgumentMatchers.argThat(
                e -> e != null && e.getEventType() == XpEventType.SESSION_COMPLETE
                        && SESSION.equals(e.getRefSessionId()));
    }
}
