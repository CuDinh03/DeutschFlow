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
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class LearningAnalyticsService {
    private static final org.slf4j.Logger log = org.slf4j.LoggerFactory.getLogger(LearningAnalyticsService.class);

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
        LocalDate today = LocalDate.now();
        LocalDate weekStart = today.minusDays(6);

        List<LearningAnalytics> rows = analyticsRepository
                .findByUserIdAndAnalyticsDateBetweenOrderByAnalyticsDateAsc(userId, weekStart, today);

        int totalWordsLearned = rows.stream().mapToInt(LearningAnalytics::getWordsLearned).sum();
        int totalWordsReviewed = rows.stream().mapToInt(LearningAnalytics::getWordsReviewed).sum();
        int totalSpeakingMinutes = rows.stream().mapToInt(LearningAnalytics::getSpeakingMinutes).sum();
        int totalSessionsCompleted = rows.stream().mapToInt(LearningAnalytics::getSessionsCompleted).sum();

        long wordsDue = srsRepository.countByUserId(userId);

        List<DayStatsDto> weeklyBreakdown = buildWeeklyBreakdown(rows, weekStart, today);

        Map<String, Long> errorsByType = aggregateErrors(userId, weekStart);

        List<String> weakPoints = errorRepository
                .findTopWeakPoints(userId, Pageable.ofSize(5))
                .stream()
                .map(wp -> wp.grammarPoint())
                .collect(Collectors.toList());

        return new LearningAnalyticsSummaryDto(
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
        LocalDate today = LocalDate.now();
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
