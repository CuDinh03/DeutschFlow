package com.deutschflow.admin;

import com.deutschflow.testsupport.AbstractPostgresIntegrationTest;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Đợt 2 admin (09/11/2026) — cấu hình AI có lịch sử + quay lại:
 * {@code PUT /api/admin/ai-config} (lý do bắt buộc), {@code GET /api/admin/ai-config/history},
 * {@code POST /api/admin/ai-config/history/{id}/restore}.
 *
 * <p>{@code system_config} là trạng thái TOÀN CỤC dùng chung giữa các lớp test, nên lớp này chụp 4
 * khoá trước mỗi ca và trả lại sau mỗi ca (kèm evict cache). Lịch sử thì chỉ thêm, nên mọi khẳng định
 * khoanh theo {@code tag} trong lý do.
 */
@SpringBootTest
@AutoConfigureMockMvc
@DisplayName("Admin · cấu hình AI: lý do bắt buộc, lịch sử, quay lại")
class AiConfigHistoryIntegrationTest extends AbstractPostgresIntegrationTest {

    private static final List<String> KEYS = List.of("ai.systemPrompt", "ai.temperature", "ai.maxTokens", "ai.topP");

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private UserRepository userRepository;
    @Autowired private JdbcTemplate jdbcTemplate;
    @Autowired private CacheManager cacheManager;

    private User admin;
    private User teacher;
    private String tag;
    private final Map<String, String> original = new HashMap<>();

    @BeforeEach
    void seed() {
        admin = account("aic-admin", User.Role.ADMIN);
        teacher = account("aic-teacher", User.Role.TEACHER);
        tag = "aic" + UUID.randomUUID().toString().substring(0, 8);
        original.clear();
        for (String k : KEYS) {
            List<String> v = jdbcTemplate.queryForList(
                    "SELECT config_value FROM system_config WHERE config_key = ?", String.class, k);
            original.put(k, v.isEmpty() ? null : v.get(0));
        }
    }

    @AfterEach
    void restoreGlobalConfig() {
        original.forEach((k, v) -> {
            if (v != null) {
                jdbcTemplate.update("UPDATE system_config SET config_value = ? WHERE config_key = ?", v, k);
            }
        });
        Cache cache = cacheManager.getCache("systemConfig");
        if (cache != null) KEYS.forEach(cache::evict);
    }

    @Test
    @DisplayName("PUT thiếu lý do → 400, không đổi cấu hình, không có dòng lịch sử")
    void put_requiresReason() throws Exception {
        long before = historyCount();
        putConfig(Map.of("temperature", 1.23)).andExpect(status().isBadRequest());
        putConfig(Map.of("temperature", 1.23, "reason", "ngắn")).andExpect(status().isBadRequest());

        assertThat(historyCount()).isEqualTo(before);
        assertThat(jdbcTemplate.queryForObject(
                "SELECT config_value FROM system_config WHERE config_key = 'ai.temperature'", String.class))
                .isEqualTo(original.get("ai.temperature"));
    }

    @Test
    @DisplayName("PUT có lý do: ghi khoá + updated_by, một dòng lịch sử trước/sau, vết có số cũ/mới và sha256 prompt")
    void put_writesHistoryAndAudit() throws Exception {
        String newPrompt = "Prompt thử " + tag;
        JsonNode res = json(putConfig(Map.of(
                "temperature", 1.23, "prompt", newPrompt, "reason", "Thử nhiệt độ mới " + tag))
                .andExpect(status().isOk()));
        long historyId = res.get("historyId").asLong();

        // GET thấy ngay giá trị mới (cache đã evict).
        JsonNode current = json(mockMvc.perform(get("/api/admin/ai-config").with(user(admin))).andExpect(status().isOk()));
        assertThat(current.get("temperature").asDouble()).isEqualTo(1.23);
        assertThat(current.get("prompt").asText()).isEqualTo(newPrompt);

        assertThat(jdbcTemplate.queryForObject(
                "SELECT updated_by FROM system_config WHERE config_key = 'ai.temperature'", String.class))
                .isEqualTo(admin.getEmail());

        Map<String, Object> row = jdbcTemplate.queryForMap(
                "SELECT reason, changed_by_email, before_json::text AS b, after_json::text AS a FROM ai_config_history WHERE id = ?",
                historyId);
        assertThat(row.get("changed_by_email")).isEqualTo(admin.getEmail());
        JsonNode after = objectMapper.readTree((String) row.get("a"));
        assertThat(after.get("temperature").asDouble()).isEqualTo(1.23);
        assertThat(after.get("prompt").asText()).isEqualTo(newPrompt);
        JsonNode beforeJson = objectMapper.readTree((String) row.get("b"));
        assertThat(beforeJson.has("maxTokens")).isTrue();

        String meta = jdbcTemplate.queryForObject("""
                SELECT metadata_json::text FROM audit_logs
                WHERE event_name = 'admin.aiconfig.updated' AND metadata_json ->> 'historyId' = ?
                """, String.class, String.valueOf(historyId));
        assertThat(meta).contains("systemPromptSha256").contains("1.23").contains(tag)
                .doesNotContain("Prompt thử");
    }

