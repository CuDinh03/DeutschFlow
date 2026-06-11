package com.deutschflow.admin.service;

import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.common.telemetry.ApiTelemetryService;
import com.deutschflow.common.config.VocabularyEnrichmentProperties;
import com.deutschflow.common.quota.AiCostEstimator;
import com.deutschflow.common.quota.QuotaService;
import com.deutschflow.common.quota.QuotaSnapshot;
import com.deutschflow.admin.dto.AdminUpdateLearningProfileRequest;
import com.deutschflow.user.dto.AdminUpdateProfileRequest;
import com.deutschflow.gamification.service.XpService;
import com.deutschflow.speaking.repository.UserErrorSkillRepository;
import com.deutschflow.speaking.repository.UserGrammarErrorRepository;
import com.deutschflow.speaking.repository.AiSpeakingSessionRepository;
import com.deutschflow.speaking.repository.AiSpeakingMessageRepository;
import com.deutschflow.speaking.entity.AiSpeakingSession;
import com.deutschflow.user.entity.UserLearningProfile;
import com.deutschflow.user.repository.UserLearningProfileRepository;
import com.deutschflow.user.service.PersonalizationRulesetService;
import com.deutschflow.vocabulary.service.EnrichmentSuspendGate;
import com.deutschflow.vocabulary.service.TranslationUsageMeter;
import com.deutschflow.vocabulary.service.WordQueryService;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.sql.Timestamp;
import java.time.temporal.ChronoUnit;
import java.time.Instant;
import java.time.YearMonth;
import java.time.format.DateTimeParseException;

@Service
@RequiredArgsConstructor
public class AdminManagementService {
    private final JdbcTemplate jdbcTemplate;
    private final DemoDataFilter demoDataFilter;
    private final UserRepository userRepository;
    private final ObjectMapper objectMapper;
    private final ApiTelemetryService apiTelemetryService;
    private final WordQueryService wordQueryService;
    private final PersonalizationRulesetService personalizationRulesetService;
    private final QuotaService quotaService;
    private final AiCostEstimator aiCostEstimator;
    private final TranslationUsageMeter translationUsageMeter;
    private final EnrichmentSuspendGate enrichmentSuspendGate;
    private final VocabularyEnrichmentProperties vocabularyEnrichmentProperties;
    private final UserLearningProfileRepository learningProfileRepository;
    private final XpService xpService;
    private final UserGrammarErrorRepository grammarErrorRepository;
    private final UserErrorSkillRepository errorSkillRepository;
    private final AiSpeakingSessionRepository speakingSessionRepository;
    private final AiSpeakingMessageRepository speakingMessageRepository;

