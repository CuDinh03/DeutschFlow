package com.deutschflow.gamification.service;

import com.deutschflow.gamification.entity.UserXpEvent;
import com.deutschflow.gamification.entity.UserXpEvent.XpEventType;
import com.deutschflow.gamification.repository.UserAchievementRepository;
import com.deutschflow.gamification.repository.UserXpEventRepository;
import com.deutschflow.notification.service.UserNotificationService;
import com.deutschflow.user.repository.LearningSessionProgressRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * B1 audit lag 02/09: batch N thẻ SRS từng award XP mỗi thẻ (N lock + 2N SUM + N lần quét
 * achievement ≈ 250–350 query cho 30 thẻ). {@code awardSrsReviewBatch} phải: ghi đủ N event
 * (giữ semantics event-sourcing — achievement SRS_REVIEW_COUNT đếm số event) bằng MỘT saveAll,
 * và chỉ check level-up + achievement MỘT lần ở cuối.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class XpServiceSrsBatchTest {

    @Mock UserXpEventRepository xpEventRepository;
    @Mock AchievementCatalogService achievementCatalog;
    @Mock UserAchievementRepository userAchievementRepository;
    @Mock LearningSessionProgressRepository sessionProgressRepository;
    @Mock UserNotificationService userNotificationService;
    @Mock JdbcTemplate jdbcTemplate;

    private XpService xpService;

    private static final Long USER = 1L;

    @BeforeEach
    void setUp() {
        xpService = new XpService(xpEventRepository, achievementCatalog, userAchievementRepository,
                sessionProgressRepository, userNotificationService, jdbcTemplate);
        when(userAchievementRepository.findUnlockedAchievementIdsByUserId(any())).thenReturn(Set.of());
        when(achievementCatalog.getAll()).thenReturn(List.of());
    }

    @Test
    @DisplayName("batch 30 thẻ → MỘT saveAll với 30 event SRS_REVIEW, không save() lẻ nào")
    void batchWritesAllEventsInOneSaveAll() {
        when(xpEventRepository.sumXpByUserId(USER)).thenReturn(0L);

        xpService.awardSrsReviewBatch(USER, 30);

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<UserXpEvent>> captor = ArgumentCaptor.forClass((Class) List.class);
        verify(xpEventRepository, times(1)).saveAll(captor.capture());
        verify(xpEventRepository, never()).save(any(UserXpEvent.class));

        List<UserXpEvent> events = captor.getValue();
        assertThat(events).hasSize(30);
        assertThat(events).allSatisfy(e -> {
            assertThat(e.getEventType()).isEqualTo(XpEventType.SRS_REVIEW);
            assertThat(e.getXpAmount()).isEqualTo(XpService.XP_SRS_REVIEW);
            assertThat(e.getUserId()).isEqualTo(USER);
        });
    }

    @Test
    @DisplayName("batch chỉ quét achievement MỘT lần (không phải mỗi thẻ)")
    void batchChecksAchievementsOnce() {
        when(xpEventRepository.sumXpByUserId(USER)).thenReturn(0L);

        xpService.awardSrsReviewBatch(USER, 30);

        verify(achievementCatalog, times(1)).getAll();
        verify(userAchievementRepository, times(1)).findUnlockedAchievementIdsByUserId(USER);
    }

    @Test
    @DisplayName("level-up trong batch → đúng MỘT thông báo, tính trên tổng XP cuối")
    void batchNotifiesLevelUpOnce() {
        // Trước batch 0 XP (level 1); sau batch vượt ngưỡng level 2 (100 XP).
        when(xpEventRepository.sumXpByUserId(USER)).thenReturn(0L, 120L, 120L);

        xpService.awardSrsReviewBatch(USER, 60);

        verify(userNotificationService, times(1)).onLevelUp(eq(USER), eq(1), eq(2), anyLong());
    }

    @Test
    @DisplayName("reviewCount = 0 → không đụng gì cả")
    void emptyBatchIsNoop() {
        xpService.awardSrsReviewBatch(USER, 0);

        verifyNoInteractions(xpEventRepository, userNotificationService, jdbcTemplate);
    }
}
