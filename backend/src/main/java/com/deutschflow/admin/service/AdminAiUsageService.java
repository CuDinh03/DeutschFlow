package com.deutschflow.admin.service;

import com.deutschflow.common.quota.AiCostEstimator;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Báo cáo AI usage cho admin (kế hoạch luyện thi nói N0.6 / T.3): token theo feature × model, giây STT,
 * và top phiên tốn nhất — trả lời "một mock A1/B1 tốn bao nhiêu" từ ledger thật thay vì ước tính.
 * Chi phí tính bằng {@link AiCostEstimator} (giá input/cache/output tách bạch), quy VND theo tỉ giá cấu hình.
 * Chỉ đọc; giới hạn cửa sổ ≤ 92 ngày để không quét cả bảng.
 */
@Service
@RequiredArgsConstructor
public class AdminAiUsageService {

    static final int MAX_WINDOW_DAYS = 92;
    static final int TOP_SESSIONS = 50;

    private final JdbcTemplate jdbcTemplate;
    private final AiCostEstimator costEstimator;

    public record FeatureModelRow(String feature, String model, long calls, long promptTokens, long cachedPromptTokens,
                                  long completionTokens, long totalTokens, double estUsd, long estVnd) {}

    public record SttRow(String feature, String model, long calls, double seconds, double estUsd, long estVnd) {}

    public record SessionRow(long sessionId, String features, long calls, long totalTokens, double estUsd, long estVnd) {}

    public record Totals(long calls, long totalTokens, double sttSeconds, double estUsd, long estVnd) {}

    public record Report(LocalDate from, LocalDate to, String featurePrefix, List<FeatureModelRow> rows,
                         List<SttRow> stt, List<SessionRow> sessions, Totals totals, long usdVndRate) {}

