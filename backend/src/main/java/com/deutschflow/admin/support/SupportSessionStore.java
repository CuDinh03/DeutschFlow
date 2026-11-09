package com.deutschflow.admin.support;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

/**
 * Truy cập {@code admin_support_sessions} / {@code admin_support_session_events} (V370) bằng JdbcTemplate. Mọi
 * mốc thời gian so với {@code now()} của PostgreSQL — một đồng hồ duy nhất cho cả bắt đầu, hết hạn, mã bàn giao.
 */
@Repository
@RequiredArgsConstructor
public class SupportSessionStore {

    /** Thời lượng tối đa một phiên (owner chốt: 30 phút). */
    public static final int SESSION_MINUTES = 30;
    /** Mã bàn giao sống 60 giây. */
    public static final int HANDOFF_SECONDS = 60;

    private final JdbcTemplate jdbc;

    public record SessionRow(long id, long adminUserId, long targetUserId, String reason, Instant startedAt,
                             Instant expiresAt, Instant endedAt, String endReason) {
    }

    /** Dòng phiên ghép trạng thái hiện tại của admin và người dùng đích — đầu vào của bước xác minh mỗi request. */
    public record VerificationRow(long id, long adminUserId, long targetUserId, Instant expiresAt, Instant endedAt,
                                  String adminEmail, String adminRole, boolean adminActive,
                                  String targetEmail, String targetRole, boolean targetActive) {
    }

    public record HandoffRow(long id, long adminUserId, long targetUserId, Instant expiresAt, Instant endedAt,
                             Instant handoffExpiresAt, Instant handoffUsedAt, Instant dbNow) {
    }

    public record EndedRow(long id, long adminUserId, long targetUserId, boolean expired) {
    }

    public record SessionListRow(long id, long adminUserId, String adminEmail, String reason, Instant startedAt,
                                 Instant expiresAt, Instant endedAt, String endReason, long requestCount,
                                 boolean active) {
    }

    /** Khoá dòng users của admin — tuần tự hoá các lần mở phiên của CÙNG một admin (một phiên mở + trần ngày). */
    public void lockAdminRow(long adminUserId) {
        jdbc.query("SELECT id FROM users WHERE id = ? FOR UPDATE", rs -> null, adminUserId);
    }

    public int countStartedLast24h(long adminUserId) {
        Integer n = jdbc.queryForObject(
                "SELECT COUNT(*) FROM admin_support_sessions WHERE admin_user_id = ? AND started_at > now() - INTERVAL '24 hours'",
                Integer.class, adminUserId);
        return n == null ? 0 : n;
    }

    /** Đóng mọi phiên còn mở của admin; phiên đã quá hạn ghi {@code expired}, phiên còn sống ghi {@code reason}. */
    public List<EndedRow> endOpenForAdmin(long adminUserId, String reason) {
        return jdbc.query("""
                UPDATE admin_support_sessions
                   SET ended_at = now(),
                       end_reason = CASE WHEN expires_at <= now() THEN 'expired' ELSE ? END,
                       handoff_code_hash = NULL
                 WHERE admin_user_id = ? AND ended_at IS NULL
                RETURNING id, admin_user_id, target_user_id, (expires_at <= now()) AS was_expired
                """, (rs, i) -> endedRow(rs), reason, adminUserId);
    }

    public List<EndedRow> endOpenForTarget(long targetUserId, String reason) {
        return jdbc.query("""
                UPDATE admin_support_sessions
                   SET ended_at = now(),
                       end_reason = CASE WHEN expires_at <= now() THEN 'expired' ELSE ? END,
                       handoff_code_hash = NULL
                 WHERE target_user_id = ? AND ended_at IS NULL
                RETURNING id, admin_user_id, target_user_id, (expires_at <= now()) AS was_expired
                """, (rs, i) -> endedRow(rs), reason, targetUserId);
    }

    /** Đóng một phiên nếu còn mở; {@code empty} khi phiên không tồn tại hoặc đã đóng. */
    public Optional<EndedRow> endOne(long sessionId, String reason) {
        List<EndedRow> rows = jdbc.query("""
                UPDATE admin_support_sessions
                   SET ended_at = now(),
                       end_reason = CASE WHEN expires_at <= now() THEN 'expired' ELSE ? END,
                       handoff_code_hash = NULL
                 WHERE id = ? AND ended_at IS NULL
                RETURNING id, admin_user_id, target_user_id, (expires_at <= now()) AS was_expired
                """, (rs, i) -> endedRow(rs), reason, sessionId);
        return rows.stream().findFirst();
    }

    /** Đóng các phiên đã quá {@code expires_at} mà chưa ai đóng (job định kỳ). */
    public List<EndedRow> endExpired(int limit) {
        return jdbc.query("""
                UPDATE admin_support_sessions
                   SET ended_at = now(), end_reason = 'expired', handoff_code_hash = NULL
                 WHERE id IN (SELECT id FROM admin_support_sessions
                               WHERE ended_at IS NULL AND expires_at <= now()
                               ORDER BY id LIMIT ? FOR UPDATE SKIP LOCKED)
                RETURNING id, admin_user_id, target_user_id, TRUE AS was_expired
                """, (rs, i) -> endedRow(rs), limit);
    }

