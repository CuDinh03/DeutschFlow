package com.deutschflow.user.service;

import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.common.exception.ConflictException;
import com.deutschflow.common.minor.MinorPolicy;
import com.deutschflow.testsupport.AbstractPostgresIntegrationTest;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.LocalDate;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Tự khai ngày sinh trên Postgres THẬT.
 *
 * <p>Mock không kiểm được đúng thứ khiến lớp này tồn tại: {@code birth_date} là
 * {@code updatable = false} trên entity, nên {@code save(user)} KHÔNG bao giờ ghi được cột này —
 * chỉ câu UPDATE gốc trong {@link UserRepository#recordBirthDateIfAbsent} ghi được, và điều kiện
 * "chưa có ngày sinh" nằm trong mệnh đề WHERE của chính nó. Cả hai điều đó chỉ chứng minh được khi
 * chạm vào database thật.
 */
@SpringBootTest
@DisplayName("Học viên tự khai ngày sinh")
class UserBirthDateServiceIntegrationTest extends AbstractPostgresIntegrationTest {

    private static final String EMAIL_PREFIX = "birthdate-it-";

    @Autowired private UserBirthDateService service;
    @Autowired private UserRepository userRepository;
    @Autowired private JdbcTemplate jdbcTemplate;

    @AfterEach
    void tearDown() {
        jdbcTemplate.update("DELETE FROM users WHERE email LIKE '" + EMAIL_PREFIX + "%'");
    }

    private User newUser() {
        return userRepository.save(User.builder()
                .email(EMAIL_PREFIX + System.nanoTime() + "@test.com")
                .passwordHash("$2a$10$h")
                .displayName("Ngày sinh IT")
                .role(User.Role.STUDENT)
                .build());
    }

    private Map<String, Object> rowOf(Long userId) {
        return jdbcTemplate.queryForMap(
                "SELECT birth_date, birth_date_recorded_by, birth_date_recorded_at FROM users WHERE id = ?",
                userId);
    }

    @Test
    @DisplayName("ghi được ngày sinh cùng đầy đủ vết ghi nhận")
    void declare_writesDateAndAudit() {
        User user = newUser();

        MinorPolicy.Status status = service.declareBirthDate(user, LocalDate.of(1996, 3, 5));

        assertThat(status).isEqualTo(MinorPolicy.Status.ADULT);
        Map<String, Object> row = rowOf(user.getId());
        assertThat(((java.sql.Date) row.get("birth_date")).toLocalDate()).isEqualTo(LocalDate.of(1996, 3, 5));
        // Ba cột đi cùng MỘT câu lệnh — không được có ngày sinh mà thiếu vết.
        assertThat(row.get("birth_date_recorded_by")).isEqualTo(user.getId());
        assertThat(row.get("birth_date_recorded_at")).isNotNull();
    }

    @Test
    @DisplayName("người chưa đủ tuổi được phân loại là cần người giám hộ")
    void declare_minorIsClassified() {
        User user = newUser();

        MinorPolicy.Status status = service.declareBirthDate(user, LocalDate.now().minusYears(12));

        // Khai tuổi nhỏ KHÔNG bị từ chối: chặn ghi thì hệ thống mất luôn thông tin cần để bảo vệ.
        assertThat(status).isEqualTo(MinorPolicy.Status.MINOR_LEGAL);
        assertThat(status.requiresGuardianConsent()).isTrue();
    }

    @Test
    @DisplayName("lần khai thứ hai bị chặn 409 và KHÔNG đè giá trị cũ")
    void declare_secondTimeIsRejected() {
        User user = newUser();
        service.declareBirthDate(user, LocalDate.of(1996, 3, 5));

        assertThatThrownBy(() -> service.declareBirthDate(user, LocalDate.of(2000, 1, 1)))
                .isInstanceOf(ConflictException.class)
                // Chốt phải NÓI RÕ PHẢI LÀM GÌ, không phải một cái 409 trống.
                .hasMessageContaining("liên hệ");

        assertThat(((java.sql.Date) rowOf(user.getId()).get("birth_date")).toLocalDate())
                .isEqualTo(LocalDate.of(1996, 3, 5));
    }

    @Test
    @DisplayName("principal cũ (cache 60 giây) vẫn không mở được đường ghi lần hai")
    void declare_staleCachedPrincipalStillBlocked() {
        User user = newUser();
        service.declareBirthDate(user, LocalDate.of(1996, 3, 5));

        // user ở đây chính là ảnh chụp CŨ: birthDate vẫn null trong bộ nhớ, y như @AuthenticationPrincipal
        // được JwtAuthFilter cache. Chốt nằm trong WHERE của câu UPDATE nên vẫn chặn.
        assertThat(user.getBirthDate()).isNull();
        assertThatThrownBy(() -> service.declareBirthDate(user, LocalDate.of(1980, 1, 1)))
                .isInstanceOf(ConflictException.class);
    }

    @Test
    @DisplayName("từ chối ngày ở tương lai và năm vô lý, không ghi gì vào DB")
    void declare_rejectsInvalidDates() {
        User user = newUser();

        // 🪤 "Hôm nay" phải tính theo MinorPolicy.ZONE (giờ Việt Nam), KHÔNG phải giờ hệ thống:
        // container chạy UTC nên trong 7 tiếng mỗi ngày LocalDate.now() còn ở ngày hôm trước — lấy
        // nhầm mốc thì ngày "mai" theo UTC lại là "hôm nay" ở VN và rơi sang nhánh kiểm tuổi.
        LocalDate tomorrow = LocalDate.now(MinorPolicy.ZONE).plusDays(1);
        assertThatThrownBy(() -> service.declareBirthDate(user, tomorrow))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("tương lai");
        assertThatThrownBy(() -> service.declareBirthDate(user, LocalDate.now().minusYears(200)))
                .isInstanceOf(BadRequestException.class);
        // Sàn chống gõ nhầm năm hiện tại thay cho năm sinh.
        assertThatThrownBy(() -> service.declareBirthDate(user, LocalDate.now().minusYears(1)))
                .isInstanceOf(BadRequestException.class);

        assertThat(rowOf(user.getId()).get("birth_date")).isNull();
    }
}
