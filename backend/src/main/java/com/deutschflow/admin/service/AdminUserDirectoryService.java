package com.deutschflow.admin.service;

import com.deutschflow.admin.dto.AdminUserDirectoryDtos.QuotaView;
import com.deutschflow.admin.dto.AdminUserDirectoryDtos.TopUsageUser;
import com.deutschflow.admin.dto.AdminUserDirectoryDtos.UserProfile;
import com.deutschflow.admin.dto.AdminUserDirectoryDtos.UserRow;
import com.deutschflow.admin.dto.AdminUserDirectoryDtos.UserSearchPage;
import com.deutschflow.admin.dto.AdminUserDirectoryDtos.UserStats;
import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.common.quota.QuotaService;
import com.deutschflow.common.quota.QuotaSnapshot;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Danh bạ người dùng cho admin (đợt 1 "Nền móng + Người dùng", 09/11/2026).
 *
 * <p>Thay {@code GET /admin/users} (trả cả bảng, ~4N+2 truy vấn vì tra quota từng người) bằng:
 * <ul>
 *   <li>{@link #search}: lọc + sắp xếp + phân trang trên server; quota chỉ tra cho các dòng của
 *       trang qua {@link QuotaService#getSnapshotsReadOnly} (3 truy vấn cho cả trang).</li>
 *   <li>{@link #stats}: KPI đếm trên cả bảng bằng một câu {@code COUNT(*) FILTER}.</li>
 *   <li>{@link #profile}: phần đầu trang hồ sơ một người.</li>
 * </ul>
 * Theo khuôn phân trang của {@code AuditLogService.read}: COUNT và trang dùng chung một mệnh đề
 * WHERE, {@code size} kẹp 1..100, tham số luôn bind (giá trị sort lấy từ whitelist, không nối chuỗi
 * từ input).
 */
@Service
@RequiredArgsConstructor
public class AdminUserDirectoryService {

    public static final int MAX_PAGE_SIZE = 100;
    public static final Set<String> ROLES = Set.of("STUDENT", "TEACHER", "MANAGER", "OWNER", "ADMIN");
    private static final Pattern PLAN_CODE = Pattern.compile("[A-Z][A-Z0-9_]{0,31}");
    private static final Map<String, String> SORT_COLUMNS = Map.of(
            "createdAt", "u.created_at",
            "displayName", "LOWER(u.display_name)",
            "email", "LOWER(u.email)",
            "usage30d", "usage30.tokens");
    private static final String DEFAULT_SORT = "createdAt,desc";

    private final JdbcTemplate jdbcTemplate;
    private final QuotaService quotaService;
    private final DemoDataFilter demoDataFilter;

    /** Tiêu chí tìm kiếm đã nhận từ query string (chưa kiểm). */
    public record Criteria(String q, String role, String status, String plan, String org, String sort,
                           int page, int size) {
    }

    @Transactional(readOnly = true)
    public UserSearchPage search(Criteria c) {
        Instant now = Instant.now();
        Timestamp nowTs = Timestamp.from(now);
        Timestamp since30 = Timestamp.from(now.minus(30, ChronoUnit.DAYS));
        int size = Math.min(Math.max(c.size(), 1), MAX_PAGE_SIZE);
        int page = Math.max(c.page(), 0);
        String[] sort = parseSort(c.sort());

        StringBuilder where = new StringBuilder(" WHERE 1=1");
        List<Object> args = new ArrayList<>();
        appendFilters(c, where, args);
        boolean needsPlan = c.plan() != null && !c.plan().isBlank();

        // LATERAL gói hiệu lực: cùng điều kiện + thứ tự với QuotaService.loadActiveCoveringSubscription.
        String planJoin = """
                 LEFT JOIN LATERAL (
                     SELECT us.plan_code
                     FROM user_subscriptions us
                     JOIN subscription_plans sp ON sp.code = us.plan_code
                     WHERE us.user_id = u.id
                       AND us.status = 'ACTIVE'
                       AND sp.is_active
                       AND us.starts_at <= ?
                       AND (us.ends_at IS NULL OR us.ends_at > ?)
                     ORDER BY us.starts_at DESC, us.id DESC
                     LIMIT 1
                 ) sub ON TRUE
                """;

        List<Object> countArgs = new ArrayList<>();
        if (needsPlan) {
            countArgs.add(nowTs);
            countArgs.add(nowTs);
        }
        countArgs.addAll(args);
        Long total = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM users u" + (needsPlan ? planJoin : "") + where,
                Long.class, countArgs.toArray());

        List<Object> pageArgs = new ArrayList<>();
        pageArgs.add(nowTs);
        pageArgs.add(nowTs);
        pageArgs.add(since30);
        pageArgs.addAll(args);
        pageArgs.add(size);
        pageArgs.add((long) page * size);
        String sql = """
                SELECT u.id, u.email, u.display_name, u.role, u.is_active, u.created_at,
                       u.org_id, o.name AS org_name,
                       COALESCE(sub.plan_code, 'DEFAULT') AS plan_code,
                       usage30.tokens AS usage30
                FROM users u
                LEFT JOIN organizations o ON o.id = u.org_id
                """ + planJoin + """
                 LEFT JOIN LATERAL (
                     SELECT COALESCE(SUM(e.total_tokens), 0) AS tokens
                     FROM ai_token_usage_events e
                     WHERE e.user_id = u.id AND e.created_at >= ?
                 ) usage30 ON TRUE
                """ + where
                + " ORDER BY " + SORT_COLUMNS.get(sort[0]) + " " + sort[1].toUpperCase(Locale.ROOT)
                + " NULLS LAST, u.id DESC LIMIT ? OFFSET ?";

        List<Map<String, Object>> rows = jdbcTemplate.queryForList(sql, pageArgs.toArray());
        List<Long> ids = rows.stream().map(r -> toLong(r.get("id"))).toList();
        Map<Long, QuotaSnapshot> snaps = quotaService.getSnapshotsReadOnly(ids, now);

        List<UserRow> items = new ArrayList<>(rows.size());
        for (Map<String, Object> r : rows) {
            long id = toLong(r.get("id"));
            QuotaSnapshot snap = snaps.get(id);
            items.add(new UserRow(
                    id,
                    str(r.get("email")),
                    str(r.get("display_name")),
                    str(r.get("role")),
                    Boolean.TRUE.equals(r.get("is_active")),
                    iso(r.get("created_at")),
                    r.get("org_id") == null ? null : toLong(r.get("org_id")),
                    str(r.get("org_name")),
                    snap != null ? snap.planCode() : str(r.get("plan_code")),
                    toLong(r.get("usage30")),
                    snap == null ? null : quotaView(snap)));
        }
        return new UserSearchPage(items, total == null ? 0L : total, page, size, sort[0] + "," + sort[1]);
    }

    @Transactional(readOnly = true)
    public UserStats stats() {
        Map<String, Object> c = jdbcTemplate.queryForMap("""
                SELECT COUNT(*) AS total,
                       COUNT(*) FILTER (WHERE is_active) AS active,
                       COUNT(*) FILTER (WHERE NOT is_active) AS locked,
                       COUNT(*) FILTER (WHERE role = 'STUDENT') AS r_student,
                       COUNT(*) FILTER (WHERE role = 'TEACHER') AS r_teacher,
                       COUNT(*) FILTER (WHERE role = 'MANAGER') AS r_manager,
                       COUNT(*) FILTER (WHERE role = 'OWNER') AS r_owner,
                       COUNT(*) FILTER (WHERE role = 'ADMIN') AS r_admin,
                       COUNT(*) FILTER (WHERE role = 'TEACHER' AND org_id IS NULL AND is_active) AS free_teachers
                FROM users
                """);
        Map<String, Long> byRole = new LinkedHashMap<>();
        byRole.put("STUDENT", toLong(c.get("r_student")));
        byRole.put("TEACHER", toLong(c.get("r_teacher")));
        byRole.put("MANAGER", toLong(c.get("r_manager")));
        byRole.put("OWNER", toLong(c.get("r_owner")));
        byRole.put("ADMIN", toLong(c.get("r_admin")));

        Timestamp since30 = Timestamp.from(Instant.now().minus(30, ChronoUnit.DAYS));
        String demoAnd = demoDataFilter.andExcludeDemo();
        Long aiActive = jdbcTemplate.queryForObject(
                "SELECT COUNT(DISTINCT user_id) FROM ai_token_usage_events WHERE user_id IS NOT NULL AND created_at >= ?"
                        + demoAnd,
                Long.class, since30);
        List<TopUsageUser> top = jdbcTemplate.query("""
                        SELECT u.id, u.email, u.display_name, u.role, t.tokens
                        FROM (
                            SELECT user_id, SUM(total_tokens) AS tokens
                            FROM ai_token_usage_events
                            WHERE user_id IS NOT NULL AND created_at >= ?%s
                            GROUP BY user_id
                            ORDER BY tokens DESC
                            LIMIT 8
                        ) t
                        JOIN users u ON u.id = t.user_id
                        ORDER BY t.tokens DESC, u.id
                        """.formatted(demoAnd),
                (rs, i) -> new TopUsageUser(rs.getLong("id"), rs.getString("email"), rs.getString("display_name"),
                        rs.getString("role"), rs.getLong("tokens")),
                since30);

        return new UserStats(
                toLong(c.get("total")),
                toLong(c.get("active")),
                toLong(c.get("locked")),
                byRole,
                aiActive == null ? 0L : aiActive,
                toLong(c.get("free_teachers")),
                top);
    }

    @Transactional(readOnly = true)
    public UserProfile profile(long userId) {
        List<Map<String, Object>> rows = jdbcTemplate.queryForList("""
                SELECT u.id, u.email, u.display_name, u.role, u.is_active, u.created_at, u.locale,
                       u.org_id, o.name AS org_name
                FROM users u
                LEFT JOIN organizations o ON o.id = u.org_id
                WHERE u.id = ?
                """, userId);
        if (rows.isEmpty()) {
            throw new NotFoundException("User not found");
        }
        Map<String, Object> r = rows.get(0);
        QuotaSnapshot snap = quotaService.getSnapshotReadOnly(userId, Instant.now());
        return new UserProfile(
                userId,
                str(r.get("email")),
                str(r.get("display_name")),
                str(r.get("role")),
                Boolean.TRUE.equals(r.get("is_active")),
                iso(r.get("created_at")),
                str(r.get("locale")),
                r.get("org_id") == null ? null : toLong(r.get("org_id")),
                str(r.get("org_name")),
                snap.planCode(),
                snap.subscriptionStartsAtUtc() == null ? null : snap.subscriptionStartsAtUtc().toString(),
                snap.subscriptionEndsAtUtc() == null ? null : snap.subscriptionEndsAtUtc().toString());
    }

    // ── helpers ─────────────────────────────────────────────────────────────

    private static void appendFilters(Criteria c, StringBuilder where, List<Object> args) {
        if (c.q() != null && !c.q().isBlank()) {
            String q = c.q().trim();
            String like = "%" + q + "%";
            where.append(" AND (u.email ILIKE ? OR u.display_name ILIKE ? OR CAST(u.id AS text) = ?)");
            args.add(like);
            args.add(like);
            args.add(q);
        }
        if (c.role() != null && !c.role().isBlank()) {
            String role = c.role().trim().toUpperCase(Locale.ROOT);
            if (!ROLES.contains(role)) {
                throw new BadRequestException("Invalid role filter: " + c.role());
            }
            where.append(" AND u.role = ?");
            args.add(role);
        }
        if (c.status() != null && !c.status().isBlank()) {
            switch (c.status().trim().toLowerCase(Locale.ROOT)) {
                case "active" -> where.append(" AND u.is_active");
                case "locked" -> where.append(" AND NOT u.is_active");
                default -> throw new BadRequestException("Invalid status filter: " + c.status());
            }
        }
        if (c.plan() != null && !c.plan().isBlank()) {
            String plan = c.plan().trim().toUpperCase(Locale.ROOT);
            if (!PLAN_CODE.matcher(plan).matches()) {
                throw new BadRequestException("Invalid plan filter: " + c.plan());
            }
            where.append(" AND COALESCE(sub.plan_code, 'DEFAULT') = ?");
            args.add(plan);
        }
        if (c.org() != null && !c.org().isBlank()) {
            String org = c.org().trim().toLowerCase(Locale.ROOT);
            switch (org) {
                case "none" -> where.append(" AND u.org_id IS NULL");
                case "any" -> where.append(" AND u.org_id IS NOT NULL");
                default -> {
                    try {
                        args.add(Long.parseLong(org));
                    } catch (NumberFormatException e) {
                        throw new BadRequestException("Invalid org filter: " + c.org());
                    }
                    where.append(" AND u.org_id = ?");
                }
            }
        }
    }

    /** "field,dir" → [field, dir]; trống = mặc định; trường hoặc chiều lạ → 400 (không âm thầm đổi nghĩa). */
    static String[] parseSort(String raw) {
        String s = raw == null || raw.isBlank() ? DEFAULT_SORT : raw.trim();
        String[] parts = s.split(",", -1);
        String field = parts[0].trim();
        String dir = parts.length > 1 ? parts[1].trim().toLowerCase(Locale.ROOT) : "asc";
        if (!SORT_COLUMNS.containsKey(field) || !(dir.equals("asc") || dir.equals("desc")) || parts.length > 2) {
            throw new BadRequestException("Invalid sort: " + raw);
        }
        return new String[]{field, dir};
    }

    static QuotaView quotaView(QuotaSnapshot snap) {
        return new QuotaView(
                AdminManagementService.classifyQuotaKind(snap),
                snap.unlimitedInternal(),
                snap.monthlyTokenLimit(),
                snap.remainingThisMonth(),
                snap.walletBalance(),
                snap.walletCap(),
                snap.dailyTokenGrant(),
                snap.usedToday());
    }

    private static String str(Object v) {
        return v == null ? null : String.valueOf(v);
    }

    private static String iso(Object v) {
        if (v instanceof Timestamp ts) {
            return ts.toLocalDateTime().toString();
        }
        return v == null ? null : String.valueOf(v);
    }

    private static long toLong(Object v) {
        if (v instanceof Number n) {
            return n.longValue();
        }
        if (v == null) {
            return 0L;
        }
        try {
            return Long.parseLong(String.valueOf(v));
        } catch (NumberFormatException e) {
            return 0L;
        }
    }
}
