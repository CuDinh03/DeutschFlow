package com.deutschflow.vocabulary.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.time.YearMonth;
import java.time.ZoneOffset;

/**
 * Theo dõi số ký tự đầu vào theo nhà cung cấp + tháng (UTC {@link YearMonth}) để hard-cap free tier (DeepL 490k, …).
 * Một câu lệnh UPDATE với điều kiện đảm bảo không vượt trần dưới hầu hết concurrency.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class TranslationUsageMeter {

    public static final String PROVIDER_DEEPL_FREE = "DEEPL_FREE";

    private final JdbcTemplate jdbcTemplate;

    /**
     * @return {@code false} khi không thêm được {@code delta} mà không vượt {@code monthlyHardCap}.
     */
    public boolean tryConsume(String provider, YearMonth billingMonth, long delta, long monthlyHardCap) {
        if (delta <= 0) {
            return true;
        }
        String ym = billingMonth.toString();
        jdbcTemplate.update(
                """
                INSERT INTO translation_provider_monthly_usage (provider, billing_month, chars_input)
                VALUES (?, ?, 0)
                ON CONFLICT (provider, billing_month) DO NOTHING
                """,
                provider, ym);

        int n = jdbcTemplate.update(
                """
                UPDATE translation_provider_monthly_usage
                SET chars_input = chars_input + ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE provider = ? AND billing_month = ?
                  AND chars_input + ? <= ?
                """,
                delta, provider, ym, delta, monthlyHardCap);

        boolean ok = n == 1;
        if (!ok) {
            log.warn("TranslationUsageMeter: cap hit or row missing provider={} month={} delta={} cap={}",
                    provider, ym, delta, monthlyHardCap);
        }
        return ok;
    }

    public long currentUsage(String provider, YearMonth billingMonth) {
        Long v = jdbcTemplate.query(
                "SELECT chars_input FROM translation_provider_monthly_usage WHERE provider = ? AND billing_month = ?",
                rs -> rs.next() ? rs.getLong(1) : 0L,
                provider,
                billingMonth.toString());
        return v != null ? v : 0L;
    }

    /** Tháng billing UTC hiện tại cho DeepL / Azure quota. */
    public static YearMonth currentBillingMonthUtc() {
        return YearMonth.now(ZoneOffset.UTC);
    }
}
