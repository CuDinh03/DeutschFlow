package com.deutschflow.user.dto;

import java.util.List;

/**
 * Aggregated stats for the student dashboard from DB (progress + attempts + plan).
 */
public record StudentDashboardResponse(
        int streakDays,
        /** XP tuần hiện tại: điểm quiz tốt nhất mỗi buổi (trong tuần) + thưởng hoàn thành */
        int weeklyXp,
        long completedSessionsTotal,
        int completedSessionsThisWeek,
        /** ISO week: Mon..Sun, 7 phần tử (phút đã học mỗi ngày) */
        List<Integer> weeklyMinutesByDay,
        int weeklyMinutesStudied,
        /** Trung bình phút/ngày trong 7 ngày tuần này (làm tròn) */
        int avgMinutesPerDayThisWeek,
        /** 0–100: buổi đã hoàn thành / tổng buổi trong plan (materialized weeks) */
        int planProgressPercent,
        int sessionsPerWeek,
        int minutesPerSession,
        int weeklyTargetMinutes,
        int weeksTotal,
        int totalSessionsInPlan
) {}
