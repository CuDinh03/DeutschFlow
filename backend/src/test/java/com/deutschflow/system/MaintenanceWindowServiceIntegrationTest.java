package com.deutschflow.system;

import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.common.exception.ConflictException;
import com.deutschflow.system.dto.MaintenanceWindowDto;
import com.deutschflow.system.entity.MaintenanceWindow;
import com.deutschflow.system.repository.MaintenanceWindowRepository;
import com.deutschflow.system.service.MaintenanceStateService;
import com.deutschflow.system.service.MaintenanceWindowService;
import com.deutschflow.testsupport.AbstractPostgresIntegrationTest;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * PR-A cơ chế bảo trì (plans/2026-09-03): máy trạng thái + chuỗi thông báo trên
 * PostgreSQL thật — V301 áp được, mỗi mốc gửi ĐÚNG MỘT LẦN (AC-MAINT-01), bất biến
 * một-ACTIVE do DB enforce (AC-MAINT-05), chuông quên tắt không réo dồn (AC-MAINT-06).
 */
@SpringBootTest
@DisplayName("Maintenance window state machine + notifications (V301)")
class MaintenanceWindowServiceIntegrationTest extends AbstractPostgresIntegrationTest {

    @Autowired private MaintenanceWindowService service;
    @Autowired private MaintenanceWindowRepository repository;
    @Autowired private MaintenanceStateService stateService;
    @Autowired private UserRepository userRepository;
    @Autowired private JdbcTemplate jdbcTemplate;

    @AfterEach
    void cleanup() {
        // Context Spring được cache giữa các test class — để sót window ACTIVE là
        // MaintenanceModeFilter chặn 503 hàng loạt test khác. Dọn + nạp lại cache.
        repository.deleteAll();
        stateService.refreshNow();
    }

    // ── AC-MAINT-01: thông báo lịch + nhắc đúng một lần ──────────────────────

    @Test
    @DisplayName("create(notify) gửi SCHEDULED cho user active; nhắc T-remind gửi ĐÚNG MỘT LẦN dù job chạy lặp")
    void createAndRemindOnce() {
        User student = newStudent();
        LocalDateTime now = LocalDateTime.now(ZoneOffset.UTC);

        MaintenanceWindowService.CreateResult created = service.create(
                "Nâng cấp cơ sở dữ liệu", "Dự kiến 30 phút.",
                utc(now.plusMinutes(30)), utc(now.plusMinutes(90)),
                "FULL", true, false, true, "admin@test.local");

        assertThat(created.window().status()).isEqualTo("SCHEDULED");
        assertThat(created.window().notifiedScheduleAtUtc()).isNotNull();
        assertThat(maintenanceNoticeCount(student.getId(), "SCHEDULED")).isEqualTo(1);

        // startsAt trong cửa sổ nhắc mặc định (60') → nhắc ngay lần tick đầu, và chỉ một lần.
        assertThat(service.sendDueReminders()).isEqualTo(1);
        assertThat(service.sendDueReminders()).isZero();
        assertThat(maintenanceNoticeCount(student.getId(), "REMINDER")).isEqualTo(1);
    }

