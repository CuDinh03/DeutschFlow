package com.deutschflow.srs.service;

import com.deutschflow.common.transaction.RunAfterCommitService;
import com.deutschflow.gamification.service.XpService;
import com.deutschflow.notification.service.NotificationAutoAckService;
import com.deutschflow.srs.dto.SrsStatsDto;
import com.deutschflow.srs.repository.VocabReviewRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.OffsetDateTime;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

/**
 * Owner 05/09: {@code GET /api/srs/stats} thêm {@code reviewedCards} (số thẻ đã ôn ít nhất
 * một lần) và {@code totalReviews} (tổng lượt ôn = số event XP SRS_REVIEW) để mobile biết
 * người dùng "chưa từng ôn" — coach mark SRS chỉ tự nổ cho người chưa dùng chức năng. Thẻ
 * mới đưa vào lịch nhưng chưa ôn KHÔNG được tính.
 */
@ExtendWith(MockitoExtension.class)
class SrsServiceStatsTest {

    @Mock VocabReviewRepository repo;
    @Mock FsrsService fsrsService;
    @Mock FsrsWeightProvider fsrsWeightProvider;
    @Mock XpService xpService;
    @Mock NotificationAutoAckService notificationAutoAckService;
    @Mock RunAfterCommitService runAfterCommitService;

    private SrsService srsService;

    private static final Long USER = 7L;

    @BeforeEach
    void setUp() {
        srsService = new SrsService(repo, fsrsService, fsrsWeightProvider, xpService,
                notificationAutoAckService, runAfterCommitService);
    }

    @Test
    @DisplayName("stats trả đủ bốn số: đến hạn, tổng thẻ, thẻ đã ôn ≥ 1 lần, tổng lượt ôn")
    void statsIncludeReviewedCardsAndTotalReviews() {
        when(repo.countDue(eq(USER), any(OffsetDateTime.class))).thenReturn(5L);
        when(repo.countByUserId(USER)).thenReturn(40L);
        when(repo.countByUserIdAndLastReviewAtIsNotNull(USER)).thenReturn(12L);
        when(xpService.countSrsReviews(USER)).thenReturn(57L);

        SrsStatsDto stats = srsService.getStats(USER);

        assertThat(stats.dueCount()).isEqualTo(5L);
        assertThat(stats.totalCards()).isEqualTo(40L);
        assertThat(stats.reviewedCards()).isEqualTo(12L);
        assertThat(stats.totalReviews()).isEqualTo(57L);
    }

    @Test
    @DisplayName("người dùng có thẻ đến hạn nhưng chưa từng ôn → reviewedCards = 0 (chưa dùng SRS)")
    void neverReviewedIsZeroEvenWithDueCards() {
        when(repo.countDue(eq(USER), any(OffsetDateTime.class))).thenReturn(5L);
        when(repo.countByUserId(USER)).thenReturn(5L);
        when(repo.countByUserIdAndLastReviewAtIsNotNull(USER)).thenReturn(0L);
        when(xpService.countSrsReviews(USER)).thenReturn(0L);

        SrsStatsDto stats = srsService.getStats(USER);

        assertThat(stats.dueCount()).isEqualTo(5L);
        assertThat(stats.reviewedCards()).isZero();
        assertThat(stats.totalReviews()).isZero();
    }
}