    @Transactional(readOnly = true)
    public Map<String, Object> overview() {
        Integer users = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM users", Integer.class);
        Integer teachers = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM users WHERE role = 'TEACHER'", Integer.class);
        Integer students = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM users WHERE role = 'STUDENT'", Integer.class);
        // Live classroom schema (teacher_classes/class_assignments/student_assignments).
        // Hệ quiz cũ (classrooms/quizzes/quiz_sessions) đã gỡ — không query nữa để không
        // vỡ khi drop bảng legacy. Giữ nguyên key JSON (quizCount...) cho FE; ngữ nghĩa
        // giờ là "assignment".
        Integer classes = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM teacher_classes", Integer.class);
        Integer quizzes = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM class_assignments", Integer.class);
        Integer activeQuizzes = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM class_assignments WHERE due_date IS NULL OR due_date >= NOW()", Integer.class);
        Double avgQuizScore = jdbcTemplate.queryForObject(
                "SELECT AVG(score) FROM student_assignments WHERE score IS NOT NULL AND is_deleted = FALSE", Double.class);

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

    /** Trạng thái Smart Free / auto-stop / usage DeepL free (UTC month) cho ops. */
    @Transactional(readOnly = true)
    public Map<String, Object> vocabularyEnrichmentControlStatus() {
        YearMonth ym = TranslationUsageMeter.currentBillingMonthUtc();
        long deeplChars = translationUsageMeter.currentUsage(TranslationUsageMeter.PROVIDER_DEEPL_FREE, ym);
        Integer totalWords = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM words", Integer.class);
        Integer wordsMissingEnOrVi = jdbcTemplate.queryForObject("""
                SELECT COUNT(DISTINCT w.id)
                FROM words w
                WHERE (
                    NOT EXISTS (
                    SELECT 1 FROM word_translations t
                    WHERE t.word_id = w.id AND t.locale = 'en'
                      AND t.meaning IS NOT NULL AND TRIM(t.meaning) <> ''
                      AND LOWER(t.meaning) NOT LIKE 'not in wordlists/local_lexicon.tsv%'
                      AND LOWER(t.meaning) NOT LIKE 'chưa có trong wordlists/local_lexicon.tsv%'
                    )
                    OR NOT EXISTS (
                    SELECT 1 FROM word_translations t
                    WHERE t.word_id = w.id AND t.locale = 'vi'
                      AND t.meaning IS NOT NULL AND TRIM(t.meaning) <> ''
                      AND LOWER(t.meaning) NOT LIKE 'not in wordlists%'
                      AND LOWER(t.meaning) NOT LIKE 'chưa có trong%'
                    )
                )
                """, Integer.class);

        Map<String, Object> m = new LinkedHashMap<>();
        m.put("enrichmentSuspendedLatch", enrichmentSuspendGate.isEnrichmentSuspended());
        m.put("billingMonthUtc", ym.toString());
        m.put("deeplFreeCharsInputMonth", deeplChars);
        m.put("deeplFreeMonthlyCharCap", vocabularyEnrichmentProperties.getDeeplFreeMonthlyCharCap());
        m.put("strictFreeMode", vocabularyEnrichmentProperties.isStrictFreeMode());
        m.put("autoStopEnabled", vocabularyEnrichmentProperties.isEnrichmentAutoStopEnabled());
        m.put("autoStopMinTotalWords", vocabularyEnrichmentProperties.getEnrichmentAutoStopMinTotalWords());
        m.put("totalWords", totalWords == null ? 0 : totalWords);
        m.put("wordsMissingEnOrVi", wordsMissingEnOrVi == null ? 0 : wordsMissingEnOrVi);
        return m;
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> listUsers() {
        List<Map<String, Object>> users = jdbcTemplate.queryForList("""
                SELECT id, email, display_name AS displayName, role, is_active AS isActive, created_at AS createdAt
                FROM users
                ORDER BY created_at DESC
                """);
        Instant thirtyDaysAgo = Instant.now().minus(30, ChronoUnit.DAYS);
        Map<Long, Long> usageLast30DaysByUser = aggregateTokenUsageSince(thirtyDaysAgo);
        for (Map<String, Object> u : users) {
            long userId = toLong(u.get("id"));
            u.put("usageLast30Days", usageLast30DaysByUser.getOrDefault(userId, 0L));
            try {
                var snap = quotaService.getSnapshotReadOnly(userId, Instant.now());
                u.put("planCode", snap.planCode());
                u.put("quotaKind", classifyQuotaKind(snap));
                u.put("usedToday", snap.usedToday());
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
        Instant thirtyDaysAgo = Instant.now().minus(30, ChronoUnit.DAYS);

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("userId", userId);
        out.put("planCode", snap.planCode());
        out.put("quotaKind", classifyQuotaKind(snap));
        out.put("unlimitedInternal", snap.unlimitedInternal());
        out.put("dailyTokenGrant", snap.dailyTokenGrant());
        out.put("usedToday", snap.usedToday());
        out.put("walletBalance", snap.walletBalance());
        out.put("walletCap", snap.walletCap());
        out.put("monthlyTokenLimit", snap.monthlyTokenLimit());
        out.put("usedThisMonth", snap.usedThisMonth());
        out.put("remainingThisMonth", snap.remainingThisMonth());
        out.put("remainingSpendable", snap.remainingSpendable());
        out.put("usageLast30Days", sumUserTokenUsageSince(userId, thirtyDaysAgo));
        out.put("usageLedgerWindowDays", 30);
        out.put("usageLedgerSinceUtc", thirtyDaysAgo.toString());
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

    /**
     * Aggregates ledger totals by {@code ai_token_usage_events.feature} for dashboards (read-only).
     */
    @Transactional(readOnly = true)
    public Map<String, Object> aiUsageByFeature(int days) {
        int d = Math.min(366, Math.max(1, days));
        Instant to = Instant.now();
        Instant from = to.minusSeconds((long) d * 86400L);

        // Group by (feature, model): cost pricing is model-dependent, so we must keep the
        // model dimension to price each bucket before rolling up to per-feature totals.
        // Demo-org activity is excluded so it doesn't skew COGS-by-feature (see DemoDataFilter).
        List<Map<String, Object>> rows = jdbcTemplate.queryForList("""
                        SELECT COALESCE(NULLIF(TRIM(feature), ''), 'UNKNOWN') AS feature,
                               COALESCE(model, 'unknown')                     AS model,
                               COALESCE(SUM(prompt_tokens), 0)::bigint        AS prompt_tokens,
                               COALESCE(SUM(completion_tokens), 0)::bigint    AS completion_tokens,
                               COALESCE(SUM(total_tokens), 0)::bigint         AS total_tokens,
                               COUNT(*)::bigint                               AS requests
                        FROM ai_token_usage_events
                        WHERE created_at >= ? AND created_at <= ?
                        %s
                        GROUP BY 1, 2
                        """.formatted(demoDataFilter.andExcludeDemo()),
                Timestamp.from(from), Timestamp.from(to));

        Map<String, long[]> tokensByFeature = new LinkedHashMap<>(); // [prompt, completion, total, requests]
        Map<String, Double> costByFeature = new LinkedHashMap<>();
        for (Map<String, Object> row : rows) {
            String feature = String.valueOf(row.get("feature"));
            String model = String.valueOf(row.get("model"));
            long prompt = toLong(row.get("prompt_tokens"));
            long completion = toLong(row.get("completion_tokens"));
            long total = toLong(row.get("total_tokens"));
            long requests = toLong(row.get("requests"));
            long[] acc = tokensByFeature.computeIfAbsent(feature, k -> new long[4]);
            acc[0] += prompt;
            acc[1] += completion;
            acc[2] += total;
            acc[3] += requests;
            costByFeature.merge(feature, aiCostEstimator.costUsd(model, prompt, completion), Double::sum);
        }

        long totalTokensSum = 0L;
        double totalCostUsd = 0.0;
        List<Map<String, Object>> byFeature = new ArrayList<>(tokensByFeature.size());
        for (Map.Entry<String, long[]> e : tokensByFeature.entrySet()) {
            long[] acc = e.getValue();
            double costUsd = costByFeature.getOrDefault(e.getKey(), 0.0);
            totalTokensSum += acc[2];
            totalCostUsd += costUsd;
            Map<String, Object> slice = new LinkedHashMap<>();
            slice.put("feature", e.getKey());
            slice.put("requests", acc[3]);
            slice.put("promptTokens", acc[0]);
            slice.put("completionTokens", acc[1]);
            slice.put("totalTokens", acc[2]);
            slice.put("costUsd", aiCostEstimator.roundUsd(costUsd));
            slice.put("costVnd", aiCostEstimator.toVnd(costUsd));
            byFeature.add(slice);
        }
        byFeature.sort((a, b) -> Double.compare(
                ((Number) b.get("costUsd")).doubleValue(),
                ((Number) a.get("costUsd")).doubleValue()));

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("days", d);
        out.put("fromUtc", from.toString());
        out.put("toUtc", to.toString());
        out.put("totalTokens", totalTokensSum);
        out.put("totalCostUsd", aiCostEstimator.roundUsd(totalCostUsd));
        out.put("totalCostVnd", aiCostEstimator.toVnd(totalCostUsd));
        out.put("usdVndRate", aiCostEstimator.usdVndRate());
        out.put("byFeature", byFeature);
        return out;
    }

    /**
     * Returns daily token counts and estimated USD/VND cost for the past {@code days} days.
     *
     * <p>Cost uses split input/output pricing via {@link AiCostEstimator} — see that class
     * for the per-model tariff table. Server-side totals are included so callers do not
     * re-sum the rows.
     */
    @Transactional(readOnly = true)
    public Map<String, Object> aiCostDaily(int days) {
        int d = Math.min(90, Math.max(1, days));
        Instant to = Instant.now();
        Instant from = to.minusSeconds((long) d * 86400L);

        List<Map<String, Object>> rows = jdbcTemplate.queryForList("""
                SELECT
                    DATE_TRUNC('day', created_at AT TIME ZONE 'UTC')::date AS day,
                    COALESCE(model, 'unknown')                             AS model,
                    COALESCE(NULLIF(TRIM(feature), ''), 'UNKNOWN')         AS feature,
                    SUM(prompt_tokens)::bigint                             AS prompt_tokens,
                    SUM(completion_tokens)::bigint                         AS completion_tokens,
                    SUM(total_tokens)::bigint                              AS tokens
                FROM ai_token_usage_events
                WHERE created_at >= ? AND created_at <= ?
                %s
                GROUP BY 1, 2, 3
                ORDER BY 1 DESC, 6 DESC
                """.formatted(demoDataFilter.andExcludeDemo()),
                Timestamp.from(from), Timestamp.from(to));

        long totalTokens = 0L;
        double totalCostUsd = 0.0;
        List<Map<String, Object>> daily = new ArrayList<>(rows.size());
        for (Map<String, Object> row : rows) {
            long prompt = toLong(row.get("prompt_tokens"));
            long completion = toLong(row.get("completion_tokens"));
            long tokens = toLong(row.get("tokens"));
            String model = String.valueOf(row.get("model"));
            double costUsd = aiCostEstimator.costUsd(model, prompt, completion);
            totalTokens += tokens;
            totalCostUsd += costUsd;

            Map<String, Object> entry = new LinkedHashMap<>();
            entry.put("day", String.valueOf(row.get("day")));
            entry.put("model", model);
            entry.put("feature", row.get("feature"));
            entry.put("promptTokens", prompt);
            entry.put("completionTokens", completion);
            entry.put("tokens", tokens);
            entry.put("costUsd", aiCostEstimator.roundUsd(costUsd));
            entry.put("costVnd", aiCostEstimator.toVnd(costUsd));
            daily.add(entry);
        }

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("days", d);
        out.put("fromUtc", from.toString());
        out.put("toUtc", to.toString());
        out.put("totalTokens", totalTokens);
        out.put("totalCostUsd", aiCostEstimator.roundUsd(totalCostUsd));
        out.put("totalCostVnd", aiCostEstimator.toVnd(totalCostUsd));
        out.put("usdVndRate", aiCostEstimator.usdVndRate());
        out.put("data", daily);
        return out;
    }

    /**
     * Planning-oriented COGS summary over the past {@code days} days: a single call that
     * returns total spend, per-active-user unit economics, a run-rate projection, and the
     * cost breakdown by model and feature. Built for capacity/pricing planning rather than
     * trend charting.
     */
    @Transactional(readOnly = true)
    public Map<String, Object> aiCostSummary(int days) {
        int d = Math.min(90, Math.max(1, days));
        Instant to = Instant.now();
        Instant from = to.minusSeconds((long) d * 86400L);
        Timestamp fromTs = Timestamp.from(from);
        Timestamp toTs = Timestamp.from(to);
        // Resolve the demo-exclusion clause once and reuse across all three scans below, so
        // demo-org activity never inflates spend, the active-user denominator, or STT cost.
        final String demoAnd = demoDataFilter.andExcludeDemo();

        // One scan, grouped finely enough to price each bucket and roll up two ways.
        List<Map<String, Object>> rows = jdbcTemplate.queryForList("""
                SELECT
                    COALESCE(model, 'unknown')                     AS model,
                    COALESCE(NULLIF(TRIM(feature), ''), 'UNKNOWN') AS feature,
                    SUM(prompt_tokens)::bigint                     AS prompt_tokens,
                    SUM(completion_tokens)::bigint                 AS completion_tokens,
                    SUM(total_tokens)::bigint                      AS total_tokens,
                    COUNT(*)::bigint                               AS requests
                FROM ai_token_usage_events
                WHERE created_at >= ? AND created_at <= ?
                %s
                GROUP BY 1, 2
                """.formatted(demoAnd),
                fromTs, toTs);

        Number activeRaw = jdbcTemplate.queryForObject("""
                        SELECT COUNT(DISTINCT user_id)
                        FROM ai_token_usage_events
                        WHERE created_at >= ? AND created_at <= ?
                        %s
                        """.formatted(demoAnd),
                Number.class, fromTs, toTs);
        long activeUsers = activeRaw == null ? 0L : activeRaw.longValue();

        Map<String, long[]> byModelTokens = new LinkedHashMap<>();   // [prompt, completion, total, requests]
        Map<String, Double> byModelCost = new LinkedHashMap<>();
        Map<String, long[]> byFeatureTokens = new LinkedHashMap<>();
        Map<String, Double> byFeatureCost = new LinkedHashMap<>();
        long totalTokens = 0L;
        long totalRequests = 0L;
        double totalCostUsd = 0.0;

        for (Map<String, Object> row : rows) {
            String model = String.valueOf(row.get("model"));
            String feature = String.valueOf(row.get("feature"));
            long prompt = toLong(row.get("prompt_tokens"));
            long completion = toLong(row.get("completion_tokens"));
            long total = toLong(row.get("total_tokens"));
            long requests = toLong(row.get("requests"));
            double costUsd = aiCostEstimator.costUsd(model, prompt, completion);

            accumulate(byModelTokens, byModelCost, model, prompt, completion, total, requests, costUsd);
            accumulate(byFeatureTokens, byFeatureCost, feature, prompt, completion, total, requests, costUsd);
            totalTokens += total;
            totalRequests += requests;
            totalCostUsd += costUsd;
        }

        // STT spend from stt_usage_events (separate table — Whisper billed per audio-second).
        // Same demo exclusion; the clause keeps NULL user_id rows (stt_usage_events.user_id is nullable).
        List<Map<String, Object>> sttRows = jdbcTemplate.queryForList("""
                SELECT COALESCE(NULLIF(TRIM(feature), ''), 'STT_UNKNOWN') AS feature,
                       model,
                       COUNT(*)::bigint                                   AS requests,
                       SUM(audio_duration_secs)                           AS total_secs
                FROM stt_usage_events
                WHERE created_at >= ? AND created_at <= ?
                %s
                GROUP BY 1, 2
                """.formatted(demoAnd), fromTs, toTs);

        double sttCostUsd = 0.0;
        long sttRequests = 0L;
        List<Map<String, Object>> sttByFeature = new ArrayList<>();
        for (Map<String, Object> row : sttRows) {
            double secs = ((Number) row.getOrDefault("total_secs", 0.0)).doubleValue();
            long reqs = toLong(row.get("requests"));
            double featureCost = aiCostEstimator.costSttUsd(secs);
            sttCostUsd += featureCost;
            sttRequests += reqs;
            Map<String, Object> slice = new LinkedHashMap<>();
            slice.put("feature", row.get("feature"));
            slice.put("model", row.get("model"));
            slice.put("requests", reqs);
            slice.put("audioSecs", Math.round(secs * 10.0) / 10.0);
            slice.put("costUsd", aiCostEstimator.roundUsd(featureCost));
            slice.put("costVnd", aiCostEstimator.toVnd(featureCost));
            sttByFeature.add(slice);
        }
        sttByFeature.sort((a, b) -> Double.compare(
                ((Number) b.get("costUsd")).doubleValue(),
                ((Number) a.get("costUsd")).doubleValue()));

        double grandTotalCostUsd = totalCostUsd + sttCostUsd;
        double avgDailyCostUsd = grandTotalCostUsd / d;
        double projected30dUsd = avgDailyCostUsd * 30.0;
        double costPerUserUsd = activeUsers > 0 ? grandTotalCostUsd / activeUsers : 0.0;

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("days", d);
        out.put("fromUtc", from.toString());
        out.put("toUtc", to.toString());
        out.put("usdVndRate", aiCostEstimator.usdVndRate());

        Map<String, Object> totals = new LinkedHashMap<>();
        totals.put("requests", totalRequests + sttRequests);
        totals.put("tokens", totalTokens);
        totals.put("llmCostUsd", aiCostEstimator.roundUsd(totalCostUsd));
        totals.put("sttCostUsd", aiCostEstimator.roundUsd(sttCostUsd));
        totals.put("costUsd", aiCostEstimator.roundUsd(grandTotalCostUsd));
        totals.put("costVnd", aiCostEstimator.toVnd(grandTotalCostUsd));
        totals.put("activeUsers", activeUsers);
        totals.put("costPerActiveUserUsd", aiCostEstimator.roundUsd(costPerUserUsd));
        totals.put("costPerActiveUserVnd", aiCostEstimator.toVnd(costPerUserUsd));
        totals.put("avgDailyCostUsd", aiCostEstimator.roundUsd(avgDailyCostUsd));
        totals.put("avgDailyCostVnd", aiCostEstimator.toVnd(avgDailyCostUsd));
        totals.put("projected30dCostUsd", aiCostEstimator.roundUsd(projected30dUsd));
        totals.put("projected30dCostVnd", aiCostEstimator.toVnd(projected30dUsd));
        out.put("totals", totals);

        out.put("byModel", toCostBreakdown(byModelTokens, byModelCost, "model", totalCostUsd));
        out.put("byFeature", toCostBreakdown(byFeatureTokens, byFeatureCost, "feature", totalCostUsd));
        out.put("sttByFeature", sttByFeature);
        out.put("uncoveredCosts", aiCostEstimator.uncoveredCostNotes());
        return out;
    }

    private void accumulate(Map<String, long[]> tokens, Map<String, Double> cost, String key,
                            long prompt, long completion, long total, long requests, double costUsd) {
        long[] acc = tokens.computeIfAbsent(key, k -> new long[4]);
        acc[0] += prompt;
        acc[1] += completion;
        acc[2] += total;
        acc[3] += requests;
        cost.merge(key, costUsd, Double::sum);
    }

    private List<Map<String, Object>> toCostBreakdown(Map<String, long[]> tokens, Map<String, Double> cost,
                                                       String keyName, double totalCostUsd) {
        List<Map<String, Object>> list = new ArrayList<>(tokens.size());
        for (Map.Entry<String, long[]> e : tokens.entrySet()) {
            long[] acc = e.getValue();
            double costUsd = cost.getOrDefault(e.getKey(), 0.0);
            Map<String, Object> slice = new LinkedHashMap<>();
            slice.put(keyName, e.getKey());
            slice.put("requests", acc[3]);
            slice.put("promptTokens", acc[0]);
            slice.put("completionTokens", acc[1]);
            slice.put("totalTokens", acc[2]);
            slice.put("costUsd", aiCostEstimator.roundUsd(costUsd));
            slice.put("costVnd", aiCostEstimator.toVnd(costUsd));
            slice.put("pctOfCost", totalCostUsd > 0
                    ? Math.round(costUsd / totalCostUsd * 1000.0) / 10.0
                    : 0.0);
            list.add(slice);
        }
        list.sort((a, b) -> Double.compare(
                ((Number) b.get("costUsd")).doubleValue(),
                ((Number) a.get("costUsd")).doubleValue()));
        return list;
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

    /**
     * Admin override: cập nhật displayName / phoneNumber của bất kỳ user nào không cần OTP.
     */
    @Transactional
    public Map<String, Object> adminUpdateProfile(Long userId, AdminUpdateProfileRequest req) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new NotFoundException("User not found"));

        if (req.displayName() != null && !req.displayName().isBlank()) {
            user.setDisplayName(req.displayName().trim());
        }
        if (req.phoneNumber() != null && !req.phoneNumber().isBlank()) {
            String phone = req.phoneNumber().trim();
            // Kiểm tra không trùng với user khác
            boolean phoneUsedByOther = jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM users WHERE phone_number = ? AND id <> ?",
                    Integer.class, phone, userId) > 0;
            if (phoneUsedByOther) {
                throw new BadRequestException("Số điện thoại này đã được đăng ký bởi user khác.");
            }
            user.setPhoneNumber(phone);
        }

        userRepository.save(user);

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("id", user.getId());
        out.put("email", user.getEmail());
        out.put("displayName", user.getDisplayName());
        out.put("phoneNumber", user.getPhoneNumber());
        out.put("role", user.getRole().name());
        return out;
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> listClasses() {
        return jdbcTemplate.queryForList("""
                SELECT c.id, c.name, c.teacher_id AS teacherId, u.display_name AS teacherName, c.created_at AS createdAt,
                       (SELECT COUNT(*) FROM class_students cs WHERE cs.class_id = c.id) AS studentCount
                FROM teacher_classes c
                JOIN users u ON u.id = c.teacher_id
                ORDER BY c.created_at DESC
                """);
    }

    @Transactional
    public Map<String, Object> bulkAssignStudents(Long classId, List<Long> studentIds) {
        if (studentIds == null || studentIds.isEmpty()) {
            return Map.of("assignedCount", 0);
        }
        
        Integer classExists = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM teacher_classes WHERE id = ?", Integer.class, classId);
        if (classExists == null || classExists == 0) {
            throw new NotFoundException("Class not found");
        }
        
        Set<Long> uniqueIds = new HashSet<>(studentIds);
        int count = 0;
        
        for (Long sid : uniqueIds) {
            Integer isStudent = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM users WHERE id = ? AND role = 'STUDENT'", Integer.class, sid);
            if (isStudent != null && isStudent > 0) {
                Integer exists = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM class_students WHERE class_id = ? AND student_id = ?", Integer.class, classId, sid);
                if (exists == null || exists == 0) {
                    jdbcTemplate.update("INSERT INTO class_students (class_id, student_id, joined_at) VALUES (?, ?, NOW())", classId, sid);
                    count++;
                }
            }
        }
        
        return Map.of("assignedCount", count);
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

    @Transactional
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

    private static String classifyQuotaKind(QuotaSnapshot snap) {
        if (snap.unlimitedInternal()) {
            return "INTERNAL_UNLIMITED";
        }
        String pc = snap.planCode() == null ? "" : snap.planCode().trim().toUpperCase(Locale.ROOT);
        return switch (pc) {
            case "FREE" -> "FREE_DAY";
            case "PRO", "PREMIUM", "ULTRA" -> "WALLET";
            case "INTERNAL" -> "INTERNAL_UNLIMITED";
            default -> "NONE";
        };
    }

    private Map<Long, Long> aggregateTokenUsageSince(Instant fromInclusive) {
        List<Map<String, Object>> rows = jdbcTemplate.queryForList(
                """
                        SELECT user_id AS uid, COALESCE(SUM(total_tokens), 0) AS tk
                        FROM ai_token_usage_events
                        WHERE created_at >= ?
                        GROUP BY user_id
                        """,
                Timestamp.from(fromInclusive));
        Map<Long, Long> map = new LinkedHashMap<>();
        for (Map<String, Object> row : rows) {
            map.put(toLong(row.get("uid")), toLong(row.get("tk")));
        }
        return map;
    }

    /** Sum ledger tokens for one user since {@code fromInclusive}. */
    private long sumUserTokenUsageSince(long userId, Instant fromInclusive) {
        Number n = jdbcTemplate.queryForObject(
                """
                        SELECT COALESCE(SUM(total_tokens), 0)
                        FROM ai_token_usage_events
                        WHERE user_id = ? AND created_at >= ?
                        """,
                Number.class,
                userId,
                Timestamp.from(fromInclusive));
        return n == null ? 0L : n.longValue();
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

    // ── Admin User Learning Detail ────────────────────────────────────────

    /**
     * Comprehensive learning detail for admin user inspection.
     * Aggregates data from: learning profile, XP/streak, grammar errors, error skills, SRS items.
     */
    @Transactional(readOnly = true)
    public Map<String, Object> userLearningDetail(Long userId) {
        userRepository.findById(userId)
                .orElseThrow(() -> new NotFoundException("User not found"));

        Map<String, Object> out = new LinkedHashMap<>();

        // ── 1. Learning Profile ──
        Map<String, Object> profile = new LinkedHashMap<>();
        learningProfileRepository.findByUserId(userId).ifPresentOrElse(p -> {
            profile.put("goalType", p.getGoalType() != null ? p.getGoalType().name() : null);
            profile.put("targetLevel", p.getTargetLevel() != null ? p.getTargetLevel().name() : null);
            profile.put("currentLevel", p.getCurrentLevel() != null ? p.getCurrentLevel().name() : null);
            profile.put("industry", p.getIndustry());
            profile.put("examType", p.getExamType());
            profile.put("sessionsPerWeek", p.getSessionsPerWeek());
            profile.put("minutesPerSession", p.getMinutesPerSession());
            profile.put("learningSpeed", p.getLearningSpeed() != null ? p.getLearningSpeed().name() : null);
            profile.put("ageRange", p.getAgeRange() != null ? p.getAgeRange().name() : null);
            // Parse interests
            try {
                if (p.getInterestsJson() != null && !p.getInterestsJson().isBlank()) {
                    profile.put("interests", objectMapper.readValue(p.getInterestsJson(), List.class));
                } else {
                    profile.put("interests", List.of());
                }
            } catch (Exception e) {
                profile.put("interests", List.of());
            }
            profile.put("updatedAt", p.getUpdatedAt());
        }, () -> {
            profile.put("notConfigured", true);
        });
        out.put("learningProfile", profile);

        // ── 2. XP & Gamification ──
        Map<String, Object> xp = new LinkedHashMap<>();
        try {
            var summary = xpService.getSummary(userId);
            xp.put("totalXp", summary.totalXp());
            xp.put("level", summary.level());
            xp.put("progressInLevel", summary.progressInLevel());
            xp.put("xpNeededForNext", summary.xpNeededForNext());
            var allAch = summary.allAchievements();
            if (allAch != null) {
                xp.put("achievementsUnlocked", allAch.stream().filter(a -> a.unlocked()).count());
                xp.put("achievementsTotal", allAch.size());
                // Full achievement list with details for admin display
                xp.put("achievements", allAch.stream().map(a -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("code", a.code());
                    m.put("nameVi", a.nameVi());
                    m.put("descriptionVi", a.descriptionVi());
                    m.put("iconEmoji", a.iconEmoji());
                    m.put("xpReward", a.xpReward());
                    m.put("rarity", a.rarity());
                    m.put("unlocked", a.unlocked());
                    return m;
                }).toList());
            } else {
                xp.put("achievementsUnlocked", 0);
                xp.put("achievementsTotal", 0);
                xp.put("achievements", List.of());
            }
        } catch (Exception e) {
            xp.put("error", "Failed to load XP: " + e.getMessage());
            xp.put("achievements", List.of());
        }
        out.put("xpGamification", xp);

        // ── 3. Streak ──
        Map<String, Object> streak = new LinkedHashMap<>();
        try {
            // Simplified: count distinct days in last 90 days where user completed a session
            // The complex recursive CTE caused timeouts; this is fast enough for admin view
            Integer totalCompletedSessions = jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM learning_session_progress WHERE user_id = ? AND status = 'COMPLETED'",
                    Integer.class, userId);
            Integer recentDays = jdbcTemplate.queryForObject("""
                    SELECT COUNT(DISTINCT DATE(completed_at))
                    FROM learning_session_progress
                    WHERE user_id = ? AND status = 'COMPLETED'
                      AND completed_at IS NOT NULL
                      AND completed_at >= CURRENT_DATE - INTERVAL '90 days'
                    """, Integer.class, userId);
            streak.put("currentStreak", recentDays != null ? recentDays : 0);
            streak.put("totalCompletedSessions", totalCompletedSessions != null ? totalCompletedSessions : 0);
        } catch (Exception e) {
            streak.put("currentStreak", 0);
            streak.put("totalCompletedSessions", 0);
            streak.put("error", e.getMessage());
        }
        out.put("streak", streak);

        // ── 4. Speaking Stats ──
        Map<String, Object> speaking = new LinkedHashMap<>();
        try {
            Integer totalSessions = jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM ai_speaking_sessions WHERE user_id = ?",
                    Integer.class, userId);
            Integer totalMessages = jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM ai_speaking_messages m JOIN ai_speaking_sessions s ON s.id = m.session_id WHERE s.user_id = ?",
                    Integer.class, userId);
            speaking.put("totalSessions", totalSessions != null ? totalSessions : 0);
            speaking.put("totalMessages", totalMessages != null ? totalMessages : 0);
        } catch (Exception e) {
            speaking.put("totalSessions", 0);
            speaking.put("totalMessages", 0);
        }

        // Top 5 weak points (grammar errors)
        try {
            var weakPoints = grammarErrorRepository.findTopWeakPoints(userId, PageRequest.of(0, 5));
            speaking.put("topWeakPoints", weakPoints.stream().map(wp -> Map.of(
                    "grammarPoint", wp.grammarPoint(),
                    "count", wp.count()
            )).toList());
        } catch (Exception e) {
            speaking.put("topWeakPoints", List.of());
        }

        // Recent errors (last 10)
        try {
            var recentErrors = grammarErrorRepository.findTop20ByUserIdOrderByCreatedAtDesc(userId);
            speaking.put("recentErrors", recentErrors.stream().limit(10).map(err -> {
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("id", err.getId());
                m.put("errorCode", err.getErrorCode() != null ? err.getErrorCode() : err.getGrammarPoint());
                m.put("severity", err.getSeverity());
                m.put("wrongSpan", err.getWrongSpan());
                m.put("correctedSpan", err.getCorrectedSpan());
                m.put("ruleViShort", err.getRuleViShort());
                m.put("repairStatus", err.getRepairStatus());
                m.put("createdAt", err.getCreatedAt());
                return m;
            }).toList());
        } catch (Exception e) {
            speaking.put("recentErrors", List.of());
        }

        // Error skills (priority-sorted)
        try {
            var skills = errorSkillRepository.findByUserIdOrderByPriorityScoreDesc(userId);
            speaking.put("errorSkills", skills.stream().limit(10).map(s -> {
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("errorCode", s.getErrorCode());
                m.put("totalCount", s.getTotalCount());
                m.put("openCount", s.getOpenCount());
                m.put("resolvedCount", s.getResolvedCount());
                m.put("lastSeverity", s.getLastSeverity());
                m.put("priorityScore", s.getPriorityScore());
                m.put("lastSeenAt", s.getLastSeenAt());
                return m;
            }).toList());
        } catch (Exception e) {
            speaking.put("errorSkills", List.of());
        }
        out.put("speakingAi", speaking);

        // ── 5. Vocabulary SRS (FSRS-4.5, vocab_review_schedule) ──
        Map<String, Object> vocab = new LinkedHashMap<>();
        try {
            Integer totalItems = jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM vocab_review_schedule WHERE user_id = ?",
                    Integer.class, userId);
            vocab.put("totalItems", totalItems != null ? totalItems : 0);

            // Due now (next_review_at <= now)
            Integer dueToday = jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM vocab_review_schedule WHERE user_id = ? AND next_review_at <= NOW()",
                    Integer.class, userId);
            vocab.put("dueToday", dueToday != null ? dueToday : 0);

            // Mastered (stability >= 21 days ≈ retained ~3 weeks)
            Integer mastered = jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM vocab_review_schedule WHERE user_id = ? AND stability >= 21",
                    Integer.class, userId);
            vocab.put("mastered", mastered != null ? mastered : 0);

            // Learning (reviewed at least once but not yet mastered)
            Integer learning = jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM vocab_review_schedule WHERE user_id = ? AND stability IS NOT NULL AND stability < 21",
                    Integer.class, userId);
            vocab.put("learning", learning != null ? learning : 0);