    @Transactional(readOnly = true)
    public Report report(LocalDate from, LocalDate to, String featurePrefix) {
        LocalDate end = to == null ? LocalDate.now(ZoneOffset.UTC) : to;
        LocalDate start = from == null ? end.minusDays(30) : from;
        if (start.isAfter(end)) {
            LocalDate t = start;
            start = end;
            end = t;
        }
        if (start.plusDays(MAX_WINDOW_DAYS).isBefore(end)) {
            start = end.minusDays(MAX_WINDOW_DAYS);
        }
        Timestamp lo = Timestamp.from(start.atStartOfDay().toInstant(ZoneOffset.UTC));
        Timestamp hi = Timestamp.from(end.plusDays(1).atStartOfDay().toInstant(ZoneOffset.UTC));
        String like = (featurePrefix == null || featurePrefix.isBlank() ? "" : featurePrefix.trim()) + "%";

        List<FeatureModelRow> rows = new ArrayList<>();
        double usdSum = 0;
        long callsSum = 0;
        long tokensSum = 0;
        for (Map<String, Object> r : jdbcTemplate.queryForList("""
                SELECT feature, model, COUNT(*) AS calls,
                       COALESCE(SUM(prompt_tokens), 0) AS prompt_tokens,
                       COALESCE(SUM(cached_prompt_tokens), 0) AS cached_prompt_tokens,
                       COALESCE(SUM(completion_tokens), 0) AS completion_tokens,
                       COALESCE(SUM(total_tokens), 0) AS total_tokens
                  FROM ai_token_usage_events
                 WHERE created_at >= ? AND created_at < ? AND COALESCE(feature, '') LIKE ?
                 GROUP BY feature, model
                 ORDER BY total_tokens DESC
                """, lo, hi, like)) {
            String model = str(r.get("model"));
            long prompt = num(r.get("prompt_tokens"));
            long cached = num(r.get("cached_prompt_tokens"));
            long completion = num(r.get("completion_tokens"));
            double usd = usd(model, prompt, cached, completion);
            rows.add(new FeatureModelRow(str(r.get("feature")), model, num(r.get("calls")), prompt, cached, completion,
                    num(r.get("total_tokens")), round4(usd), vnd(usd)));
            usdSum += usd;
            callsSum += num(r.get("calls"));
            tokensSum += num(r.get("total_tokens"));
        }

        List<SttRow> stt = new ArrayList<>();
        double sttSeconds = 0;
        for (Map<String, Object> r : jdbcTemplate.queryForList("""
                SELECT feature, model, COUNT(*) AS calls, COALESCE(SUM(audio_duration_secs), 0) AS seconds
                  FROM stt_usage_events
                 WHERE created_at >= ? AND created_at < ? AND COALESCE(feature, '') LIKE ?
                 GROUP BY feature, model
                 ORDER BY seconds DESC
                """, lo, hi, like)) {
            double seconds = dbl(r.get("seconds"));
            double usd = seconds * AiCostEstimator.WHISPER_USD_PER_SEC;
            stt.add(new SttRow(str(r.get("feature")), str(r.get("model")), num(r.get("calls")), round2(seconds), round4(usd), vnd(usd)));
            usdSum += usd;
            callsSum += num(r.get("calls"));
            sttSeconds += seconds;
        }

        List<SessionRow> sessions = new ArrayList<>();
        for (Map<String, Object> r : jdbcTemplate.queryForList("""
                SELECT session_id, STRING_AGG(DISTINCT feature, ',') AS features, COUNT(*) AS calls,
                       COALESCE(SUM(total_tokens), 0) AS total_tokens,
                       COALESCE(SUM(prompt_tokens), 0) AS prompt_tokens,
                       COALESCE(SUM(cached_prompt_tokens), 0) AS cached_prompt_tokens,
                       COALESCE(SUM(completion_tokens), 0) AS completion_tokens,
                       MAX(model) AS model
                  FROM ai_token_usage_events
                 WHERE created_at >= ? AND created_at < ? AND COALESCE(feature, '') LIKE ? AND session_id IS NOT NULL
                 GROUP BY session_id
                 ORDER BY total_tokens DESC
                 LIMIT ?
                """, lo, hi, like, TOP_SESSIONS)) {
            double usd = usd(str(r.get("model")), num(r.get("prompt_tokens")), num(r.get("cached_prompt_tokens")),
                    num(r.get("completion_tokens")));
            sessions.add(new SessionRow(num(r.get("session_id")), str(r.get("features")), num(r.get("calls")),
                    num(r.get("total_tokens")), round4(usd), vnd(usd)));
        }

        return new Report(start, end, like.substring(0, like.length() - 1), rows, stt, sessions,
                new Totals(callsSum, tokensSum, round2(sttSeconds), round4(usdSum), vnd(usdSum)), costEstimator.usdVndRate());
    }

    private double usd(String model, long promptTokens, long cachedPromptTokens, long completionTokens) {
        AiCostEstimator.ModelRate rate = costEstimator.rateFor(model);
        long freshPrompt = Math.max(0, promptTokens - cachedPromptTokens);
        return freshPrompt * rate.inputPer1M() / 1_000_000.0
                + cachedPromptTokens * rate.effectiveCachedInputPer1M() / 1_000_000.0
                + completionTokens * rate.outputPer1M() / 1_000_000.0;
    }

    private long vnd(double usd) {
        return Math.round(usd * costEstimator.usdVndRate());
    }

    private static String str(Object o) {
        return o == null ? "" : String.valueOf(o);
    }

    private static long num(Object o) {
        return o instanceof Number n ? n.longValue() : 0L;
    }

    private static double dbl(Object o) {
        return o instanceof Number n ? n.doubleValue() : 0d;
    }

    private static double round2(double v) {
        return Math.round(v * 100.0) / 100.0;
    }

    private static double round4(double v) {
        return Math.round(v * 10_000.0) / 10_000.0;
    }

    @SuppressWarnings("unused")
    private static Instant unused() {
        return Instant.EPOCH;
    }
}