    @Test
    @DisplayName("GET history mới nhất trước, kèm prompt; restore áp after_json của dòng đó, ghi dòng mới + vết restored")
    void history_and_restore() throws Exception {
        long first = json(putConfig(Map.of("temperature", 1.11, "reason", "Bản một của " + tag))
                .andExpect(status().isOk())).get("historyId").asLong();
        long second = json(putConfig(Map.of("temperature", 1.55, "reason", "Bản hai của " + tag))
                .andExpect(status().isOk())).get("historyId").asLong();

        JsonNode history = json(mockMvc.perform(get("/api/admin/ai-config/history?page=0&size=5").with(user(admin)))
                .andExpect(status().isOk()));
        assertThat(history.get("items").get(0).get("id").asLong()).isEqualTo(second);
        assertThat(history.get("items").get(1).get("id").asLong()).isEqualTo(first);
        assertThat(history.get("items").get(0).get("before").has("prompt")).isTrue();
        assertThat(history.get("items").get(0).get("reason").asText()).contains(tag);

        JsonNode restored = json(mockMvc.perform(post("/api/admin/ai-config/history/{id}/restore", first)
                        .with(user(admin))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("reason", "Quay lại bản một " + tag))))
                .andExpect(status().isOk()));
        long restoredRow = restored.get("historyId").asLong();

        assertThat(jdbcTemplate.queryForObject(
                "SELECT config_value FROM system_config WHERE config_key = 'ai.temperature'", String.class))
                .isEqualTo("1.11");
        assertThat(jdbcTemplate.queryForObject(
                "SELECT restored_from_id FROM ai_config_history WHERE id = ?", Long.class, restoredRow))
                .isEqualTo(first);
        assertThat(jdbcTemplate.queryForObject("""
                SELECT COUNT(*) FROM audit_logs
                WHERE event_name = 'admin.aiconfig.restored' AND metadata_json ->> 'historyId' = ?
                """, Long.class, String.valueOf(restoredRow))).isEqualTo(1);
    }

    @Test
    @DisplayName("restore: id lạ → 404; thiếu lý do → 400; không phải ADMIN → 403")
    void restore_rejects() throws Exception {
        mockMvc.perform(post("/api/admin/ai-config/history/{id}/restore", 9_000_000_000L)
                        .with(user(admin))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("reason", "Quay lại bản không tồn tại"))))
                .andExpect(status().isNotFound());
        mockMvc.perform(post("/api/admin/ai-config/history/{id}/restore", 1L)
                        .with(user(admin))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest());
        mockMvc.perform(get("/api/admin/ai-config/history").with(user(teacher)))
                .andExpect(status().isForbidden());
    }

    // ── helpers ─────────────────────────────────────────────────────────────

    private ResultActions putConfig(Map<String, Object> body) throws Exception {
        return mockMvc.perform(put("/api/admin/ai-config")
                .with(user(admin))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(body)));
    }

    private JsonNode json(ResultActions r) throws Exception {
        return objectMapper.readTree(r.andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8));
    }

    private long historyCount() {
        Long n = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM ai_config_history", Long.class);
        return n == null ? 0 : n;
    }

    private User account(String local, User.Role role) {
        User u = User.builder()
                .email(local + "-" + UUID.randomUUID().toString().substring(0, 6) + "@test.local")
                .passwordHash("x")
                .displayName("AIC " + local)
                .role(role)
                .build();
        u.setActive(true);
        return userRepository.save(u);
    }
}