    /** Tạo phiên mới; trả id + expires_at (DB). */
    public SessionRow insert(long adminUserId, long targetUserId, String reason, String handoffHash) {
        return jdbc.queryForObject("""
                INSERT INTO admin_support_sessions
                    (admin_user_id, target_user_id, reason, started_at, expires_at, handoff_code_hash, handoff_expires_at)
                VALUES (?, ?, ?, now(), now() + make_interval(mins => ?), ?, now() + make_interval(secs => ?))
                RETURNING id, admin_user_id, target_user_id, reason, started_at, expires_at, ended_at, end_reason
                """, (rs, i) -> sessionRow(rs),
                adminUserId, targetUserId, reason, SESSION_MINUTES, handoffHash, HANDOFF_SECONDS);
    }

    public Optional<SessionRow> find(long sessionId) {
        return jdbc.query("""
                SELECT id, admin_user_id, target_user_id, reason, started_at, expires_at, ended_at, end_reason
                  FROM admin_support_sessions WHERE id = ?
                """, (rs, i) -> sessionRow(rs), sessionId).stream().findFirst();
    }

    /** Khoá dòng có mã bàn giao này (redeem). */
    public Optional<HandoffRow> lockByHandoffHash(String handoffHash) {
        return jdbc.query("""
                SELECT id, admin_user_id, target_user_id, expires_at, ended_at, handoff_expires_at, handoff_used_at,
                       now() AS db_now
                  FROM admin_support_sessions WHERE handoff_code_hash = ? FOR UPDATE
                """, (rs, i) -> new HandoffRow(
                        rs.getLong("id"), rs.getLong("admin_user_id"), rs.getLong("target_user_id"),
                        instant(rs, "expires_at"), instant(rs, "ended_at"), instant(rs, "handoff_expires_at"),
                        instant(rs, "handoff_used_at"), instant(rs, "db_now")),
                handoffHash).stream().findFirst();
    }

    /** Đốt mã bàn giao (dùng một lần) — cả khi lần redeem này thất bại. */
    public void burnHandoff(long sessionId) {
        jdbc.update("UPDATE admin_support_sessions SET handoff_used_at = now(), handoff_code_hash = NULL WHERE id = ?",
                sessionId);
    }

    public Optional<VerificationRow> loadForVerification(long sessionId) {
        return jdbc.query("""
                SELECT s.id, s.admin_user_id, s.target_user_id, s.expires_at, s.ended_at,
                       a.email AS admin_email, a.role AS admin_role, a.is_active AS admin_active,
                       t.email AS target_email, t.role AS target_role, t.is_active AS target_active
                  FROM admin_support_sessions s
                  JOIN users a ON a.id = s.admin_user_id
                  JOIN users t ON t.id = s.target_user_id
                 WHERE s.id = ?
                """, (rs, i) -> new VerificationRow(
                        rs.getLong("id"), rs.getLong("admin_user_id"), rs.getLong("target_user_id"),
                        instant(rs, "expires_at"), instant(rs, "ended_at"),
                        rs.getString("admin_email"), rs.getString("admin_role"), rs.getBoolean("admin_active"),
                        rs.getString("target_email"), rs.getString("target_role"), rs.getBoolean("target_active")),
                sessionId).stream().findFirst();
    }

    public List<SessionListRow> listForTarget(long targetUserId, int limit) {
        return jdbc.query("""
                SELECT s.id, s.admin_user_id, a.email AS admin_email, s.reason, s.started_at, s.expires_at,
                       s.ended_at, s.end_reason,
                       (SELECT COUNT(*) FROM admin_support_session_events e WHERE e.session_id = s.id) AS request_count,
                       (s.ended_at IS NULL AND s.expires_at > now()) AS active
                  FROM admin_support_sessions s
                  JOIN users a ON a.id = s.admin_user_id
                 WHERE s.target_user_id = ?
                 ORDER BY s.started_at DESC, s.id DESC
                 LIMIT ?
                """, (rs, i) -> new SessionListRow(
                        rs.getLong("id"), rs.getLong("admin_user_id"), rs.getString("admin_email"),
                        rs.getString("reason"), instant(rs, "started_at"), instant(rs, "expires_at"),
                        instant(rs, "ended_at"), rs.getString("end_reason"), rs.getLong("request_count"),
                        rs.getBoolean("active")),
                targetUserId, limit);
    }

    /** Ghi một request của phiên (method, đường dẫn không query string, status). */
    public void insertEvent(long sessionId, String method, String path, int status) {
        jdbc.update("INSERT INTO admin_support_session_events (session_id, method, path, status) VALUES (?, ?, ?, ?)",
                sessionId, truncate(method, 8), truncate(path, 300), status);
    }

    private static String truncate(String v, int max) {
        if (v == null) {
            return "";
        }
        return v.length() <= max ? v : v.substring(0, max);
    }

    private static EndedRow endedRow(ResultSet rs) throws SQLException {
        return new EndedRow(rs.getLong("id"), rs.getLong("admin_user_id"), rs.getLong("target_user_id"),
                rs.getBoolean("was_expired"));
    }

    private static SessionRow sessionRow(ResultSet rs) throws SQLException {
        return new SessionRow(rs.getLong("id"), rs.getLong("admin_user_id"), rs.getLong("target_user_id"),
                rs.getString("reason"), instant(rs, "started_at"), instant(rs, "expires_at"),
                instant(rs, "ended_at"), rs.getString("end_reason"));
    }

    private static Instant instant(ResultSet rs, String col) throws SQLException {
        Timestamp ts = rs.getTimestamp(col);
        return ts == null ? null : ts.toInstant();
    }
}
