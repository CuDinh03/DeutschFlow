package com.deutschflow.user.service;

import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.user.dto.StudentDashboardResponse;
import com.deutschflow.user.dto.StudentStatsResponse;
import com.deutschflow.user.entity.LearningPlan;
import com.deutschflow.user.entity.LearningSessionAttempt;
import com.deutschflow.user.entity.LearningSessionProgress;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.LearningPlanRepository;
import com.deutschflow.user.repository.LearningSessionAttemptRepository;
import com.deutschflow.user.repository.LearningSessionProgressRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class StudentDashboardService {

    private final LearningPlanRepository planRepository;
    private final LearningSessionProgressRepository progressRepository;
    private final LearningSessionAttemptRepository attemptRepository;
    private final ObjectMapper objectMapper;
    private final JdbcTemplate jdbcTemplate;

    @Transactional(readOnly = true)
    public StudentDashboardResponse getDashboard(User user) {
        LearningPlan plan = planRepository.findByUserId(user.getId())
                .orElseThrow(() -> new NotFoundException("Learning plan not found"));

        int sessionsPerWeek = plan.getSessionsPerWeek();
        int minutesPerSession = plan.getMinutesPerSession();
        int weeklyTargetMinutes = plan.getWeeklyMinutes();
        int weeksTotal = plan.getWeeksTotal();

        int totalSessionsInPlan = countSessionsInPlanJson(plan.getPlanJson());
        if (totalSessionsInPlan <= 0) {
            totalSessionsInPlan = Math.max(1, Math.min(weeksTotal, 12) * Math.max(1, sessionsPerWeek));
        }

        long completedTotal = progressRepository.countByUserIdAndStatus(user.getId(), LearningSessionProgress.Status.COMPLETED);

        LocalDate today = LocalDate.now();
        LocalDate monday = today.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        LocalDateTime weekStart = monday.atStartOfDay();
        LocalDateTime weekEndExclusive = monday.plusWeeks(1).atStartOfDay();

        List<LearningSessionProgress> withTs = progressRepository.findCompletedWithTimestampByUserId(user.getId());
        Set<LocalDate> completionDays = new HashSet<>();
        for (LearningSessionProgress p : withTs) {
            if (p.getCompletedAt() != null) {
                completionDays.add(p.getCompletedAt().toLocalDate());
            }
        }

        int streakDays = computeStreakDaysDb(user.getId());

        int[] dayMinutes = new int[7];
        int weeklyDone = 0;
        for (LearningSessionProgress p : withTs) {
            if (p.getCompletedAt() == null) continue;
            LocalDate d = p.getCompletedAt().toLocalDate();
            if (d.isBefore(monday) || !d.isBefore(monday.plusWeeks(1))) continue;
            int idx = (int) (d.toEpochDay() - monday.toEpochDay());
            if (idx >= 0 && idx < 7) {
                dayMinutes[idx] += minutesPerSession;
                weeklyDone++;
            }
        }

        int weeklyMinutesStudied = 0;
        for (int m : dayMinutes) {
            weeklyMinutesStudied += m;
        }

        int avgPerDay = (int) Math.round(weeklyMinutesStudied / 7.0);

        List<LearningSessionAttempt> attemptsWeek = attemptRepository
                .findByUserIdAndCreatedAtGreaterThanEqualAndCreatedAtLessThanOrderByCreatedAtAsc(
                        user.getId(), weekStart, weekEndExclusive);

        int weeklyXp = computeWeeklyXp(attemptsWeek, weeklyDone);

        int progressPercent = totalSessionsInPlan > 0
                ? (int) Math.min(100, Math.round((completedTotal * 100.0) / totalSessionsInPlan))
                : 0;

        List<Integer> chart = new ArrayList<>(7);
        for (int i = 0; i < 7; i++) {
            chart.add(dayMinutes[i]);
        }

        return new StudentDashboardResponse(
                streakDays,
                weeklyXp,
                completedTotal,
                weeklyDone,
                chart,
                weeklyMinutesStudied,
                avgPerDay,
                progressPercent,
                sessionsPerWeek,
                minutesPerSession,
                weeklyTargetMinutes,
                weeksTotal,
                totalSessionsInPlan
        );
    }

    private static int computeWeeklyXp(List<LearningSessionAttempt> attemptsWeek, int completedSessionsThisWeek) {
        Map<String, Integer> bestBySession = new HashMap<>();
        for (LearningSessionAttempt a : attemptsWeek) {
            String key = a.getWeekNumber() + ":" + a.getSessionIndex();
            bestBySession.merge(key, a.getScorePercent(), Math::max);
        }
        int sumScores = bestBySession.values().stream().mapToInt(Integer::intValue).sum();
        return sumScores + completedSessionsThisWeek * 20;
    }

    /**
     * Mobile-optimised stats endpoint — returns aggregated lifetime and weekly metrics.
     */
    @Transactional(readOnly = true)
    public StudentStatsResponse getStats(User user) {
        Long userId = user.getId();

        int streakDays = computeStreakDaysDb(userId);

        long totalXp = 0L;
        try {
            Long raw = jdbcTemplate.queryForObject(
                    "SELECT COALESCE(SUM(xp_amount), 0) FROM user_xp_events WHERE user_id = ?",
                    Long.class, userId);
            if (raw != null) totalXp = raw;
        } catch (Exception ignored) { }

        int xpLevel = (int) Math.sqrt(totalXp / 100.0);

        int wordsLearned = 0;
        try {
            Integer raw = jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM spaced_repetition_schedule WHERE user_id = ? AND retention_status = 'MASTERED'",
                    Integer.class, userId);
            if (raw != null) wordsLearned = raw;
        } catch (Exception ignored) { }

        int speakingMinutes = 0;
        try {
            Integer raw = jdbcTemplate.queryForObject(
                    """
                    SELECT COALESCE(
                        SUM(EXTRACT(EPOCH FROM (ended_at - started_at)) / 60), 0
                    )::INTEGER
                    FROM ai_speaking_sessions
                    WHERE user_id = ? AND status = 'COMPLETED' AND ended_at IS NOT NULL
                    """,
                    Integer.class, userId);
            if (raw != null) speakingMinutes = raw;
        } catch (Exception ignored) { }

        int grammarAccuracy = 100;
        try {
            Integer errors = jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM user_grammar_errors WHERE user_id = ? AND created_at > NOW() - INTERVAL '30 days'",
                    Integer.class, userId);
            if (errors != null) {
                grammarAccuracy = Math.max(0, 100 - Math.min(100, errors / 2));
            }
        } catch (Exception ignored) { }

        int[] weeklyProgress = computeWeeklyProgress(userId);

        return new StudentStatsResponse(
                streakDays, totalXp, xpLevel, wordsLearned,
                speakingMinutes, grammarAccuracy, weeklyProgress);
    }

    /**
     * Minutes studied per day for the current ISO week (Mon=0 … Sun=6).
     * Uses completed learning sessions; each session counts as 25 minutes.
     */
    private int[] computeWeeklyProgress(Long userId) {
        int[] days = new int[7];
        try {
            LocalDate monday = LocalDate.now().with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
            List<Map<String, Object>> rows = jdbcTemplate.queryForList(
                    """
                    SELECT DATE(completed_at) AS day
                    FROM learning_session_progress
                    WHERE user_id = ? AND status = 'COMPLETED'
                      AND completed_at >= ? AND completed_at < ?
                    """,
                    userId,
                    java.sql.Date.valueOf(monday),
                    java.sql.Date.valueOf(monday.plusWeeks(1)));
            for (Map<String, Object> row : rows) {
                Object dayVal = row.get("day");
                if (dayVal != null) {
                    java.time.LocalDate d = ((java.sql.Date) dayVal).toLocalDate();
                    int idx = (int) (d.toEpochDay() - monday.toEpochDay());
                    if (idx >= 0 && idx < 7) {
                        days[idx] += 25; // 25 min per completed session
                    }
                }
            }
        } catch (Exception ignored) { }
        return days;
    }

    /**
     * Chuỗi ngày có ít nhất 2 bài tập hoàn thành (2 xp events).
     */
    private int computeStreakDaysDb(Long userId) {
        try {
            List<java.sql.Date> dates = jdbcTemplate.queryForList(
                    """
                    SELECT d FROM (
                        SELECT DATE(created_at) AS d, COUNT(*) as cnt 
                        FROM user_xp_events
                        WHERE user_id = ? 
                        GROUP BY DATE(created_at)
                    ) sub WHERE cnt >= 2 ORDER BY d DESC LIMIT 60
                    """, java.sql.Date.class, userId);
            if (dates.isEmpty()) return 0;

            java.time.LocalDate prev = java.time.LocalDate.now();
            if (!dates.contains(java.sql.Date.valueOf(prev))) {
                prev = prev.minusDays(1);
            }
            int streak = 0;
            for (java.sql.Date d : dates) {
                java.time.LocalDate ld = d.toLocalDate();
                if (ld.equals(prev)) {
                    streak++;
                    prev = prev.minusDays(1);
                } else if (ld.isBefore(prev)) {
                    break;
                }
            }
            return streak;
        } catch (Exception e) {
            return 0;
        }
    }

    private int countSessionsInPlanJson(String planJson) {
        if (planJson == null || planJson.isBlank()) {
            return 0;
        }
        try {
            var root = objectMapper.readTree(planJson);
            var weeks = root.path("weeks");
            if (!weeks.isArray()) {
                return 0;
            }
            int n = 0;
            for (var w : weeks) {
                var sessions = w.path("sessions");
                if (sessions.isArray()) {
                    n += sessions.size();
                }
            }
            return n;
        } catch (Exception e) {
            return 0;
        }
    }
}
