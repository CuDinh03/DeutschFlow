package com.deutschflow.admin.service;

import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.common.telemetry.ApiTelemetryService;
import com.deutschflow.common.quota.QuotaService;
import com.deutschflow.user.service.PersonalizationRulesetService;
import com.deutschflow.vocabulary.service.WordQueryService;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.time.LocalDate;
import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.time.Instant;
import java.time.format.DateTimeParseException;

@Service
@RequiredArgsConstructor
public class AdminManagementService {
    private final JdbcTemplate jdbcTemplate;
    private final UserRepository userRepository;
    private final ObjectMapper objectMapper;
    private final ApiTelemetryService apiTelemetryService;
    private final WordQueryService wordQueryService;
    private final PersonalizationRulesetService personalizationRulesetService;
    private final QuotaService quotaService;

    @Transactional(readOnly = true)
    public Map<String, Object> overview() {
        Integer users = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM users", Integer.class);
        Integer teachers = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM users WHERE role = 'TEACHER'", Integer.class);
        Integer students = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM users WHERE role = 'STUDENT'", Integer.class);
        Integer classes = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM classrooms", Integer.class);
        Integer quizzes = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM quizzes", Integer.class);
        Integer activeQuizzes = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM quizzes WHERE status = 'ACTIVE'", Integer.class);
        Double avgQuizScore = jdbcTemplate.queryForObject("SELECT AVG(total_score) FROM quiz_sessions", Double.class);

        // Vocabulary statistics
        Integer totalWords = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM words", Integer.class);
        Integer wordsWithMeaning = jdbcTemplate.queryForObject("""
                SELECT COUNT(DISTINCT w.id) 
                FROM words w 
                JOIN word_translations wt ON wt.word_id = w.id 
                WHERE wt.meaning IS NOT NULL 
                  AND TRIM(wt.meaning) <> '' 
                  AND LOWER(wt.meaning) NOT LIKE 'not in wordlists/local_lexicon.tsv%'
                  AND LOWER(wt.meaning) NOT LIKE 'chưa có trong wordlists/local_lexicon.tsv%'
                """, Integer.class);
        Integer wordsNeedingEnrichment = jdbcTemplate.queryForObject("""
                SELECT COUNT(DISTINCT w.id)
                FROM words w
                WHERE NOT EXISTS (
                  SELECT 1 FROM word_translations wt 
                  WHERE wt.word_id = w.id 
                    AND wt.locale = 'en' 
                    AND wt.meaning IS NOT NULL 
                    AND TRIM(wt.meaning) <> ''
                    AND LOWER(wt.meaning) NOT LIKE 'not in wordlists/local_lexicon.tsv%'
                    AND LOWER(wt.meaning) NOT LIKE 'chưa có trong wordlists/local_lexicon.tsv%'
                )
                """, Integer.class);

        return Map.of(
                "userCount", users == null ? 0 : users,
                "teacherCount", teachers == null ? 0 : teachers,
                "studentCount", students == null ? 0 : students,
                "classCount", classes == null ? 0 : classes,
                "quizCount", quizzes == null ? 0 : quizzes,
                "activeQuizCount", activeQuizzes == null ? 0 : activeQuizzes,
                "avgQuizScore", avgQuizScore == null ? 0.0 : avgQuizScore,
                "totalWords", totalWords == null ? 0 : totalWords,
                "wordsWithMeaning", wordsWithMeaning == null ? 0 : wordsWithMeaning,
                "wordsNeedingEnrichment", wordsNeedingEnrichment == null ? 0 : wordsNeedingEnrichment
        );
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> listUsers() {
        List<Map<String, Object>> users = jdbcTemplate.queryForList("""
                SELECT id, email, display_name AS displayName, role, is_active AS isActive, created_at AS createdAt
                FROM users
                ORDER BY created_at DESC
                """);
        for (Map<String, Object> u : users) {
            long userId = toLong(u.get("id"));
            try {
                var snap = quotaService.getSnapshot(userId, Instant.now());
                u.put("planCode", snap.planCode());
                u.put("monthlyTokenLimit", snap.monthlyTokenLimit());
                u.put("dailyTokenGrant", snap.dailyTokenGrant());
                u.put("usedThisMonth", snap.usedThisMonth());
                u.put("remainingThisMonth", snap.remainingThisMonth());
                u.put("walletBalance", snap.walletBalance());
                u.put("walletCap", snap.walletCap());
                u.put("unlimitedInternal", snap.unlimitedInternal());
                u.put("quotaPeriodStartUtc", snap.periodStartUtc());
                u.put("quotaPeriodEndUtc", snap.periodEndUtc());
                u.put("subscriptionStartsAtUtc", snap.subscriptionStartsAtUtc());
                u.put("subscriptionEndsAtUtc", snap.subscriptionEndsAtUtc());
            } catch (Exception ignored) {
                // keep base user row even if quota lookup fails
            }
        }
        return users;
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> listPlans() {
        return jdbcTemplate.queryForList("""
                SELECT code, name,
                       monthly_token_limit AS monthlyTokenLimit,
                       daily_token_grant AS dailyTokenGrant,
                       wallet_cap_days AS walletCapDays,
                       features_json AS featuresJson,
                       is_active AS isActive,
                       created_at AS createdAt
                FROM subscription_plans
                ORDER BY code ASC
                """);
    }

    @Transactional
    public Map<String, Object> updateUserPlan(Long userId,
                                              String planCode,
                                              Long monthlyTokenLimitOverride,
                                              String startsAtIso,
                                              String endsAtIso) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new NotFoundException("User not found"));
        String code = planCode == null ? "" : planCode.trim().toUpperCase();
        if (code.isBlank()) {
            throw new BadRequestException("planCode is required");
        }
        Integer exists = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM subscription_plans WHERE code = ?",
                Integer.class, code);
        if (exists == null || exists <= 0) {
            throw new BadRequestException("Invalid planCode");
        }