            // New (scheduled, never reviewed)
            Integer newItems = jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM vocab_review_schedule WHERE user_id = ? AND stability IS NULL",
                    Integer.class, userId);
            vocab.put("newItems", newItems != null ? newItems : 0);
        } catch (Exception e) {
            vocab.put("error", "Failed to load SRS: " + e.getMessage());
        }
        out.put("vocabularySrs", vocab);

        return out;
    }

    // ── Admin Update Learning Profile ─────────────────────────────────────────

    /**
     * Upsert a user's learning profile from the admin panel.
     * All fields are optional — only non-null values will be applied.
     */
    @Transactional
    public Map<String, Object> adminUpdateLearningProfile(Long userId, AdminUpdateLearningProfileRequest req) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new NotFoundException("User not found"));

        UserLearningProfile profile = learningProfileRepository.findByUserId(userId)
                .orElseGet(() -> {
                    // Create a minimal default profile
                    return UserLearningProfile.builder()
                            .user(user)
                            .goalType(UserLearningProfile.GoalType.WORK)
                            .targetLevel(UserLearningProfile.TargetLevel.B1)
                            .currentLevel(UserLearningProfile.CurrentLevel.A0)
                            .sessionsPerWeek(3)
                            .minutesPerSession(30)
                            .learningSpeed(UserLearningProfile.LearningSpeed.NORMAL)
                            .build();
                });

        // Apply partial updates
        if (req.goalType() != null)
            profile.setGoalType(UserLearningProfile.GoalType.valueOf(req.goalType()));
        if (req.targetLevel() != null)
            profile.setTargetLevel(UserLearningProfile.TargetLevel.valueOf(req.targetLevel()));
        if (req.currentLevel() != null)
            profile.setCurrentLevel(UserLearningProfile.CurrentLevel.valueOf(req.currentLevel()));
        if (req.learningSpeed() != null)
            profile.setLearningSpeed(UserLearningProfile.LearningSpeed.valueOf(req.learningSpeed()));
        if (req.industry() != null)
            profile.setIndustry(req.industry());
        if (req.sessionsPerWeek() != null)
            profile.setSessionsPerWeek(req.sessionsPerWeek());
        if (req.minutesPerSession() != null)
            profile.setMinutesPerSession(req.minutesPerSession());

        learningProfileRepository.save(profile);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("success", true);
        result.put("userId", userId);
        result.put("goalType", profile.getGoalType().name());
        result.put("targetLevel", profile.getTargetLevel().name());
        result.put("currentLevel", profile.getCurrentLevel().name());
        result.put("learningSpeed", profile.getLearningSpeed().name());
        result.put("industry", profile.getIndustry());
        result.put("sessionsPerWeek", profile.getSessionsPerWeek());
        result.put("minutesPerSession", profile.getMinutesPerSession());
        return result;
    }

    // ── Interview Transcript (Admin) ─────────────────────────────────────

    @Transactional(readOnly = true)
    public List<Map<String, Object>> userInterviewSessions(Long userId) {
        userRepository.findById(userId)
                .orElseThrow(() -> new NotFoundException("User not found"));
        var sessions = speakingSessionRepository
                .findByUserIdAndSessionModeOrderByStartedAtDesc(userId, "INTERVIEW");
        List<Map<String, Object>> result = new ArrayList<>();
        for (var s : sessions) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", s.getId());
            m.put("interviewPosition", s.getInterviewPosition());
            m.put("experienceLevel", s.getExperienceLevel());
            m.put("cefrLevel", s.getCefrLevel());
            m.put("persona", s.getPersona());
            // Map enum to frontend-compatible status string
            String statusStr = (s.getStatus() == AiSpeakingSession.SessionStatus.ENDED)
                    ? "COMPLETED" : "IN_PROGRESS";
            m.put("status", statusStr);
            m.put("messageCount", s.getMessageCount());
            m.put("startedAt", s.getStartedAt());
            m.put("endedAt", s.getEndedAt());
            m.put("interviewReportJson", s.getInterviewReportJson());
            result.add(m);
        }
        return result;
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> userInterviewMessages(Long userId, Long sessionId) {
        userRepository.findById(userId)
                .orElseThrow(() -> new NotFoundException("User not found"));
        var session = speakingSessionRepository.findById(sessionId)
                .orElseThrow(() -> new NotFoundException("Session not found"));
        if (!session.getUserId().equals(userId)) {
            throw new BadRequestException("Session does not belong to user");
        }
        var messages = speakingMessageRepository.findBySessionIdOrderByCreatedAtAsc(sessionId);
        List<Map<String, Object>> result = new ArrayList<>();
        for (var msg : messages) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", msg.getId());
            m.put("role", msg.getRole() != null ? msg.getRole().name() : null);
            m.put("userMessage", msg.getUserText());
            m.put("aiSpeechDe", msg.getAiSpeechDe());
            m.put("explanationVi", msg.getExplanationVi());
            m.put("correction", msg.getCorrection());
            m.put("createdAt", msg.getCreatedAt());
            result.add(m);
        }
        return result;
    }
}

