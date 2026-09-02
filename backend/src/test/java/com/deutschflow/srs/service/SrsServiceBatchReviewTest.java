package com.deutschflow.srs.service;

import com.deutschflow.common.transaction.RunAfterCommitService;
import com.deutschflow.gamification.service.XpService;
import com.deutschflow.notification.service.NotificationAutoAckService;
import com.deutschflow.srs.dto.ReviewRequest;
import com.deutschflow.srs.dto.VocabReviewCard;
import com.deutschflow.srs.entity.VocabReviewSchedule;
import com.deutschflow.srs.entity.VocabReviewSchedule.AlgorithmVersion;
import com.deutschflow.srs.repository.VocabReviewRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * B1 audit lag 02/09: POST /api/srs/review/batch từng gọi recordReview per thẻ → award XP
 * per thẻ. Giờ batch phải: cập nhật lịch đủ từng thẻ nhưng chỉ gọi
 * {@link XpService#awardSrsReviewBatch} đúng MỘT lần với đúng số thẻ.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class SrsServiceBatchReviewTest {

    @Mock VocabReviewRepository repo;
    @Mock FsrsService fsrsService;
    @Mock FsrsWeightProvider fsrsWeightProvider;
    @Mock XpService xpService;
    @Mock NotificationAutoAckService notificationAutoAckService;
    @Mock RunAfterCommitService runAfterCommitService;

    private SrsService srsService;

    private static final Long USER = 1L;

    @BeforeEach
    void setUp() {
        srsService = new SrsService(repo, fsrsService, fsrsWeightProvider, xpService,
                notificationAutoAckService, runAfterCommitService);
        when(fsrsWeightProvider.weightsForUser(USER)).thenReturn(new double[19]);
        when(fsrsService.mapSm2ToFsrs(anyInt())).thenReturn(3);
    }

    private VocabReviewSchedule fsrsCard(String vocabId) {
        return VocabReviewSchedule.builder()
                .userId(USER)
                .vocabId(vocabId)
                .german("Wort-" + vocabId)
                .meaning("từ " + vocabId)
                .algorithmVersion(AlgorithmVersion.FSRS.name())
                .stability(BigDecimal.ONE)
                .build();
    }

    @Test
    @DisplayName("batch 3 thẻ → lịch cập nhật từng thẻ, XP award đúng MỘT lần cho cả batch")
    void batchAwardsXpOnce() {
        for (String id : List.of("v1", "v2", "v3")) {
            when(repo.findByUserIdAndVocabId(USER, id)).thenReturn(Optional.of(fsrsCard(id)));
        }
        List<ReviewRequest> reviews = List.of(
                new ReviewRequest("v1", 4), new ReviewRequest("v2", 5), new ReviewRequest("v3", 3));

        List<VocabReviewCard> results = srsService.recordReviewBatch(USER, reviews);

        assertThat(results).hasSize(3);
        verify(repo, times(3)).save(any(VocabReviewSchedule.class));
        verify(xpService, times(1)).awardSrsReviewBatch(USER, 3);
        verify(xpService, never()).awardSrsReview(anyLong());
    }

    @Test
    @DisplayName("XP lỗi không phá kết quả review của batch")
    void xpFailureDoesNotBreakBatch() {
        when(repo.findByUserIdAndVocabId(USER, "v1")).thenReturn(Optional.of(fsrsCard("v1")));
        doThrow(new RuntimeException("xp down")).when(xpService).awardSrsReviewBatch(eq(USER), anyInt());

        List<VocabReviewCard> results =
                srsService.recordReviewBatch(USER, List.of(new ReviewRequest("v1", 4)));

        assertThat(results).hasSize(1);
    }

    @Test
    @DisplayName("review đơn lẻ vẫn award per thẻ như cũ (đường web bấm từng thẻ)")
    void singleReviewStillAwardsPerCard() {
        when(repo.findByUserIdAndVocabId(USER, "v1")).thenReturn(Optional.of(fsrsCard("v1")));

        srsService.recordReview(USER, new ReviewRequest("v1", 4));

        verify(xpService, times(1)).awardSrsReview(USER);
        verify(xpService, never()).awardSrsReviewBatch(anyLong(), anyInt());
    }
}
