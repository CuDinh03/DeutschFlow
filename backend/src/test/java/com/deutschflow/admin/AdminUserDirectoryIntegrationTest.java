package com.deutschflow.admin;

import com.deutschflow.organization.entity.Organization;
import com.deutschflow.organization.repository.OrganizationRepository;
import com.deutschflow.testsupport.AbstractPostgresIntegrationTest;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import java.nio.charset.StandardCharsets;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Danh bạ người dùng admin (đợt 1 "Nền móng + Người dùng", 09/11/2026) — AC-ADMIN-22, AC-ADMIN-25/26
 * phía backend: {@code GET /api/admin/users/search | /stats | /{id}} và {@code /audit?targetUserId=}.
 *
 * <p>DB dùng chung giữa các lớp test, nên mọi khẳng định về danh sách đều khoanh bằng {@code q=<tag>}
 * (email mang tag riêng của lớp này), còn thống kê toàn bảng thì so CHÊNH LỆCH trước/sau khi dựng cảnh.
 */
@SpringBootTest
@AutoConfigureMockMvc
@DisplayName("Admin · danh bạ người dùng: tìm kiếm phân trang server, thống kê, hồ sơ")
class AdminUserDirectoryIntegrationTest extends AbstractPostgresIntegrationTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private UserRepository userRepository;
    @Autowired private OrganizationRepository organizationRepo;
    @Autowired private JdbcTemplate jdbcTemplate;

    private String tag;
    private User admin;
    private User teacherCaller;
    private User proStudent;
    private User heavyStudent;
    private User freeTeacher;
    private User lockedTeacher;
    private User manager;
    private JsonNode statsBefore;

    @BeforeEach
    void seed() throws Exception {
        admin = account("admin", User.Role.ADMIN, true, null);
        teacherCaller = account("caller", User.Role.TEACHER, true, null);
        statsBefore = getJson("/api/admin/users/stats");

        tag = "dir" + UUID.randomUUID().toString().substring(0, 8);
        Organization org = organizationRepo.save(Organization.builder()
                .name("TT " + tag).slug(tag + "-org").seatLimit(10).status("ACTIVE").build());

        proStudent = account(tag + "-a-pro", User.Role.STUDENT, true, null);
        heavyStudent = account(tag + "-b-heavy", User.Role.STUDENT, true, null);
        account(tag + "-c-plain", User.Role.STUDENT, true, null);
        freeTeacher = account(tag + "-d-free", User.Role.TEACHER, true, null);
        lockedTeacher = account(tag + "-e-locked", User.Role.TEACHER, false, null);
        manager = account(tag + "-f-manager", User.Role.MANAGER, true, org.getId());

        Instant now = Instant.now();
        jdbcTemplate.update("""
                INSERT INTO user_subscriptions (user_id, plan_code, status, starts_at, ends_at, source)
                VALUES (?, 'PRO', 'ACTIVE', ?, NULL, 'ADMIN')
                """, proStudent.getId(), Timestamp.from(now.minus(1, ChronoUnit.DAYS)));
        jdbcTemplate.update("""
                INSERT INTO ai_token_usage_events (user_id, model, total_tokens, prompt_tokens, completion_tokens, feature, created_at)
                VALUES (?, 'gpt-oss-20b', 5000, 4000, 1000, 'SPEAKING', ?)
                """, heavyStudent.getId(), Timestamp.from(now.minus(2, ChronoUnit.DAYS)));
    }

    @Test
    @DisplayName("phân trang: total đếm cả kết quả lọc, size kẹp 100, khoá JSON camelCase")
    void paginates_andClampsSize() throws Exception {
        JsonNode page0 = getJson("/api/admin/users/search?q=" + tag + "&size=2&page=0&sort=email,asc");
        assertThat(page0.get("total").asLong()).isEqualTo(6);
        assertThat(page0.get("items")).hasSize(2);
        assertThat(page0.get("items").get(0).get("email").asText()).startsWith(tag + "-a-pro");
        JsonNode first = page0.get("items").get(0);
        assertThat(first.has("displayName")).isTrue();
        assertThat(first.has("isActive")).isTrue();
        assertThat(first.has("displayname")).isFalse();

        JsonNode page2 = getJson("/api/admin/users/search?q=" + tag + "&size=2&page=2&sort=email,asc");
        assertThat(page2.get("items").get(1).get("email").asText()).startsWith(tag + "-f-manager");

        assertThat(getJson("/api/admin/users/search?q=" + tag + "&size=500").get("size").asInt()).isEqualTo(100);
    }

    @Test
    @DisplayName("lọc vai trò, trạng thái, gói, trung tâm")
    void filters() throws Exception {
        assertThat(ids("&role=MANAGER")).containsExactly(manager.getId());
        assertThat(ids("&status=locked")).containsExactly(lockedTeacher.getId());
        assertThat(ids("&plan=PRO")).containsExactly(proStudent.getId());
        assertThat(ids("&plan=DEFAULT")).hasSize(5).doesNotContain(proStudent.getId());
        // "Giáo viên tự do" = cùng định nghĩa với GET /api/admin/teachers/free.
        assertThat(ids("&role=TEACHER&org=none&status=active")).containsExactly(freeTeacher.getId());
        assertThat(ids("&org=any")).containsExactly(manager.getId());
    }

    @Test
    @DisplayName("sắp xếp theo token 30 ngày; quota của dòng đến từ snapshot theo lô")
    void sortsByUsage_andCarriesQuota() throws Exception {
        JsonNode res = getJson("/api/admin/users/search?q=" + tag + "&sort=usage30d,desc");
        JsonNode top = res.get("items").get(0);
        assertThat(top.get("id").asLong()).isEqualTo(heavyStudent.getId());
        assertThat(top.get("usageLast30Days").asLong()).isEqualTo(5000);

        JsonNode pro = getJson("/api/admin/users/search?q=" + tag + "&plan=PRO").get("items").get(0);
        assertThat(pro.get("planCode").asText()).isEqualTo("PRO");
        assertThat(pro.get("quota").get("kind").asText()).isEqualTo("WALLET");
    }

    @Test
    @DisplayName("giá trị lọc/sort lạ → 400; người không phải ADMIN → 403")
    void rejectsBadInput_andNonAdmin() throws Exception {
        mockMvc.perform(asAdmin(get("/api/admin/users/search?sort=password,asc"))).andExpect(status().isBadRequest());
        mockMvc.perform(asAdmin(get("/api/admin/users/search?role=HACKER"))).andExpect(status().isBadRequest());
        mockMvc.perform(asAdmin(get("/api/admin/users/search?status=gone"))).andExpect(status().isBadRequest());
        mockMvc.perform(get("/api/admin/users/search").with(user(teacherCaller))).andExpect(status().isForbidden());
        mockMvc.perform(get("/api/admin/users/stats").with(user(teacherCaller))).andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("thống kê đếm trên cả bảng: chênh lệch đúng số người vừa dựng")
    void statsCountWholeTable() throws Exception {
        JsonNode after = getJson("/api/admin/users/stats");
        assertThat(delta(after, "STUDENT")).isEqualTo(3);
        assertThat(delta(after, "TEACHER")).isEqualTo(2);
        assertThat(delta(after, "MANAGER")).isEqualTo(1);
        assertThat(after.get("locked").asLong() - statsBefore.get("locked").asLong()).isEqualTo(1);
        assertThat(after.get("freeTeachers").asLong() - statsBefore.get("freeTeachers").asLong()).isEqualTo(1);
        assertThat(after.get("aiActive30d").asLong() - statsBefore.get("aiActive30d").asLong()).isEqualTo(1);
        assertThat(after.get("topUsage30d").isArray()).isTrue();
    }

    @Test
    @DisplayName("hồ sơ một người: ghi vết đọc; 404 thì không ghi vết; /audit?targetUserId chỉ trả vết của người đó")
    void profile_auditsRead_andAuditFilter() throws Exception {
        JsonNode profile = getJson("/api/admin/users/" + proStudent.getId());
        assertThat(profile.get("email").asText()).isEqualTo(proStudent.getEmail());
        assertThat(profile.get("planCode").asText()).isEqualTo("PRO");
        assertThat(readTraces(proStudent.getId())).isEqualTo(1);

        long missing = 9_000_000_000L;
        mockMvc.perform(asAdmin(get("/api/admin/users/" + missing))).andExpect(status().isNotFound());
        assertThat(readTraces(missing)).isZero();

        getJson("/api/admin/users/" + manager.getId());
        JsonNode audit = getJson("/api/admin/audit?targetUserId=" + proStudent.getId() + "&size=100");
        assertThat(audit.get("total").asLong()).isPositive();
        for (JsonNode item : audit.get("items")) {
            assertThat(item.get("targetId").asText()).isEqualTo(String.valueOf(proStudent.getId()));
        }
    }

    // ── helpers ─────────────────────────────────────────────────────────────

    private List<Long> ids(String extraQuery) throws Exception {
        JsonNode res = getJson("/api/admin/users/search?q=" + tag + "&size=100" + extraQuery);
        List<Long> out = new ArrayList<>();
        res.get("items").forEach(n -> out.add(n.get("id").asLong()));
        return out;
    }

    private long delta(JsonNode after, String role) {
        return after.get("byRole").get(role).asLong() - statsBefore.get("byRole").get(role).asLong();
    }

    private long readTraces(long userId) {
        Long n = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM audit_logs WHERE event_name = 'admin.user.profile.read' AND target_id = ?",
                Long.class, String.valueOf(userId));
        return n == null ? 0 : n;
    }

    private MockHttpServletRequestBuilder asAdmin(MockHttpServletRequestBuilder b) {
        return b.with(user(admin));
    }

    private JsonNode getJson(String url) throws Exception {
        String body = mockMvc.perform(asAdmin(get(url)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        return objectMapper.readTree(body);
    }

    private User account(String local, User.Role role, boolean active, Long orgId) {
        User u = User.builder()
                .email(local + "-" + UUID.randomUUID().toString().substring(0, 6) + "@test.local")
                .passwordHash("x")
                .displayName("DIR " + local)
                .role(role)
                .build();
        u.setActive(active);
        u.setOrgId(orgId);
        return userRepository.save(u);
    }
}
