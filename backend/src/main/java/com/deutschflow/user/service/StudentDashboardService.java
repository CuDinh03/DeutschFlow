package com.deutschflow.user.service;

import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.user.dto.StudentDashboardResponse;
import com.deutschflow.user.entity.LearningPlan;
import com.deutschflow.user.entity.LearningSessionAttempt;
import com.deutschflow.user.entity.LearningSessionProgress;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.LearningPlanRepository;
import com.deutschflow.user.repository.LearningSessionAttemptRepository;
import com.deutschflow.user.repository.LearningSessionProgressRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
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

        int streakDays = computeStreakDays(completionDays, today);

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
     * Chuỗi ngày có ít nhất một buổi hoàn thành; nếu hôm nay và hôm qua đều không học thì streak = 0.
     */
    private static int computeStreakDays(Set<LocalDate> completionDays, LocalDate today) {
        if (completionDays.isEmpty()) {
            return 0;
        }
        boolean todayOk = completionDays.contains(today);
        boolean yesterdayOk = completionDays.contains(today.minusDays(1));
        if (!todayOk && !yesterdayOk) {
            return 0;
        }
        LocalDate anchor = todayOk ? today : today.minusDays(1);
        int streak = 0;
        while (completionDays.contains(anchor)) {
            streak++;
            anchor = anchor.minusDays(1);
        }
        return streak;
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
