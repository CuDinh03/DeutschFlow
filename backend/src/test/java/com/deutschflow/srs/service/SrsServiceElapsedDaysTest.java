package com.deutschflow.srs.service;

import com.deutschflow.common.transaction.RunAfterCommitService;
import com.deutschflow.gamification.service.XpService;
import com.deutschflow.notification.service.NotificationAutoAckService;
import com.deutschflow.srs.dto.ReviewRequest;
import com.deutschflow.srs.entity.VocabReviewSchedule;
import com.deutschflow.srs.entity.VocabReviewSchedule.AlgorithmVersion;
import com.deutschflow.srs.repository.VocabReviewRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Lỗi gốc: {@code applyReview} ghi {@code lastReviewAt = now} TRƯỚC khi tính số ngày trôi, nên
 * FSRS luôn nhận 0 ngày và độ ổn định không tăng. Test này dùng repository giả, {@link FsrsService}
 * thật (spy) và một đồng hồ điều khiển được.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class SrsServiceElapsedDaysTest {

    /** Đồng hồ chỉnh tay cho test. */
    private static final class MutableClock extends Clock {
        private Instant now;

        MutableClock(Instant start) {
            this.now = start;
        }

        void advance(Duration d) {
            now = now.plus(d);
        }

        @Override
        public ZoneId getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(ZoneId zone) {
            return this;
        }

        @Override
        public Instant instant() {
            return now;
        }
    }

    private static final Long USER = 1L;
    private static final Instant START = Instant.parse("2026-03-01T08:00:00Z");

    @Mock VocabReviewRepository repo;
    @Spy FsrsService fsrsService = new FsrsService();
    @Mock FsrsWeightProvider fsrsWeightProvider;
    @Mock XpService xpService;
    @Mock NotificationAutoAckService notificationAutoAckService;
    @Mock RunAfterCommitService runAfterCommitService;

    private MutableClock clock;
    private SrsService srsService;

    @BeforeEach
    void setUp() {
        clock = new MutableClock(START);
        srsService = new SrsService(repo, fsrsService, fsrsWeightProvider, xpService,
                notificationAutoAckService, runAfterCommitService, clock);
        when(fsrsWeightProvider.weightsForUser(USER)).thenReturn(new FsrsService().defaultWeights());
    }

    private VocabReviewSchedule stub(VocabReviewSchedule card) {
        when(repo.findByUserIdAndVocabId(USER, card.getVocabId())).thenReturn(Optional.of(card));
        return card;
    }

    private VocabReviewSchedule newFsrsCard() {
        return VocabReviewSchedule.builder()
                .userId(USER).vocabId("v1").german("Haus").meaning("nhà")
                .algorithmVersion(AlgorithmVersion.FSRS.name())
                .build();
    }

    @Test
    @DisplayName("lần ôn thứ hai sau 3 ngày truyền 3 ngày trôi (không phải 0), S tăng, interval_days được ghi")
    void secondReviewAfterThreeDaysPassesRealElapsedDays() {
        VocabReviewSchedule card = stub(newFsrsCard());

        srsService.recordReview(USER, new ReviewRequest("v1", 4)); // quality 4 → Good
        OffsetDateTime firstReviewAt = OffsetDateTime.ofInstant(START, ZoneOffset.UTC);
        assertThat(card.getLastReviewAt()).isEqualTo(firstReviewAt);
        assertThat(card.getStability()).isEqualByComparingTo("3.7145");
        assertThat(card.getIntervalDays()).isEqualTo(4);
        assertThat(card.getNextReviewAt()).isEqualTo(firstReviewAt.plusDays(4));

        clock.advance(Duration.ofDays(3).plusHours(5));
        srsService.recordReview(USER, new ReviewRequest("v1", 4));

        OffsetDateTime secondReviewAt = firstReviewAt.plusDays(3).plusHours(5);
        verify(fsrsService).scheduleReview(eq(card), eq(3), eq(3L), any(double[].class), eq(secondReviewAt));
        assertThat(card.getLastReviewAt()).isEqualTo(secondReviewAt);
        assertThat(card.getStability().doubleValue()).isGreaterThan(3.7145 * 2);
        assertThat(card.getIntervalDays()).isEqualTo((int) Math.round(card.getStability().doubleValue()));
        assertThat(card.getIntervalDays()).isGreaterThan(4);
        assertThat(card.getNextReviewAt()).isEqualTo(secondReviewAt.plusDays(card.getIntervalDays()));
    }

    @Test
    @DisplayName("thẻ SM-2 có lịch sử: nâng cấp lên FSRS với số ngày trôi thật từ lastReviewAt cũ")
    void sm2UpgradeUsesRealElapsedDays() {
        OffsetDateTime now = OffsetDateTime.ofInstant(START, ZoneOffset.UTC);
        VocabReviewSchedule card = stub(VocabReviewSchedule.builder()
                .userId(USER).vocabId("v1").german("Haus").meaning("nhà")
                .algorithmVersion(AlgorithmVersion.SM2.name())
                .repetitions(3).intervalDays(6)
                .lastReviewAt(now.minusDays(10))
                .build());

        srsService.recordReview(USER, new ReviewRequest("v1", 4));

        verify(fsrsService).scheduleReview(eq(card), eq(3), eq(10L), any(double[].class), eq(now));
        assertThat(card.getAlgorithmVersion()).isEqualTo(AlgorithmVersion.FSRS.name());
        assertThat(card.getStability().doubleValue()).isGreaterThan(6.0); // seed 6 ngày, Good sau 10 ngày → tăng
        assertThat(card.getIntervalDays()).isEqualTo((int) Math.round(card.getStability().doubleValue()));
        assertThat(card.getLastReviewAt()).isEqualTo(now);
    }

    @Test
    @DisplayName("thẻ FSRS đã có S nhưng thiếu lastReviewAt: coi như 0 ngày trôi, vẫn ghi interval_days")
    void missingLastReviewFallsBackToZero() {
        VocabReviewSchedule card = newFsrsCard();
        card.setStability(new BigDecimal("30.0000"));
        card.setDifficulty(new BigDecimal("5.00"));
        stub(card);

        srsService.recordReview(USER, new ReviewRequest("v1", 4));

        verify(fsrsService).scheduleReview(eq(card), anyInt(), eq(0L), any(double[].class), any(OffsetDateTime.class));
        assertThat(card.getIntervalDays()).isEqualTo(30);
        verify(xpService).awardSrsReview(anyLong());
    }
}