        Instant now = Instant.now();
        Instant startsAt = parseInstantOrDefault(startsAtIso, now);
        Instant endsAt = endsAtIso == null || endsAtIso.isBlank() ? null : parseInstantOrDefault(endsAtIso, null);

        // End existing ACTIVE subscriptions by setting ends_at = startsAt and status=ENDED.
        jdbcTemplate.update("""
                UPDATE user_subscriptions
                SET status = 'ENDED', ends_at = ?, updated_at = NOW()
                WHERE user_id = ? AND status = 'ACTIVE'
                """, Timestamp.from(startsAt), userId);

        jdbcTemplate.update("""
                INSERT INTO user_subscriptions (
                  user_id, plan_code, status, starts_at, ends_at, monthly_token_limit_override
                ) VALUES (?, ?, 'ACTIVE', ?, ?, ?)
                """,
                userId, code,
                Timestamp.from(startsAt),
                endsAt == null ? null : Timestamp.from(endsAt),
                monthlyTokenLimitOverride
        );

        jdbcTemplate.update("DELETE FROM user_ai_token_wallets WHERE user_id = ?", userId);

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("id", user.getId());
        out.put("email", user.getEmail());
        out.put("displayName", user.getDisplayName());
        out.put("planCode", code);
        out.put("monthlyTokenLimitOverride", monthlyTokenLimitOverride);
        out.put("startsAtUtc", startsAt);
        out.put("endsAtUtc", endsAt);
        return out;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> userQuota(Long userId) {
        userRepository.findById(userId).orElseThrow(() -> new NotFoundException("User not found"));
        var snap = quotaService.getSnapshot(userId, Instant.now());
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("userId", userId);
        out.put("planCode", snap.planCode());
        out.put("unlimitedInternal", snap.unlimitedInternal());
        out.put("dailyTokenGrant", snap.dailyTokenGrant());
        out.put("usedToday", snap.usedToday());
        out.put("walletBalance", snap.walletBalance());
        out.put("walletCap", snap.walletCap());
        out.put("monthlyTokenLimit", snap.monthlyTokenLimit());
        out.put("usedThisMonth", snap.usedThisMonth());
        out.put("remainingThisMonth", snap.remainingThisMonth());
        out.put("periodStartUtc", snap.periodStartUtc());
        out.put("periodEndUtc", snap.periodEndUtc());
        out.put("subscriptionStartsAtUtc", snap.subscriptionStartsAtUtc());
        out.put("subscriptionEndsAtUtc", snap.subscriptionEndsAtUtc());
        return out;
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> userUsage(Long userId, String fromIso, String toIso, Integer limit) {
        userRepository.findById(userId).orElseThrow(() -> new NotFoundException("User not found"));
        Instant now = Instant.now();
        Instant from = parseInstantOrDefault(fromIso, now.minusSeconds(7L * 86400L));
        Instant to = parseInstantOrDefault(toIso, now);
        int cap = (limit == null || limit < 1) ? 200 : Math.min(limit, 2000);
        return jdbcTemplate.queryForList("""
                SELECT id, user_id AS userId, provider, model,
                       prompt_tokens AS promptTokens,
                       completion_tokens AS completionTokens,
                       total_tokens AS totalTokens,
                       feature, request_id AS requestId, session_id AS sessionId,
                       created_at AS createdAt
                FROM ai_token_usage_events
                WHERE user_id = ?
                  AND created_at >= ?
                  AND created_at <= ?
                ORDER BY created_at DESC
                LIMIT ?
                """, userId, Timestamp.from(from), Timestamp.from(to), cap);
    }

    @Transactional
    public Map<String, Object> updateUserRole(Long userId, String role) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new NotFoundException("User not found"));
        String normalized = role == null ? "" : role.trim().toUpperCase();
        if (!List.of("ADMIN", "TEACHER", "STUDENT").contains(normalized)) {
            throw new BadRequestException("Invalid role");
        }
        user.setRole(User.Role.valueOf(normalized));
        userRepository.save(user);
        return Map.of(
                "id", user.getId(),
                "email", user.getEmail(),
                "displayName", user.getDisplayName(),
                "role", user.getRole().name()
        );
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> listClasses() {
        return jdbcTemplate.queryForList("""
                SELECT c.id, c.name, c.teacher_id AS teacherId, u.display_name AS teacherName, c.created_at AS createdAt,
                       (SELECT COUNT(*) FROM classroom_students cs WHERE cs.classroom_id = c.id) AS studentCount
                FROM classrooms c
                JOIN users u ON u.id = c.teacher_id
                ORDER BY c.created_at DESC
                """);
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> studentPlanProgress() {
        List<Map<String, Object>> rows = jdbcTemplate.queryForList("""
                SELECT
                  u.id AS studentId,
                  u.display_name AS name,
                  lp.plan_json AS planJson,
                  COALESCE(c.completedSessions, 0) AS completedSessions,
                  lc.week_number AS lastCompletedWeek,
                  lc.session_index AS lastCompletedSession,
                  CASE
                    WHEN c.lastCompletedAt IS NULL THEN a.lastAttemptAt
                    WHEN a.lastAttemptAt IS NULL THEN c.lastCompletedAt
                    ELSE GREATEST(c.lastCompletedAt, a.lastAttemptAt)
                  END AS lastStudyAt
                FROM users u
                LEFT JOIN learning_plans lp
                  ON lp.user_id = u.id
                LEFT JOIN (
                  SELECT
                    p.user_id,
                    COUNT(*) AS completedSessions,
                    MAX(p.completed_at) AS lastCompletedAt
                  FROM learning_session_progress p
                  WHERE p.status = 'COMPLETED'
                  GROUP BY p.user_id
                ) c
                  ON c.user_id = u.id
                LEFT JOIN (
                  SELECT p.user_id, p.week_number, p.session_index
                  FROM learning_session_progress p
                  INNER JOIN (
                    SELECT user_id, MAX(week_number * 1000 + session_index) AS mx
                    FROM learning_session_progress
                    WHERE status = 'COMPLETED'
                    GROUP BY user_id
                  ) m
                    ON m.user_id = p.user_id
                   AND (p.week_number * 1000 + p.session_index) = m.mx
                  WHERE p.status = 'COMPLETED'
                ) lc
                  ON lc.user_id = u.id
                LEFT JOIN (
                  SELECT user_id, MAX(created_at) AS lastAttemptAt
                  FROM learning_session_attempts
                  GROUP BY user_id
                ) a
                  ON a.user_id = u.id
                WHERE u.role = 'STUDENT'
                ORDER BY u.display_name ASC, u.id ASC
                """);

        List<Map<String, Object>> result = new ArrayList<>(rows.size());
        for (Map<String, Object> row : rows) {
            long studentId = toLong(row.get("studentId"));
            String name = String.valueOf(row.getOrDefault("name", ""));
            long completedSessions = toLong(row.get("completedSessions"));
            int totalSessions = countSessionsInPlanJson((String) row.get("planJson"));
            int sessionsPerWeek = extractSessionsPerWeek((String) row.get("planJson"));

            int currentWeek = 1;
            int currentSessionIndex = 1;
            Integer lastCompletedWeek = toIntOrNull(row.get("lastCompletedWeek"));
            Integer lastCompletedSession = toIntOrNull(row.get("lastCompletedSession"));
            if (lastCompletedWeek != null && lastCompletedSession != null && sessionsPerWeek > 0) {
                int nextWeek = lastCompletedWeek;
                int nextSession = lastCompletedSession + 1;
                if (nextSession > sessionsPerWeek) {
                    nextWeek++;
                    nextSession = 1;
                }
                currentWeek = nextWeek;
                currentSessionIndex = nextSession;
            }

            int progressPercent = totalSessions > 0
                    ? (int) Math.min(100, Math.round((completedSessions * 100.0) / totalSessions))
                    : 0;

            Map<String, Object> item = new LinkedHashMap<>();
            item.put("studentId", studentId);
            item.put("name", name);
            item.put("currentWeek", currentWeek);
            item.put("currentSessionIndex", currentSessionIndex);
            item.put("completedSessions", completedSessions);
            item.put("planProgressPercent", progressPercent);
            item.put("lastStudyAt", row.get("lastStudyAt"));
            result.add(item);
        }
        return result;
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> apiTelemetrySummary(int days) {
        return apiTelemetryService.latencyErrorSummary(days);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> apiTelemetryPercentiles(int days, String endpoint) {
        return apiTelemetryService.latencyPercentiles(days, endpoint);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> vocabularyQualityDaily(int days) {
        Map<String, Object> report = new LinkedHashMap<>();
        report.put("nounGenderCoverage", wordQueryService.coverageHistory(days));
        report.put("translationCoverage", wordQueryService.translationCoverageHistory(days));
        return report;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> personalizationRuleset() {
        return personalizationRulesetService.describeActiveRuleset();
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> grammarFeedbackCoverage(int days) {
        int safeDays = Math.max(1, Math.min(days, 365));
        LocalDateTime from = LocalDateTime.now().minusDays((long) safeDays);
        return jdbcTemplate.query("""
                SELECT
                  DATE(created_at) AS snapshotDate,
                  COUNT(*) AS totalSubmits,
                  SUM(total_items) AS totalItems,
                  SUM(items_with_feedback) AS itemsWithFeedback,
                  ROUND(100.0 * SUM(items_with_feedback) / NULLIF(SUM(total_items), 0), 2) AS coveragePercent
                FROM grammar_feedback_events
                WHERE created_at >= ?
                GROUP BY DATE(created_at)
                ORDER BY snapshotDate ASC
                """, (rs, rowNum) -> {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("snapshotDate", rs.getDate("snapshotDate").toLocalDate());
            row.put("totalSubmits", rs.getLong("totalSubmits"));
            row.put("totalItems", rs.getLong("totalItems"));
            row.put("itemsWithFeedback", rs.getLong("itemsWithFeedback"));
            row.put("coveragePercent", rs.getDouble("coveragePercent"));
            return row;
        }, from);
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> gateChecklist(int days, String endpoint) {
        int safeDays = Math.max(1, Math.min(days, 365));
        String safeEndpoint = (endpoint == null || endpoint.isBlank())
                ? "/api/plan/sessions/submit"
                : endpoint.trim();
        LocalDateTime from = LocalDateTime.now().minusDays(safeDays - 1L);

        Map<LocalDate, Map<String, Object>> telemetryByDate = new LinkedHashMap<>();
        List<Map<String, Object>> telemetryRows = apiTelemetryService.latencyErrorSummary(safeDays);
        for (Map<String, Object> row : telemetryRows) {
            LocalDate date = toLocalDate(row.get("snapshotDate"));
            if (date != null) telemetryByDate.put(date, row);
        }

        Map<LocalDate, Map<String, Object>> grammarByDate = new LinkedHashMap<>();
        List<Map<String, Object>> grammarRows = grammarFeedbackCoverage(safeDays);
        for (Map<String, Object> row : grammarRows) {
            LocalDate date = toLocalDate(row.get("snapshotDate"));
            if (date != null) grammarByDate.put(date, row);
        }

        Map<LocalDate, List<Long>> latenciesByDate = new LinkedHashMap<>();
        jdbcTemplate.query("""
                SELECT DATE(event_time) AS snapshotDate, latency_ms
                FROM api_telemetry_events
                WHERE event_time >= ? AND endpoint = ?
                ORDER BY snapshotDate ASC, latency_ms ASC
                """, rs -> {
            LocalDate date = rs.getDate("snapshotDate").toLocalDate();
            latenciesByDate.computeIfAbsent(date, ignored -> new ArrayList<>())
                    .add(rs.getLong("latency_ms"));
        }, Timestamp.valueOf(from), safeEndpoint);

        Set<LocalDate> dates = new HashSet<>();
        dates.addAll(telemetryByDate.keySet());
        dates.addAll(grammarByDate.keySet());
        dates.addAll(latenciesByDate.keySet());

        List<LocalDate> sortedDates = new ArrayList<>(dates);
        sortedDates.sort(Comparator.naturalOrder());

        List<Map<String, Object>> out = new ArrayList<>();
        for (LocalDate date : sortedDates) {
            Map<String, Object> tele = telemetryByDate.get(date);
            Map<String, Object> grammar = grammarByDate.get(date);
            List<Long> samples = latenciesByDate.getOrDefault(date, List.of());

            double errorRatePercent = tele == null ? 0.0 : toDouble(tele.get("errorRatePercent"));
            double grammarCoveragePercent = grammar == null ? 0.0 : toDouble(grammar.get("coveragePercent"));
            double p95LatencyMs = percentile(samples, 0.95);

            boolean grammarPass = grammar != null && grammarCoveragePercent >= 100.0;
            boolean errorPass = tele != null && errorRatePercent < 1.0;
            boolean p95Pass = !samples.isEmpty() && p95LatencyMs < 500.0;

            Map<String, Object> row = new LinkedHashMap<>();
            row.put("snapshotDate", date);
            row.put("endpoint", safeEndpoint);
            row.put("grammarCoveragePercent", round2(grammarCoveragePercent));
            row.put("errorRatePercent", round2(errorRatePercent));
            row.put("p95LatencyMs", round2(p95LatencyMs));
            row.put("sampleCount", samples.size());
            row.put("grammarPass", grammarPass);
            row.put("errorPass", errorPass);
            row.put("p95Pass", p95Pass);
            row.put("allPass", grammarPass && errorPass && p95Pass);
            out.add(row);
        }
        return out;
    }

    private long toLong(Object raw) {
        if (raw instanceof Number n) return n.longValue();
        if (raw == null) return 0L;
        try {
            return Long.parseLong(String.valueOf(raw));
        } catch (Exception e) {
            return 0L;
        }
    }

    private static Instant parseInstantOrDefault(String iso, Instant defaultValue) {
        if (iso == null || iso.isBlank()) return defaultValue;
        try {
            return Instant.parse(iso.trim());
        } catch (DateTimeParseException e) {
            return defaultValue;
        }
    }

    private Integer toIntOrNull(Object raw) {
        if (raw == null) return null;
        if (raw instanceof Number n) return n.intValue();
        try {
            return Integer.parseInt(String.valueOf(raw));
        } catch (Exception e) {
            return null;
        }
    }

    private int extractSessionsPerWeek(String planJson) {
        if (planJson == null || planJson.isBlank()) return 0;
        try {
            var root = objectMapper.readTree(planJson);
            var weeks = root.path("weeks");
            if (!weeks.isArray() || weeks.isEmpty()) return 0;
            var sessions = weeks.get(0).path("sessions");
            if (!sessions.isArray()) return 0;
            return sessions.size();
        } catch (Exception e) {
            return 0;
        }
    }

    private int countSessionsInPlanJson(String planJson) {
        if (planJson == null || planJson.isBlank()) return 0;
        try {
            var root = objectMapper.readTree(planJson);
            var weeks = root.path("weeks");
            if (!weeks.isArray()) return 0;
            int total = 0;
            for (var week : weeks) {
                var sessions = week.path("sessions");
                if (sessions.isArray()) {
                    total += sessions.size();
                }
            }
            return total;
        } catch (Exception e) {
            return 0;
        }
    }

    private static LocalDate toLocalDate(Object value) {
        if (value == null) return null;
        if (value instanceof LocalDate localDate) return localDate;
        String s = String.valueOf(value).trim();
        if (s.isEmpty()) return null;
        try {
            return LocalDate.parse(s);
        } catch (Exception ex) {
            return null;
        }
    }

    private static double toDouble(Object raw) {
        if (raw instanceof Number n) return n.doubleValue();
        if (raw == null) return 0.0;
        try {
            return Double.parseDouble(String.valueOf(raw));
        } catch (Exception ex) {
            return 0.0;
        }
    }

    private static double percentile(List<Long> sortedSamples, double ratio) {
        if (sortedSamples == null || sortedSamples.isEmpty()) {
            return 0.0;
        }
        int index = (int) Math.ceil(ratio * sortedSamples.size()) - 1;
        index = Math.max(0, Math.min(index, sortedSamples.size() - 1));
        return sortedSamples.get(index);
    }

    private static double round2(double value) {
        return Math.round(value * 100.0) / 100.0;
    }
}

