package com.deutschflow.user.controller;

import com.deutschflow.testsupport.AbstractPostgresIntegrationTest;
import com.deutschflow.user.entity.RefreshToken;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.RefreshTokenRepository;
import com.deutschflow.user.repository.UserRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Đợt Hồ sơ cá nhân (14–17/09/2026) — bốn endpoint mới của {@code /api/profile} qua đúng chuỗi
 * HTTP → Spring Security → controller → service → Postgres.
 *
 * <p>{@code UserBirthDateServiceIntegrationTest} đã chốt tầng service; lớp này chốt phần chỉ lộ ra
 * ở tầng HTTP: mã trạng thái, thông điệp trong {@code ProblemDetail.detail}, hợp đồng JSON mà web
 * và mobile đọc ({@code birthDateLocked}, cặp token mới), và việc {@code GET /me} đọc LẠI từ DB
 * chứ không trả ảnh chụp principal đã cũ.
 *
 * <p>Tự bỏ qua khi không có Postgres — xem {@link AbstractPostgresIntegrationTest}.
 */
@SpringBootTest
@AutoConfigureMockMvc
@DisplayName("Hồ sơ cá nhân — GET /me, ngày sinh, múi giờ, đăng xuất thiết bị khác")
class ProfileControllerIntegrationTest extends AbstractPostgresIntegrationTest {

    private static final String EMAIL_PREFIX = "profile-ctl-it-";

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private UserRepository userRepository;
    @Autowired private RefreshTokenRepository refreshTokenRepository;
    @Autowired private JdbcTemplate jdbcTemplate;

    @AfterEach
    void tearDown() {
        jdbcTemplate.update(
                "DELETE FROM refresh_tokens WHERE user_id IN (SELECT id FROM users WHERE email LIKE '" + EMAIL_PREFIX + "%')");
        jdbcTemplate.update("DELETE FROM users WHERE email LIKE '" + EMAIL_PREFIX + "%'");
    }

    // ── GET /me + ngày sinh ─────────────────────────────────────────────────

