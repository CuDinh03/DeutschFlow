package com.deutschflow.admin.service;

import com.deutschflow.common.audit.AuditActor;
import com.deutschflow.common.audit.AuditLogService;
import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.system.service.SystemConfigService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.sql.Timestamp;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * Lưu cấu hình AI có lịch sử + quay lại bản cũ (đợt 2 admin, 09/11/2026).
 *
 * <p>4 khoá {@code system_config} ({@link #K_PROMPT}, {@link #K_TEMPERATURE}, {@link #K_MAX_TOKENS},
 * {@link #K_TOP_P}) ghép vào MỌI lời gọi AI. Mỗi lần lưu: khoá các dòng ({@code FOR UPDATE}) → chụp
 * TRƯỚC → ghi khoá đổi (kèm {@code updated_by}) → ghi một dòng {@code ai_config_history} (TRƯỚC + SAU +
 * lý do) → vết audit. Tất cả trong MỘT transaction: không có lịch sử nào cho một lần lưu đã rollback.
 *
 * <p>Vết audit KHÔNG mang prompt — chỉ sha256 của prompt cũ/mới (audit_logs là sổ append-only mọi
 * admin đọc được, không phải chỗ chứa văn bản dài). Prompt đầy đủ nằm ở {@code ai_config_history}
 * để xem diff và quay lại.
 *
 * <p>Cache: {@code SystemConfigService.getString} là {@code @Cacheable("systemConfig")} TTL 1 giờ.
 * {@code setString} tự evict NGAY (trước commit), nên ở đây evict thêm một lần SAU commit — nếu không,
 * một lượt đọc chen vào giữa có thể nạp lại giá trị cũ và giữ nó cả giờ.
 */
@Service
@RequiredArgsConstructor
public class AiConfigHistoryService {

    public static final String K_PROMPT = "ai.systemPrompt";
    public static final String K_TEMPERATURE = "ai.temperature";
    public static final String K_MAX_TOKENS = "ai.maxTokens";
    public static final String K_TOP_P = "ai.topP";
    private static final List<String> KEYS = List.of(K_PROMPT, K_TEMPERATURE, K_MAX_TOKENS, K_TOP_P);
    private static final String CACHE = "systemConfig";

    // Mặc định khớp GET /api/admin/ai-config (giá trị hiện khi khoá chưa có trong DB).
    static final String DEFAULT_PROMPT = "";
    static final double DEFAULT_TEMPERATURE = 0.7;
    static final int DEFAULT_MAX_TOKENS = 1024;
    static final double DEFAULT_TOP_P = 0.9;

    // A bad ai.maxTokens once starved every AI feature system-wide (Groq TPM incident), so bound the
    // tunables server-side too — the UI sliders alone don't stop a direct API PUT.
    public static final double MIN_TEMPERATURE = 0.0;
    public static final double MAX_TEMPERATURE = 2.0;
    public static final double MIN_TOP_P = 0.0;
    public static final double MAX_TOP_P = 1.0;
    public static final int MIN_MAX_TOKENS = 64;
    public static final int MAX_MAX_TOKENS = 8192;
    /**
     * Trần độ dài system prompt (audit F-M7, 03/09/2026). Prompt này ghép vào MỌI lời gọi AI của
     * hệ thống, nên một chuỗi khổng lồ vừa đội chi phí token mỗi request vừa có thể đẩy chính nội
     * dung người học ra khỏi cửa sổ ngữ cảnh. 8000 ký tự rộng hơn nhiều lần prompt đang dùng.
     */
    public static final int MAX_PROMPT_LENGTH = 8000;

    private static final int MAX_PAGE_SIZE = 50;

    private final SystemConfigService systemConfigService;
    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;
    private final AuditLogService auditLogService;
    private final CacheManager cacheManager;

    /** Ảnh chụp đủ 4 khoá. Ở PATCH thì trường {@code null} = "không đổi". */
    public record AiConfigValues(String prompt, Double temperature, Integer maxTokens, Double topP) {}

    /** Kết quả một lần lưu/quay lại: id dòng lịch sử ({@code null} khi không có gì đổi) + các khoá đã đổi. */
    public record ApplyResult(Long historyId, List<String> changed) {}

    /** Kiểm biên — dùng chung cho PUT và cho dòng lịch sử sắp được áp lại. */
    public static void validate(AiConfigValues v) {
        if (v.prompt() != null && v.prompt().length() > MAX_PROMPT_LENGTH) {
            throw new BadRequestException("System prompt tối đa " + MAX_PROMPT_LENGTH + " ký tự.");
        }
        if (v.temperature() != null && (v.temperature() < MIN_TEMPERATURE || v.temperature() > MAX_TEMPERATURE)) {
            throw new BadRequestException("temperature phải trong khoảng [" + MIN_TEMPERATURE + ", " + MAX_TEMPERATURE + "]");
        }
        if (v.topP() != null && (v.topP() < MIN_TOP_P || v.topP() > MAX_TOP_P)) {
            throw new BadRequestException("topP phải trong khoảng [" + MIN_TOP_P + ", " + MAX_TOP_P + "]");
        }
        if (v.maxTokens() != null && (v.maxTokens() < MIN_MAX_TOKENS || v.maxTokens() > MAX_MAX_TOKENS)) {
            throw new BadRequestException("maxTokens phải trong khoảng [" + MIN_MAX_TOKENS + ", " + MAX_MAX_TOKENS + "]");
        }
    }

    /**
     * PUT: áp các trường khác {@code null} của {@code patch}. Không khoá nào đổi giá trị ⇒ không ghi
     * gì (không lịch sử, không vết) và trả {@code historyId = null}.
     */
    @Transactional
    public ApplyResult update(AiConfigValues patch, String reason, AuditActor actor) {
        validate(patch);
        AiConfigValues before = lockAndSnapshot();
        AiConfigValues after = new AiConfigValues(
                patch.prompt() != null ? patch.prompt() : before.prompt(),
                patch.temperature() != null ? patch.temperature() : before.temperature(),
                patch.maxTokens() != null ? patch.maxTokens() : before.maxTokens(),
                patch.topP() != null ? patch.topP() : before.topP());
        return apply(before, after, reason, actor, null, "admin.aiconfig.updated");
    }

    /**
     * Quay lại: áp {@code after_json} của dòng {@code historyId}. Luôn ghi một dòng lịch sử mới (trỏ
     * {@code restored_from_id}) và vết {@code admin.aiconfig.restored}, kể cả khi giá trị đang trùng —
     * đây là một thao tác có chủ đích, lịch sử phải kể lại được.
     */
    @Transactional
    public ApplyResult restore(long historyId, String reason, AuditActor actor) {
        List<String> rows = jdbcTemplate.queryForList(
                "SELECT after_json::text FROM ai_config_history WHERE id = ?", String.class, historyId);
        if (rows.isEmpty()) {
            throw new NotFoundException("Không tìm thấy bản cấu hình AI #" + historyId + ".");
        }
        AiConfigValues target = fromJson(rows.get(0));
        validate(target);
        AiConfigValues before = lockAndSnapshot();
        AiConfigValues after = new AiConfigValues(
                target.prompt() != null ? target.prompt() : before.prompt(),
                target.temperature() != null ? target.temperature() : before.temperature(),
                target.maxTokens() != null ? target.maxTokens() : before.maxTokens(),
                target.topP() != null ? target.topP() : before.topP());
        return apply(before, after, reason, actor, historyId, "admin.aiconfig.restored");
    }

    /** Lịch sử mới nhất trước, kèm prompt đầy đủ ở before/after (để xem diff). Chỉ admin. */
    @Transactional(readOnly = true)
    public Map<String, Object> history(int page, int size) {
        int safeSize = Math.min(Math.max(size, 1), MAX_PAGE_SIZE);
        int safePage = Math.max(page, 0);
        Long total = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM ai_config_history", Long.class);
        List<Map<String, Object>> items = jdbcTemplate.query("""
                SELECT id, changed_at, changed_by_user_id, changed_by_email, reason,
                       before_json::text AS before_json, after_json::text AS after_json, restored_from_id
                FROM ai_config_history
                ORDER BY changed_at DESC, id DESC
                LIMIT ? OFFSET ?
                """,
                (rs, i) -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("id", rs.getLong("id"));
                    Timestamp ts = rs.getTimestamp("changed_at");
                    m.put("changedAt", ts == null ? null : ts.toInstant());
                    m.put("changedByUserId", rs.getObject("changed_by_user_id"));
                    m.put("changedByEmail", rs.getString("changed_by_email"));
                    m.put("reason", rs.getString("reason"));
                    m.put("before", toMap(fromJson(rs.getString("before_json"))));
                    m.put("after", toMap(fromJson(rs.getString("after_json"))));
                    m.put("restoredFromId", rs.getObject("restored_from_id"));
                    return m;
                },
                safeSize, (long) safePage * safeSize);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("items", items);
        out.put("total", total != null ? total : 0L);
        out.put("page", safePage);
        out.put("size", safeSize);
        return out;
    }

    // ── nội bộ ───────────────────────────────────────────────────────────

    private ApplyResult apply(AiConfigValues before, AiConfigValues after, String reason, AuditActor actor,
                              Long restoredFromId, String event) {
        AuditActor a = actor == null ? new AuditActor(null, null, null) : actor;
        List<String> changed = new ArrayList<>();
        if (!Objects.equals(before.prompt(), after.prompt())) {
            systemConfigService.setString(K_PROMPT, after.prompt(), "Base system prompt for AI interactions", a.email());
            changed.add("systemPrompt");
        }
        if (!Objects.equals(before.temperature(), after.temperature())) {
            systemConfigService.setString(K_TEMPERATURE, String.valueOf(after.temperature()), "Temperature for AI responses (0-2)", a.email());
            changed.add("temperature");
        }
        if (!Objects.equals(before.maxTokens(), after.maxTokens())) {
            systemConfigService.setString(K_MAX_TOKENS, String.valueOf(after.maxTokens()), "Max tokens for AI responses", a.email());
            changed.add("maxTokens");
        }
        if (!Objects.equals(before.topP(), after.topP())) {
            systemConfigService.setString(K_TOP_P, String.valueOf(after.topP()), "Top-P sampling for AI responses (0-1)", a.email());
            changed.add("topP");
        }
        if (changed.isEmpty() && restoredFromId == null) {
            return new ApplyResult(null, List.of());
        }
        evictAfterCommit();

        Long historyId = jdbcTemplate.queryForObject("""
                INSERT INTO ai_config_history
                  (changed_by_user_id, changed_by_email, reason, before_json, after_json, restored_from_id)
                VALUES (?, ?, ?, CAST(? AS jsonb), CAST(? AS jsonb), ?)
                RETURNING id
                """, Long.class,
                a.id(), a.email(), reason, toJson(before), toJson(after), restoredFromId);

        Map<String, Object> meta = new LinkedHashMap<>();
        meta.put("reason", reason);
        meta.put("historyId", historyId);
        if (restoredFromId != null) {
            meta.put("restoredFromId", restoredFromId);
        }
        meta.put("changed", changed);
        if (changed.contains("systemPrompt")) {
            meta.put("systemPromptSha256", Map.of("old", sha256(before.prompt()), "new", sha256(after.prompt())));
        }
        if (changed.contains("temperature")) {
            meta.put("temperature", oldNew(before.temperature(), after.temperature()));
        }
        if (changed.contains("maxTokens")) {
            meta.put("maxTokens", oldNew(before.maxTokens(), after.maxTokens()));
        }
        if (changed.contains("topP")) {
            meta.put("topP", oldNew(before.topP(), after.topP()));
        }
        auditLogService.log(event, a, "AI_CONFIG", "ai", meta);
        return new ApplyResult(historyId, changed);
    }

    /**
     * Khoá các dòng cấu hình (hai admin lưu cùng lúc không chụp cùng một "trước") rồi đọc thẳng DB
     * — KHÔNG qua cache, vì ảnh chụp này là chứng cứ của lịch sử.
     */
    private AiConfigValues lockAndSnapshot() {
        Map<String, String> raw = new LinkedHashMap<>();
        jdbcTemplate.query(
                "SELECT config_key, config_value FROM system_config WHERE config_key IN (?, ?, ?, ?) FOR UPDATE",
                (org.springframework.jdbc.core.RowCallbackHandler) rs ->
                        raw.put(rs.getString("config_key"), rs.getString("config_value")),
                KEYS.toArray());
        return new AiConfigValues(
                raw.get(K_PROMPT) != null ? raw.get(K_PROMPT) : DEFAULT_PROMPT,
                parseDouble(raw.get(K_TEMPERATURE), DEFAULT_TEMPERATURE),
                parseInt(raw.get(K_MAX_TOKENS), DEFAULT_MAX_TOKENS),
                parseDouble(raw.get(K_TOP_P), DEFAULT_TOP_P));
    }

    private void evictAfterCommit() {
        Runnable evict = () -> {
            Cache cache = cacheManager.getCache(CACHE);
            if (cache != null) {
                KEYS.forEach(cache::evict);
            }
        };
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    evict.run();
                }
            });
        } else {
            evict.run();
        }
    }

    private static Map<String, Object> oldNew(Object oldV, Object newV) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("old", oldV);
        m.put("new", newV);
        return m;
    }

    public static String sha256(String s) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(md.digest((s == null ? "" : s).getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    private static Map<String, Object> toMap(AiConfigValues v) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("prompt", v.prompt());
        m.put("temperature", v.temperature());
        m.put("maxTokens", v.maxTokens());
        m.put("topP", v.topP());
        return m;
    }

    private String toJson(AiConfigValues v) {
        try {
            return objectMapper.writeValueAsString(toMap(v));
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Không chuyển được cấu hình AI sang JSON", e);
        }
    }

    private AiConfigValues fromJson(String json) {
        try {
            JsonNode n = objectMapper.readTree(json == null ? "{}" : json);
            return new AiConfigValues(
                    n.hasNonNull("prompt") ? n.get("prompt").asText() : null,
                    n.hasNonNull("temperature") ? n.get("temperature").asDouble() : null,
                    n.hasNonNull("maxTokens") ? n.get("maxTokens").asInt() : null,
                    n.hasNonNull("topP") ? n.get("topP").asDouble() : null);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Dòng lịch sử cấu hình AI hỏng JSON", e);
        }
    }

    private static Double parseDouble(String v, double fallback) {
        if (v == null) return fallback;
        try {
            return Double.parseDouble(v.trim());
        } catch (NumberFormatException e) {
            return fallback;
        }
    }

    private static Integer parseInt(String v, int fallback) {
        if (v == null) return fallback;
        try {
            return Integer.parseInt(v.trim());
        } catch (NumberFormatException e) {
            return fallback;
        }
    }
}
