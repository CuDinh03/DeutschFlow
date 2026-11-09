package com.deutschflow.admin.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.stream.Collectors;

/**
 * Keeps sales-demo activity out of aggregate analytics and COGS reporting.
 *
 * <p>The sales sandbox org (HV accounts on the {@code @deutschflow-demo.com} domain) generates
 * real AI-token rows in {@code ai_token_usage_events}/{@code stt_usage_events}. Counting those in
 * unit-economics (cost per active user, run-rate, cost-by-feature) skews the numbers that feed
 * pricing decisions, so the aggregate COGS endpoints exclude them. Per-user detail views are left
 * untouched — a demo account showing its own usage in the user list is harmless.
 *
 * <p>Demo accounts are matched by email domain (configurable, default {@code @deutschflow-demo.com}).
 * The exclusion can be turned off entirely via {@code app.analytics.exclude-demo-data=false}.
 */
@Component
public class DemoDataFilter {

    private final JdbcTemplate jdbcTemplate;
    private final boolean enabled;
    /** SQL {@code ILIKE} pattern (e.g. {@code %@deutschflow-demo.com}); empty disables matching. */
    private final String emailPattern;

    public DemoDataFilter(
            JdbcTemplate jdbcTemplate,
            @Value("${app.analytics.exclude-demo-data:true}") boolean enabled,
            @Value("${app.analytics.demo-email-domain:@deutschflow-demo.com}") String demoEmailDomain) {
        this.jdbcTemplate = jdbcTemplate;
        this.enabled = enabled;
        String domain = demoEmailDomain == null ? "" : demoEmailDomain.trim();
        this.emailPattern = domain.isEmpty() ? "" : "%" + domain;
    }

    /**
     * Predicate connected with {@code AND}, for queries that already have a {@code WHERE} clause.
     * Returns {@code ""} when disabled or when no demo accounts exist, so callers can append it
     * unconditionally with zero behaviour change.
     */
    public String andExcludeDemo() {
        String predicate = demoPredicate();
        return predicate.isEmpty() ? "" : " AND " + predicate;
    }

    /**
     * Predicate connected with {@code WHERE}, for queries with no existing {@code WHERE} clause.
     * Returns {@code ""} when disabled or when no demo accounts exist.
     */
    public String whereExcludeDemo() {
        String predicate = demoPredicate();
        return predicate.isEmpty() ? "" : " WHERE " + predicate;
    }

    /**
     * Bare SQL predicate excluding ledger rows owned by demo accounts on column {@code user_id}
     * (shared by {@code ai_token_usage_events} and {@code stt_usage_events}). Rows with
     * {@code NULL user_id} are kept — they are system events (e.g. STT for a deleted user), not demo.
     * IDs are inlined as integer literals sourced from the DB, never from user input.
     */
    private String demoPredicate() {
        if (!enabled || emailPattern.isEmpty()) {
            return "";
        }
        List<Long> demoUserIds = jdbcTemplate.queryForList(
                "SELECT id FROM users WHERE email ILIKE ?", Long.class, emailPattern);
        if (demoUserIds.isEmpty()) {
            return "";
        }
        String idCsv = demoUserIds.stream().map(String::valueOf).collect(Collectors.joining(","));
        return "(user_id IS NULL OR user_id NOT IN (" + idCsv + "))";
    }

    /**
     * Predicate nối bằng {@code AND} loại các TRUNG TÂM demo trên cột {@code orgIdColumn} (vd
     * {@code org_id} của {@code org_invoices}) — đợt 1 admin, 09/11/2026: doanh thu B2B không được
     * cộng hoá đơn của trung tâm sandbox bán hàng.
     *
     * <p>Trung tâm demo = trung tâm có ít nhất một tài khoản thuộc domain demo ({@code users.org_id}).
     * Trung tâm thật không bao giờ chứa tài khoản {@code @deutschflow-demo.com}. Trả {@code ""} khi tắt
     * hoặc không có trung tâm demo. {@code orgIdColumn} là hằng số trong code, không phải input.
     */
    public String andExcludeDemoOrgs(String orgIdColumn) {
        if (!enabled || emailPattern.isEmpty()) {
            return "";
        }
        List<Long> demoOrgIds = jdbcTemplate.queryForList(
                "SELECT DISTINCT org_id FROM users WHERE email ILIKE ? AND org_id IS NOT NULL",
                Long.class, emailPattern);
        if (demoOrgIds.isEmpty()) {
            return "";
        }
        String idCsv = demoOrgIds.stream().map(String::valueOf).collect(Collectors.joining(","));
        return " AND (" + orgIdColumn + " IS NULL OR " + orgIdColumn + " NOT IN (" + idCsv + "))";
    }
}
