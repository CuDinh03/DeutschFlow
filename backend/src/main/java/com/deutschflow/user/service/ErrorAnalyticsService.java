package com.deutschflow.user.service;

import com.deutschflow.speaking.repository.UserGrammarErrorRepository;
import com.deutschflow.user.dto.ErrorAnalyticsDto;
import com.deutschflow.user.dto.ErrorAnalyticsDto.CommonErrorDto;
import com.deutschflow.user.dto.ErrorAnalyticsDto.DailyErrorCountDto;
import com.deutschflow.user.dto.ErrorAnalyticsDto.WeakAreaDto;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class ErrorAnalyticsService {

    private final UserGrammarErrorRepository errorRepository;

    public ErrorAnalyticsService(UserGrammarErrorRepository errorRepository) {
        this.errorRepository = errorRepository;
    }

    @Transactional(readOnly = true)
    public ErrorAnalyticsDto getErrorAnalytics(Long userId) {
        LocalDateTime weekAgo = LocalDate.now().minusDays(6).atStartOfDay();
        LocalDateTime thirtyDaysAgo = LocalDate.now().minusDays(29).atStartOfDay();

        List<CommonErrorDto> mostCommonErrors = buildCommonErrors(userId, weekAgo);
        List<DailyErrorCountDto> errorTrend = buildDailyTrend(userId, thirtyDaysAgo);
        List<WeakAreaDto> weakAreas = buildWeakAreas(userId, weekAgo);

        int totalThisWeek = mostCommonErrors.stream().mapToInt(e -> (int) e.count()).sum();
        long openErrors = errorRepository.countByUserIdAndRepairStatus(userId, "OPEN");

        return new ErrorAnalyticsDto(
                mostCommonErrors,
                errorTrend,
                weakAreas,
                totalThisWeek,
                (int) openErrors
        );
    }

    private List<CommonErrorDto> buildCommonErrors(Long userId, LocalDateTime since) {
        List<Object[]> rows = errorRepository.findTopErrorsWithExamples(userId, since, Pageable.ofSize(8));
        List<CommonErrorDto> result = new ArrayList<>();
        for (Object[] row : rows) {
            String code = (String) row[0];
            long count = ((Number) row[1]).longValue();
            String wrongSpan = row[2] != null ? (String) row[2] : "";
            String correctedSpan = row[3] != null ? (String) row[3] : "";
            String severity = row[4] != null ? (String) row[4] : "MINOR";
            result.add(new CommonErrorDto(code, formatLabel(code), count, wrongSpan, correctedSpan, severity));
        }
        return result;
    }

    private List<DailyErrorCountDto> buildDailyTrend(Long userId, LocalDateTime since) {
        List<Object[]> rows = errorRepository.countDailyErrorsSince(userId, since);
        Map<String, Long> byDate = new LinkedHashMap<>();
        for (Object[] row : rows) {
            String date = row[0].toString().substring(0, 10);
            long count = ((Number) row[1]).longValue();
            byDate.put(date, count);
        }

        // Fill gaps with zeros for a continuous 30-day window
        List<DailyErrorCountDto> trend = new ArrayList<>();
        LocalDate start = since.toLocalDate();
        LocalDate today = LocalDate.now();
        for (LocalDate d = start; !d.isAfter(today); d = d.plusDays(1)) {
            String key = d.format(DateTimeFormatter.ISO_LOCAL_DATE);
            trend.add(new DailyErrorCountDto(key, byDate.getOrDefault(key, 0L)));
        }
        return trend;
    }

    private List<WeakAreaDto> buildWeakAreas(Long userId, LocalDateTime since) {
        List<Object[]> rows = errorRepository.aggregateErrorGroups(userId, since);
        List<WeakAreaDto> result = new ArrayList<>();
        for (Object[] row : rows) {
            if (result.size() >= 6) break;
            String code = (String) row[0];
            long count = ((Number) row[1]).longValue();
            String priority = count >= 5 ? "HIGH" : count >= 3 ? "MEDIUM" : "LOW";
            result.add(new WeakAreaDto(code, formatLabel(code), count, priority));
        }
        return result;
    }

    private String formatLabel(String code) {
        if (code == null) return "";
        String spaced = code.replace('.', ' ').replace('_', ' ').toLowerCase();
        String[] words = spaced.split(" ");
        StringBuilder sb = new StringBuilder();
        for (String w : words) {
            if (!w.isEmpty()) {
                if (!sb.isEmpty()) sb.append(' ');
                sb.append(Character.toUpperCase(w.charAt(0)));
                if (w.length() > 1) sb.append(w.substring(1));
            }
        }
        return sb.toString();
    }
}
