package com.deutschflow.grammar.service;

import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.system.service.SystemConfigService;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Admin chọn học viên nào được dùng luyện đề telc (04/11/2026) — thay cho sửa tay
 * {@code system_config} trên DB. Danh sách lưu lại dạng id ngăn cách bằng dấu phẩy; mục cũ là email
 * (nhập tay trước khi có trang này) vẫn được {@link MockExamPracticeService#hasAccess} nhận, và được
 * đổi sang id khi admin thêm lại hoặc gỡ tài khoản đó.
 */
@Service
public class PracticeAccessAdminService {

    public static final List<String> MODES = List.of("OFF", "ALLOWLIST", "ALL");
    private static final int SEARCH_LIMIT = 10;

    public record Member(long id, String email, String displayName, String role) {}

    /** {@code unknown}: mục trong danh sách không khớp tài khoản nào (đã xoá, gõ sai email). */
    public record State(String mode, List<Member> members, List<String> unknown) {}

    private final JdbcTemplate jdbc;
    private final SystemConfigService config;

    public PracticeAccessAdminService(JdbcTemplate jdbc, SystemConfigService config) {
        this.jdbc = jdbc;
        this.config = config;
    }

    public State state() {
        String mode = read(MockExamPracticeService.ACCESS_KEY, "ALLOWLIST").trim().toUpperCase(Locale.ROOT);
        List<String> tokens = tokens();
        List<Member> members = new ArrayList<>();
        List<String> unknown = new ArrayList<>();
        for (String token : tokens) {
            Member m = find(token);
            if (m == null) unknown.add(token);
            else if (members.stream().noneMatch(x -> x.id() == m.id())) members.add(m);
        }
        return new State(MODES.contains(mode) ? mode : "ALLOWLIST", members, unknown);
    }

    public State setMode(String mode) {
        String m = mode == null ? "" : mode.trim().toUpperCase(Locale.ROOT);
        if (!MODES.contains(m)) throw new BadRequestException("Chế độ phải là OFF, ALLOWLIST hoặc ALL.");
        config.setString(MockExamPracticeService.ACCESS_KEY, m, null);
        return state();
    }

    /** Thêm theo id hoặc email; lưu bằng id. Mục email cũ của cùng tài khoản được gộp lại. */
    public State add(String identifier) {
        Member m = find(identifier == null ? "" : identifier.trim());
        if (m == null) throw new NotFoundException("Không tìm thấy tài khoản với id hoặc email này.");
        Set<String> next = new LinkedHashSet<>();
        for (String token : tokens()) if (!sameUser(token, m)) next.add(token);
        next.add(String.valueOf(m.id()));
        save(next);
        return state();
    }

    public State remove(long userId) {
        Member m = find(String.valueOf(userId));
        Set<String> next = new LinkedHashSet<>();
        for (String token : tokens()) {
            if (token.equals(String.valueOf(userId))) continue;
            if (m != null && sameUser(token, m)) continue;
            next.add(token);
        }
        save(next);
        return state();
    }

    /** Gỡ một mục không khớp tài khoản nào (hiện ở phần "không nhận ra"). */
    public State removeToken(String token) {
        Set<String> next = new LinkedHashSet<>(tokens());
        next.remove(token == null ? "" : token.trim().toLowerCase(Locale.ROOT));
        save(next);
        return state();
    }

    /** Tìm tài khoản theo email hoặc tên hiển thị (≥ 2 ký tự), tối đa 10 kết quả. */
    public List<Member> search(String q) {
        String term = q == null ? "" : q.trim().toLowerCase(Locale.ROOT);
        if (term.length() < 2) return List.of();
        String like = "%" + term.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
        return jdbc.query("""
                SELECT id, email, display_name, role::text AS role FROM users
                WHERE lower(email) LIKE ? OR lower(display_name) LIKE ?
                ORDER BY (role = 'STUDENT') DESC, id
                LIMIT ?
                """, (rs, n) -> new Member(rs.getLong("id"), rs.getString("email"), rs.getString("display_name"),
                rs.getString("role")), like, like, SEARCH_LIMIT);
    }

    // ─── nội bộ ──────────────────────────────────────────────────────────────

    private List<String> tokens() {
        List<String> out = new ArrayList<>();
        for (String t : read(MockExamPracticeService.ALLOWLIST_KEY, "").split("[,;\\s]+")) {
            String s = t.trim().toLowerCase(Locale.ROOT);
            if (!s.isEmpty() && !out.contains(s)) out.add(s);
        }
        return out;
    }

    private void save(Set<String> tokens) {
        config.setString(MockExamPracticeService.ALLOWLIST_KEY, String.join(",", tokens), null);
    }

    private Member find(String token) {
        if (token.isEmpty()) return null;
        List<Member> rows;
        if (token.matches("\\d{1,18}")) {
            rows = jdbc.query("SELECT id, email, display_name, role::text AS role FROM users WHERE id = ?",
                    (rs, n) -> member(rs.getLong("id"), rs.getString("email"), rs.getString("display_name"), rs.getString("role")),
                    Long.parseLong(token));
        } else {
            rows = jdbc.query("SELECT id, email, display_name, role::text AS role FROM users WHERE lower(email) = ?",
                    (rs, n) -> member(rs.getLong("id"), rs.getString("email"), rs.getString("display_name"), rs.getString("role")),
                    token.toLowerCase(Locale.ROOT));
        }
        return rows.isEmpty() ? null : rows.get(0);
    }

    private static Member member(long id, String email, String name, String role) {
        return new Member(id, email, name, role);
    }

    private static boolean sameUser(String token, Member m) {
        return token.equals(String.valueOf(m.id())) || (m.email() != null && token.equalsIgnoreCase(m.email()));
    }

    private String read(String key, String fallback) {
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT config_value FROM system_config WHERE config_key = ?", key);
        if (rows.isEmpty() || rows.get(0).get("config_value") == null) return fallback;
        return String.valueOf(rows.get(0).get("config_value"));
    }
}