    @Test
    @DisplayName("GET /me: chưa có ngày sinh ⇒ birthDateLocked=false; khai xong gọi lại NGAY thấy đã khoá dù principal còn là ảnh chụp cũ")
    void getMe_reflectsBirthDateFromDbNotFromCachedPrincipal() throws Exception {
        User student = newStudent();

        mockMvc.perform(get("/api/profile/me").with(user(student)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.userId").value(student.getId()))
                .andExpect(jsonPath("$.email").value(student.getEmail()))
                .andExpect(jsonPath("$.birthDate").isEmpty())
                .andExpect(jsonPath("$.birthDateLocked").value(false));

        declareBirthDate(student, "1996-03-05")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.birthDate").value("1996-03-05"))
                .andExpect(jsonPath("$.minorStatus").value("ADULT"))
                .andExpect(jsonPath("$.requiresGuardianConsent").value(false));

        // `student` trong bộ nhớ vẫn birthDate=null — đúng tình huống JwtAuthFilter cache principal
        // ~60 giây. Endpoint phải đọc lại từ DB nên vẫn thấy ngày vừa khai.
        assertThat(student.getBirthDate()).isNull();
        mockMvc.perform(get("/api/profile/me").with(user(student)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.birthDate").value("1996-03-05"))
                .andExpect(jsonPath("$.birthDateLocked").value(true));
    }

    @Test
    @DisplayName("khai ngày sinh lần hai ⇒ 409 kèm hướng dẫn liên hệ, giá trị cũ không bị đè")
    void declareBirthDate_secondTimeIs409WithGuidance() throws Exception {
        User student = newStudent();
        declareBirthDate(student, "1996-03-05").andExpect(status().isOk());

        declareBirthDate(student, "2000-01-01")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.detail", containsString("liên hệ")));

        assertThat(birthDateOf(student)).isEqualTo("1996-03-05");
    }

    @Test
    @DisplayName("ngày sinh ở tương lai ⇒ 400, không ghi gì")
    void declareBirthDate_futureIs400() throws Exception {
        User student = newStudent();

        declareBirthDate(student, "2999-01-01")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail", containsString("tương lai")));

        assertThat(birthDateOf(student)).isNull();
    }

    // ── múi giờ thông báo ───────────────────────────────────────────────────

    @Test
    @DisplayName("PATCH /me: múi giờ IANA hợp lệ được lưu và GET /me trả lại đúng giá trị")
    void updateProfile_validTimezoneIsStored() throws Exception {
        User student = newStudent();

        mockMvc.perform(patch("/api/profile/me").with(user(student))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("notificationTimezone", "Europe/Berlin"))))
                .andExpect(status().isOk());

        assertThat(timezoneOf(student)).isEqualTo("Europe/Berlin");
        mockMvc.perform(get("/api/profile/me").with(user(student)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.notificationTimezone").value("Europe/Berlin"));
    }

    @Test
    @DisplayName("PATCH /me: chuỗi có dạng zone nhưng JVM không biết ⇒ 400 'Múi giờ không hợp lệ.', DB giữ nguyên")
    void updateProfile_unknownTimezoneIs400() throws Exception {
        User student = newStudent();
        // Cột có giá trị mặc định (không phải NULL) — so với giá trị trước khi gọi, đừng đòi null.
        String before = timezoneOf(student);

        // Qua được regex của DTO (dạng Khu/Vùng) nên chỉ phép đối chiếu ZoneId mới chặn được.
        mockMvc.perform(patch("/api/profile/me").with(user(student))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("notificationTimezone", "Mars/Olympus"))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail", containsString("Múi giờ")));

        assertThat(timezoneOf(student)).isEqualTo(before);
    }

    // ── đăng xuất thiết bị khác ─────────────────────────────────────────────

    @Test
    @DisplayName("revoke-others: mọi refresh token cũ chết (refresh → 400), thiết bị đang gọi nhận cặp token mới còn sống, push_token không bị xoá")
    void revokeOtherSessions_killsOldTokens_issuesFreshPair_keepsPushToken() throws Exception {
        User student = newStudent();
        String phone = liveRefreshToken(student);
        String laptop = liveRefreshToken(student);
        // Ghi thẳng bằng SQL: assignPushToken là @Modifying, gọi ngoài transaction sẽ ném lỗi.
        jdbcTemplate.update("UPDATE users SET push_token = ?, push_platform = ? WHERE id = ?",
                "ExponentPushToken[it-profile]", "ios", student.getId());

        String body = mockMvc.perform(post("/api/profile/me/sessions/revoke-others").with(user(student)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken").isNotEmpty())
                .andExpect(jsonPath("$.refreshToken").isNotEmpty())
                .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        String fresh = objectMapper.readTree(body).get("refreshToken").asText();

        // Token cũ chết thật ở cả hai thiết bị, đúng hành vi endpoint refresh (400 = từ chối cấp lại).
        refresh(phone).andExpect(status().isBadRequest());
        refresh(laptop).andExpect(status().isBadRequest());
        assertThat(fresh).isNotIn(phone, laptop);

        // Cặp mới là cặp duy nhất còn sống — chính thiết bị đang gọi tiếp tục dùng được.
        assertThat(liveRefreshTokens(student)).isEqualTo(1L);
        refresh(fresh).andExpect(status().isOk());

        // push_token trỏ tới THIẾT BỊ đăng nhập gần nhất, không phải phiên — không được xoá.
        assertThat(jdbcTemplate.queryForObject(
                "SELECT push_token FROM users WHERE id = ?", String.class, student.getId()))
                .isEqualTo("ExponentPushToken[it-profile]");
    }

    // ── helpers ─────────────────────────────────────────────────────────────

    private ResultActions declareBirthDate(User u, String isoDate) throws Exception {
        return mockMvc.perform(patch("/api/profile/me/birth-date").with(user(u))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of("birthDate", isoDate)))
                .characterEncoding(StandardCharsets.UTF_8));
    }

    /** Đúng lời gọi của client: mobile gửi body (web gửi cookie) — ở đây dùng body. */
    private ResultActions refresh(String refreshToken) throws Exception {
        return mockMvc.perform(post("/api/auth/refresh")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of("refreshToken", refreshToken)))
                .characterEncoding(StandardCharsets.UTF_8));
    }

    private User newStudent() {
        return userRepository.save(User.builder()
                .email(EMAIL_PREFIX + UUID.randomUUID() + "@test.local")
                .passwordHash("$2a$10$h")
                .displayName("Hồ sơ IT")
                .role(User.Role.STUDENT)
                .build());
    }

    private String liveRefreshToken(User u) {
        String token = "pc-" + UUID.randomUUID();
        refreshTokenRepository.save(RefreshToken.builder()
                .user(u)
                .token(token)
                .expiresAt(LocalDateTime.now().plusDays(7))
                .build());
        return token;
    }

    private Long liveRefreshTokens(User u) {
        return jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM refresh_tokens WHERE user_id = ? AND revoked = FALSE", Long.class, u.getId());
    }

    private String timezoneOf(User u) {
        return jdbcTemplate.queryForObject(
                "SELECT notification_timezone FROM users WHERE id = ?", String.class, u.getId());
    }

    private String birthDateOf(User u) {
        return jdbcTemplate.queryForObject(
                "SELECT CAST(birth_date AS text) FROM users WHERE id = ?", String.class, u.getId());
    }
}
