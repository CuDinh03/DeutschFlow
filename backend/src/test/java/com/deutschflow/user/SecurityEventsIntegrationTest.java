package com.deutschflow.user;

import com.deutschflow.common.audit.AuditActor;
import com.deutschflow.common.audit.AuditLogService;
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
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Đợt 2 admin (09/11/2026) — {@code GET /api/profile/me/security-events}: chỉ vết trong danh sách
 * trắng, chỉ vết có đối tượng là CHÍNH người gọi, chỉ {@code {event, occurredAt}} (không actor, không
 * lý do, không metadata), phân trang ở SQL.
 */
@SpringBootTest
@AutoConfigureMockMvc
@DisplayName("Hồ sơ · hoạt động bảo mật của chính mình")
class SecurityEventsIntegrationTest extends AbstractPostgresIntegrationTest {

    private static final String REASON = "Lý do nội bộ không được lộ ra ngoài";

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private UserRepository userRepository;
    @Autowired private AuditLogService auditLogService;
    @Autowired private PasswordEncoder passwordEncoder;

    private User me;
    private User other;
    private User admin;

    @BeforeEach
    void seed() {
        me = account("sec-me", User.Role.STUDENT, "OldPass#2026");
        other = account("sec-other", User.Role.STUDENT, "x");
        admin = account("sec-admin", User.Role.ADMIN, "x");

        AuditActor adminActor = AuditActor.of(admin);
        String myId = String.valueOf(me.getId());
        auditLogService.log("admin.user.password.reset", adminActor, "USER", myId, null, Map.of("reason", REASON));
        auditLogService.log("admin.user.deactivated", adminActor, "USER", myId, null,
                Map.of("active", false, "reason", REASON));
        // Không nằm trong danh sách trắng ⇒ không bao giờ hiện cho người dùng.
        auditLogService.log("admin.user.profile.read", adminActor, "USER", myId, null, Map.of());
        // Vết của người KHÁC ⇒ không hiện cho tôi.
        auditLogService.log("user.password.reset", AuditActor.of(other), "USER",
                String.valueOf(other.getId()), null, null);
    }

    @Test
    @DisplayName("đổi mật khẩu thật ghi vết; danh sách chỉ gồm vết trắng của mình, không lộ actor/lý do")
    void listsOnlyOwnWhitelistedEvents_withoutLeakage() throws Exception {
        mockMvc.perform(patch("/api/profile/me/password").with(user(me))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "currentPassword", "OldPass#2026", "newPassword", "NewPass#2026x"))))
                .andExpect(status().isNoContent());

        String body = mockMvc.perform(get("/api/profile/me/security-events").with(user(me)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        JsonNode res = objectMapper.readTree(body);

        assertThat(res.get("total").asLong()).isEqualTo(3);
        List<String> events = new ArrayList<>();
        for (JsonNode item : res.get("items")) {
            events.add(item.get("event").asText());
            List<String> fields = new ArrayList<>();
            item.fieldNames().forEachRemaining(fields::add);
            assertThat(fields).containsExactlyInAnyOrder("event", "occurredAt");
        }
        assertThat(events).containsExactlyInAnyOrder(
                "user.password.changed", "admin.user.password.reset", "admin.user.deactivated");
        // Mới nhất trước: lần đổi mật khẩu vừa xong.
        assertThat(events.get(0)).isEqualTo("user.password.changed");

        assertThat(body).doesNotContain(REASON).doesNotContain(admin.getEmail())
                .doesNotContain("admin.user.profile.read").doesNotContain(other.getEmail());
    }

    @Test
    @DisplayName("phân trang ở SQL: size/page đúng, total không đổi")
    void paginates() throws Exception {
        JsonNode p0 = json("/api/profile/me/security-events?page=0&size=1");
        assertThat(p0.get("total").asLong()).isEqualTo(2);
        assertThat(p0.get("items")).hasSize(1);
        JsonNode p1 = json("/api/profile/me/security-events?page=1&size=1");
        assertThat(p1.get("items")).hasSize(1);
        assertThat(p1.get("items").get(0).get("event").asText())
                .isNotEqualTo(p0.get("items").get(0).get("event").asText());
        assertThat(json("/api/profile/me/security-events?page=2&size=1").get("items")).isEmpty();
    }

    @Test
    @DisplayName("chưa đăng nhập → 401")
    void requiresAuthentication() throws Exception {
        mockMvc.perform(get("/api/profile/me/security-events")).andExpect(status().isUnauthorized());
    }

    private JsonNode json(String url) throws Exception {
        return objectMapper.readTree(mockMvc.perform(get(url).with(user(me)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8));
    }

    private User account(String local, User.Role role, String rawPassword) {
        User u = User.builder()
                .email(local + "-" + UUID.randomUUID().toString().substring(0, 6) + "@test.local")
                .passwordHash(passwordEncoder.encode(rawPassword))
                .displayName("SEC " + local)
                .role(role)
                .build();
        u.setActive(true);
        return userRepository.save(u);
    }
}
