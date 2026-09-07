package com.deutschflow.user.service;

import com.deutschflow.speaking.repository.UserGrammarErrorRepository;
import com.deutschflow.user.dto.LearningAnalyticsSummaryDto;
import com.deutschflow.user.dto.LearningAnalyticsSummaryDto.DayStatsDto;
import com.deutschflow.user.entity.LearningAnalytics;
import com.deutschflow.user.repository.LearningAnalyticsRepository;
import com.deutschflow.srs.repository.VocabReviewRepository;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class LearningAnalyticsService {
    private static final org.slf4j.Logger log = org.slf4j.LoggerFactory.getLogger(LearningAnalyticsService.class);

    /**
     * Ranh giới NGÀY của mọi số liệu học tập là ngày lịch Việt Nam, không phải ngày của JVM.
     * Container prod chạy UTC, nên {@code LocalDate.now()} trần đẩy mọi hoạt động từ 00:00–07:00
     * giờ VN về "hôm qua": buổi học sáng sớm rơi sai ô ngày, và khoảng "7 ngày gần nhất" lệch một
     * ngày so với điều người dùng thấy trên lịch của họ. Ghi ({@link #recordDailyStats}) và đọc
     * ({@link #getWeeklySummary}) PHẢI dùng chung một zone, nếu không dữ liệu ghi vào ô này lại
     * được cộng cho ô kia. Cùng quy ước với OrgQuotaService, PaymentTransactionRepository và job
     * retention thông báo — tất cả đều chốt mốc nghiệp vụ theo Asia/Ho_Chi_Minh.
     */
    static final ZoneId BUSINESS_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");

    /** Số ngày của khoảng thống kê: hôm nay và 6 ngày trước đó. */
    static final int SUMMARY_WINDOW_DAYS = 7;

    private final LearningAnalyticsRepository analyticsRepository;
    private final VocabReviewRepository srsRepository;
    private final UserGrammarErrorRepository errorRepository;

    public LearningAnalyticsService(LearningAnalyticsRepository analyticsRepository,
                                    VocabReviewRepository srsRepository,
                                    UserGrammarErrorRepository errorRepository) {
        this.analyticsRepository = analyticsRepository;
        this.srsRepository = srsRepository;
        this.errorRepository = errorRepository;
    }

    public LearningAnalyticsSummaryDto getWeeklySummary(Long userId) {
        LocalDate today = LocalDate.now(BUSINESS_ZONE);
        LocalDate weekStart = today.minusDays(SUMMARY_WINDOW_DAYS - 1L);

        List<LearningAnalytics> rows = analyticsRepository
                .findByUserIdAndAnalyticsDateBetweenOrderByAnalyticsDateAsc(userId, weekStart, today);

        int totalWordsLearned = rows.stream().mapToInt(LearningAnalytics::getWordsLearned).sum();
        int totalWordsReviewed = rows.stream().mapToInt(LearningAnalytics::getWordsReviewed).sum();
        int totalSpeakingMinutes = rows.stream().mapToInt(LearningAnalytics::getSpeakingMinutes).sum();
        int totalSessionsCompleted = rows.stream().mapToInt(LearningAnalytics::getSessionsCompleted).sum();

        // F06: trước đây là countByUserId — TỔNG số thẻ của người dùng, không phải số đến hạn.
        // Cùng lúc đó badge trên màn ôn (SrsController#dueCount → SrsService.countDue) đếm đúng
        // theo next_review_at <= now, nên hai màn hình hiển thị hai con số khác nhau cho cùng một
        // khái niệm "cần ôn". Dùng chung một quy tắc với hàng đợi ôn.
        long wordsDue = srsRepository.countDue(userId, OffsetDateTime.now());

        List<DayStatsDto> weeklyBreakdown = buildWeeklyBreakdown(rows, weekStart, today);

        Map<String, Long> errorsByType = aggregateErrors(userId, weekStart);

        List<String> weakPoints = errorRepository
                .findTopWeakPoints(userId, Pageable.ofSize(5))
                .stream()
                .map(wp -> wp.grammarPoint())
                .collect(Collectors.toList());

        return new LearningAnalyticsSummaryDto(
                weekStart.toString(),
                today.toString(),
                totalWordsLearned,
                totalWordsReviewed,
                totalSpeakingMinutes,
                totalSessionsCompleted,
                wordsDue,
                weeklyBreakdown,
                errorsByType,
                weakPoints
        );
    }

    @Transactional
    public void recordDailyStats(Long userId, int wordsLearned, int wordsReviewed,
                                 int speakingMinutes, int sessionsCompleted,
                                 double avgAccuracy, double avgConfidence) {
        LocalDate today = LocalDate.now(BUSINESS_ZONE);
        LearningAnalytics row = analyticsRepository
                .findByUserIdAndAnalyticsDate(userId, today)
                .orElseGet(() -> LearningAnalytics.builder()
                        .userId(userId)
                        .analyticsDate(today)
                        .build());

        row.setWordsLearned(row.getWordsLearned() + wordsLearned);
        row.setWordsReviewed(row.getWordsReviewed() + wordsReviewed);
        row.setSpeakingMinutes(row.getSpeakingMinutes() + speakingMinutes);
        row.setSessionsCompleted(row.getSessionsCompleted() + sessionsCompleted);
        row.setAvgAccuracy(BigDecimal.valueOf(avgAccuracy));
        row.setAvgConfidence(BigDecimal.valueOf(avgConfidence));
        row.setUpdatedAt(LocalDateTime.now());

        if (row.getCreatedAt() == null) {
            row.setCreatedAt(LocalDateTime.now());
        }

        analyticsRepository.save(row);
    }

    private List<DayStatsDto> buildWeeklyBreakdown(List<LearningAnalytics> rows,
                                                    LocalDate from, LocalDate to) {
        Map<LocalDate, LearningAnalytics> byDate = rows.stream()
                .collect(Collectors.toMap(LearningAnalytics::getAnalyticsDate, r -> r));

        List<DayStatsDto> result = new ArrayList<>();
        for (LocalDate d = from; !d.isAfter(to); d = d.plusDays(1)) {
            LearningAnalytics row = byDate.get(d);
            result.add(new DayStatsDto(
                    d.toString(),
                    row != null ? row.getWordsLearned() : 0,
                    row != null ? row.getWordsReviewed() : 0,
                    row != null ? row.getSpeakingMinutes() : 0
            ));
        }
        return result;
    }

    private Map<String, Long> aggregateErrors(Long userId, LocalDate since) {
        List<Object[]> raw = errorRepository.aggregateErrorGroups(userId, since.atStartOfDay());
        Map<String, Long> result = new LinkedHashMap<>();
        for (Object[] row : raw) {
            String code = row[0] != null ? row[0].toString() : "UNKNOWN";
            long count = row[1] instanceof Number n ? n.longValue() : 0L;
            result.put(code, count);
        }
        return result;
    }
}