    @Test
    @DisplayName("create với startsAt quá khứ / autoComplete thiếu endsAt / mode lạ → BadRequest")
    void createValidation() {
        LocalDateTime now = LocalDateTime.now(ZoneOffset.UTC);
        assertThatThrownBy(() -> service.create("X", null, utc(now.minusMinutes(5)), null,
                "FULL", true, false, false, "admin@test.local"))
                .isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> service.create("X", null, utc(now.plusHours(1)), null,
                "FULL", true, true, false, "admin@test.local"))
                .isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> service.create("X", null, utc(now.plusHours(1)), utc(now.plusHours(2)),
                "READ_ONLY", true, false, false, "admin@test.local"))
                .isInstanceOf(BadRequestException.class);
    }

    // ── AC-MAINT-02/03: activate → complete, thông báo hoàn tất một lần ─────

    @Test
    @DisplayName("activate bật sớm kéo startsAt về now, STARTED chỉ in-app; complete ghi endsAt thật + COMPLETED một lần")
    void activateThenComplete() {
        User student = newStudent();
        LocalDateTime now = LocalDateTime.now(ZoneOffset.UTC);
        long id = service.create("Bảo trì tối", null, utc(now.plusHours(2)), utc(now.plusHours(3)),
                "FULL", true, false, false, "admin@test.local").window().id();

        MaintenanceWindowDto active = service.activate(id);
        assertThat(active.status()).isEqualTo("ACTIVE");
        // Bật sớm = bắt đầu từ bây giờ (không hiển thị window ACTIVE có startsAt tương lai).
        assertThat(active.startsAtUtc()).isBeforeOrEqualTo(Instant.now());
        assertThat(maintenanceNoticeCount(student.getId(), "STARTED")).isEqualTo(1);
        assertThat(stateService.activeFullWindow()).isPresent();

        MaintenanceWindowDto done = service.complete(id);
        assertThat(done.status()).isEqualTo("COMPLETED");
        assertThat(done.endsAtUtc()).isBeforeOrEqualTo(Instant.now().plus(1, ChronoUnit.SECONDS));
        assertThat(maintenanceNoticeCount(student.getId(), "COMPLETED")).isEqualTo(1);
        assertThat(stateService.activeFullWindow()).isEmpty();

        assertThatThrownBy(() -> service.complete(id)).isInstanceOf(ConflictException.class);
    }

    // ── AC-MAINT-05: bất biến MỘT window ACTIVE — DB enforce ─────────────────

    @Test
    @DisplayName("đang có ACTIVE: activate lịch thứ hai nổ DataIntegrityViolation (→409); emergency trả Conflict")
    void singleActiveInvariant() {
        LocalDateTime now = LocalDateTime.now(ZoneOffset.UTC);
        long first = service.create("A", null, utc(now.plusHours(1)), utc(now.plusHours(2)),
                "FULL", true, false, false, "admin@test.local").window().id();
        long second = service.create("B", null, utc(now.plusHours(3)), utc(now.plusHours(4)),
                "FULL", true, false, false, "admin@test.local").window().id();

        service.activate(first);
        assertThatThrownBy(() -> service.activate(second))
                .isInstanceOf(DataIntegrityViolationException.class);
        assertThatThrownBy(() -> service.emergency(null, null, null, "admin@test.local"))
                .isInstanceOf(ConflictException.class);

        service.complete(first);
        MaintenanceWindowDto emergency = service.emergency(null, "Sự cố dữ liệu.", null, "admin@test.local");
        assertThat(emergency.status()).isEqualTo("ACTIVE");
        assertThat(emergency.title()).isEqualTo("Bảo trì khẩn cấp");
        assertThat(stateService.activeFullWindow()).isPresent();
    }

    // ── Huỷ lịch: chỉ báo huỷ khi đã từng báo có lịch ────────────────────────

    @Test
    @DisplayName("cancel lịch CHƯA thông báo → im lặng; lịch ĐÃ thông báo → user nhận CANCELLED")
    void cancelNotifiesOnlyWhenAnnounced() {
        User student = newStudent();
        LocalDateTime now = LocalDateTime.now(ZoneOffset.UTC);

        long quiet = service.create("Q", null, utc(now.plusDays(1)), utc(now.plusDays(1).plusHours(1)),
                "FULL", true, false, false, "admin@test.local").window().id();
        service.cancel(quiet);
        assertThat(maintenanceNoticeCount(student.getId(), "CANCELLED")).isZero();

        long announced = service.create("A", null, utc(now.plusDays(2)), utc(now.plusDays(2).plusHours(1)),
                "FULL", true, false, true, "admin@test.local").window().id();
        service.cancel(announced);
        assertThat(maintenanceNoticeCount(student.getId(), "CANCELLED")).isEqualTo(1);
    }

    // ── ACTIVE chỉ sửa được endsAt/note; nhịp tự động; chuông quên tắt ───────

    @Test
    @DisplayName("update khi ACTIVE chặn đổi title/mode; completeDueWindows tự tắt window auto_complete quá ends_at")
    void activeUpdateRulesAndAutoComplete() {
        User student = newStudent();
        // Dựng thẳng entity ACTIVE quá hạn (đường create không cho startsAt quá khứ).
        MaintenanceWindow window = repository.save(MaintenanceWindow.builder()
                .title("Auto").startsAt(LocalDateTime.now(ZoneOffset.UTC).minusHours(2))
                .endsAt(LocalDateTime.now(ZoneOffset.UTC).minusMinutes(1))
                .mode(MaintenanceWindow.Mode.FULL).status(MaintenanceWindow.Status.ACTIVE)
                .autoActivate(true).autoComplete(true).createdBy("admin@test.local").build());
        stateService.refreshNow();

        assertThatThrownBy(() -> service.update(window.getId(), "Đổi tên", null, null, null, null, null, null))
                .isInstanceOf(BadRequestException.class);

        assertThat(service.completeDueWindows()).isEqualTo(1);
        assertThat(repository.findById(window.getId()).orElseThrow().getStatus())
                .isEqualTo(MaintenanceWindow.Status.COMPLETED);
        assertThat(maintenanceNoticeCount(student.getId(), "COMPLETED")).isEqualTo(1);
    }

    @Test
    @DisplayName("chuông quên tắt réo admin một lần mỗi nhịp (không dồn), qua ADMIN_SYSTEM_ALERT có sẵn")
    void overdueAlertOncePerCycle() {
        User admin = newUser(User.Role.ADMIN);
        MaintenanceWindow window = repository.save(MaintenanceWindow.builder()
                .title("Quên tắt").startsAt(LocalDateTime.now(ZoneOffset.UTC).minusHours(3))
                .endsAt(LocalDateTime.now(ZoneOffset.UTC).minusHours(1))
                .mode(MaintenanceWindow.Mode.FULL).status(MaintenanceWindow.Status.ACTIVE)
                .autoActivate(false).autoComplete(false).createdBy("admin@test.local").build());
        stateService.refreshNow();

        assertThat(service.alertOverdueWindows()).isEqualTo(1);
        assertThat(service.alertOverdueWindows()).isZero(); // trong cùng nhịp 30' — không réo lại
        assertThat(systemAlertCount(admin.getId())).isEqualTo(1);
        assertThat(repository.findById(window.getId()).orElseThrow().getOverdueAlertedAt()).isNotNull();
    }

    // ── Fix drill prod §12b ───────────────────────────────────────────────────

    @Test
    @DisplayName("fix #1: banner (upcoming) LOẠI lịch đã quá starts_at mà vẫn SCHEDULED, và lịch định kỳ")
    void upcomingExcludesPastDueAndRecurring() {
        LocalDateTime now = LocalDateTime.now(ZoneOffset.UTC);
        // Lịch quá giờ mà không tự bật (auto_activate=false) → không còn là "sắp tới".
        repository.save(MaintenanceWindow.builder()
                .title("Quá giờ").startsAt(now.minusMinutes(5)).endsAt(now.plusMinutes(25))
                .mode(MaintenanceWindow.Mode.FULL).status(MaintenanceWindow.Status.SCHEDULED)
                .autoActivate(false).autoComplete(false).createdBy("admin@test.local").build());
        // Lịch định kỳ tương lai → không lên banner.
        repository.save(MaintenanceWindow.builder()
                .title("Định kỳ").startsAt(now.plusHours(2)).endsAt(now.plusHours(2).plusMinutes(15))
                .mode(MaintenanceWindow.Mode.FULL).status(MaintenanceWindow.Status.SCHEDULED)
                .autoActivate(true).autoComplete(true).recurrenceKey("daily:test").createdBy("recurring-daily").build());
        stateService.refreshNow();
        assertThat(stateService.upcomingWindow()).isEmpty();

        // Lịch thường tương lai → CÓ lên banner.
        service.create("Sắp tới", null, utc(now.plusHours(3)), utc(now.plusHours(3).plusMinutes(20)),
                "FULL", true, false, false, "admin@test.local");
        stateService.refreshNow();
        assertThat(stateService.upcomingWindow()).isPresent();
    }

    @Test
    @DisplayName("fix #3: cancel gửi CANCELLED nếu ĐÃ NHẮC (notified_before_at) dù chưa gửi 'có lịch'")
    void cancelNotifiesWhenOnlyReminded() {
        User student = newStudent();
        LocalDateTime now = LocalDateTime.now(ZoneOffset.UTC);
        // Lịch notifyUsers=off (không notified_schedule_at) nhưng job đã nhắc.
        MaintenanceWindow window = repository.save(MaintenanceWindow.builder()
                .title("Đã nhắc").startsAt(now.plusMinutes(30)).endsAt(now.plusMinutes(60))
                .mode(MaintenanceWindow.Mode.FULL).status(MaintenanceWindow.Status.SCHEDULED)
                .autoActivate(true).autoComplete(false)
                .notifiedBeforeAt(now).createdBy("admin@test.local").build());

        service.cancel(window.getId());
        assertThat(maintenanceNoticeCount(student.getId(), "CANCELLED")).isEqualTo(1);
    }

    @Test
    @DisplayName("materializeDailyWindow: mặc định TẮT (dailyEnabled=false) → không tạo gì")
    void dailyDisabledByDefault() {
        assertThat(service.materializeDailyWindow()).isZero();
        assertThat(repository.count()).isZero();
    }

    // ── Fixtures & helpers ───────────────────────────────────────────────────

    private User newStudent() {
        return newUser(User.Role.STUDENT);
    }

    private User newUser(User.Role role) {
        return userRepository.save(User.builder()
                .email("mw-" + UUID.randomUUID() + "@test.local")
                .passwordHash("x")
                .displayName("Maintenance Tester")
                .role(role)
                .build());
    }

    /** Số notification SYSTEM_MAINTENANCE của một người theo payload.kind. */
    private long maintenanceNoticeCount(long recipientId, String kind) {
        Long count = jdbcTemplate.queryForObject("""
                SELECT COUNT(*) FROM user_notifications
                WHERE recipient_user_id = ? AND notification_type = 'SYSTEM_MAINTENANCE'
                  AND payload_json->>'kind' = ?
                """, Long.class, recipientId, kind);
        return count != null ? count : 0;
    }

    private long systemAlertCount(long recipientId) {
        Long count = jdbcTemplate.queryForObject("""
                SELECT COUNT(*) FROM user_notifications
                WHERE recipient_user_id = ? AND notification_type = 'ADMIN_SYSTEM_ALERT'
                  AND payload_json->>'source' = 'maintenance'
                """, Long.class, recipientId);
        return count != null ? count : 0;
    }

    private static Instant utc(LocalDateTime ldt) {
        return ldt.toInstant(ZoneOffset.UTC);
    }
}
