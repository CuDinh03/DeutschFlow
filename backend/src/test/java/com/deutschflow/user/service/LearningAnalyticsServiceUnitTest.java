package com.deutschflow.user.service;

import com.deutschflow.speaking.repository.UserGrammarErrorRepository;
import com.deutschflow.srs.repository.VocabReviewRepository;
import com.deutschflow.user.dto.LearningAnalyticsSummaryDto;
import com.deutschflow.user.repository.LearningAnalyticsRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Pageable;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * G1.2 (F05, F06) — hai sai lệch làm số liệu học tập nói sai điều nó đang đếm.
 *
 * <p>F06 là sai lệch VỀ GIÁ TRỊ, không phải nhãn: `wordsDueForReview` lấy {@code countByUserId}
 * (TỔNG số thẻ), trong khi badge trên màn ôn ({@code SrsController#dueCount} → {@code SrsService.countDue})
 * đếm theo {@code next_review_at <= now}. Cùng một khái niệm "cần ôn", hai màn hình hai con số —
 * và con số ở trang thống kê luôn lớn hơn hoặc bằng, nên người học tưởng còn nợ nhiều hơn thực tế.
 *
 * <p>F05 là ranh giới ngày: container prod chạy UTC nên {@code LocalDate.now()} trần đẩy hoạt động
 * từ 00:00–07:00 giờ VN về hôm qua. Ngày phải chốt theo lịch Việt Nam, và khoảng thống kê phải đi
 * kèm payload để giao diện không tự suy từ đồng hồ máy khách.
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("LearningAnalyticsService — số liệu học tập")
class LearningAnalyticsServiceUnitTest {

    @Mock
    private LearningAnalyticsRepository analyticsRepository;
    @Mock
    private VocabReviewRepository srsRepository;
    @Mock
    private UserGrammarErrorRepository errorRepository;

    @InjectMocks
    private LearningAnalyticsService service;

    private static final long USER_ID = 42L;

    private void stubEmptyHistory() {
        when(analyticsRepository.findByUserIdAndAnalyticsDateBetweenOrderByAnalyticsDateAsc(anyLong(), any(), any()))
                .thenReturn(List.of());
        when(errorRepository.aggregateErrorGroups(anyLong(), any())).thenReturn(List.of());
        when(errorRepository.findTopWeakPoints(anyLong(), any(Pageable.class))).thenReturn(List.of());
    }

    @Test
    @DisplayName("F06/D04: 10 thẻ nhưng chỉ 3 đến hạn → wordsDueForReview = 3, KHÔNG phải 10")
    void wordsDue_usesDueQueueRule_notTotalCardCount() {
        stubEmptyHistory();
        // Kho có 10 thẻ; hàng đợi ôn tại thời điểm này chỉ 3 thẻ đến hạn.
        when(srsRepository.countDue(eq(USER_ID), any(OffsetDateTime.class))).thenReturn(3L);

        LearningAnalyticsSummaryDto summary = service.getWeeklySummary(USER_ID);

        assertThat(summary.wordsDueForReview()).isEqualTo(3L);
        // Quy tắc cũ không được dùng nữa: nó trả 10 và làm lệch khỏi badge màn ôn.
        verify(srsRepository, never()).countByUserId(anyLong());
    }

    @Test
    @DisplayName("F05: khoảng thống kê là 7 ngày gồm hôm nay, chốt theo ngày lịch Việt Nam")
    void summaryRange_isSevenVietnamCalendarDays() {
        stubEmptyHistory();
        when(srsRepository.countDue(anyLong(), any(OffsetDateTime.class))).thenReturn(0L);

        LearningAnalyticsSummaryDto summary = service.getWeeklySummary(USER_ID);

        LocalDate todayVn = LocalDate.now(LearningAnalyticsService.BUSINESS_ZONE);
        assertThat(summary.rangeEnd()).isEqualTo(todayVn.toString());
        assertThat(summary.rangeStart()).isEqualTo(todayVn.minusDays(6).toString());
        // Đúng 7 ngày, không phải "tuần lịch" (không phụ thuộc hôm nay là thứ mấy).
        assertThat(LocalDate.parse(summary.rangeStart()).datesUntil(LocalDate.parse(summary.rangeEnd()).plusDays(1)).count())
                .isEqualTo(LearningAnalyticsService.SUMMARY_WINDOW_DAYS);
    }

    @Test
    @DisplayName("F05: khoảng truy vấn gửi xuống repository trùng khoảng công bố trong payload")
    void queryRange_matchesPublishedRange() {
        stubEmptyHistory();
        when(srsRepository.countDue(anyLong(), any(OffsetDateTime.class))).thenReturn(0L);

        LearningAnalyticsSummaryDto summary = service.getWeeklySummary(USER_ID);

        // Nếu hai thứ này lệch nhau thì giao diện ghi một khoảng, còn số liệu cộng từ khoảng khác.
        verify(analyticsRepository).findByUserIdAndAnalyticsDateBetweenOrderByAnalyticsDateAsc(
                eq(USER_ID),
                eq(LocalDate.parse(summary.rangeStart())),
                eq(LocalDate.parse(summary.rangeEnd())));
    }

    @Test
    @DisplayName("weeklyBreakdown luôn đủ 7 ô ngày, ngày không có dữ liệu là 0 chứ không bị khuyết")
    void breakdown_hasOneCellPerDay() {
        stubEmptyHistory();
        when(srsRepository.countDue(anyLong(), any(OffsetDateTime.class))).thenReturn(0L);

        LearningAnalyticsSummaryDto summary = service.getWeeklySummary(USER_ID);

        assertThat(summary.weeklyBreakdown()).hasSize(LearningAnalyticsService.SUMMARY_WINDOW_DAYS);
        assertThat(summary.weeklyBreakdown().get(0).date()).isEqualTo(summary.rangeStart());
        assertThat(summary.weeklyBreakdown().get(6).date()).isEqualTo(summary.rangeEnd());
    }
}
