package com.deutschflow.system;

import com.deutschflow.system.entity.MaintenanceWindow;
import com.deutschflow.system.repository.MaintenanceWindowRepository;
import com.deutschflow.system.service.MaintenanceStateService;
import com.deutschflow.system.service.MaintenanceWindowService;
import com.deutschflow.testsupport.AbstractPostgresIntegrationTest;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.TestPropertySource;

import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * PR-A2 — bảo trì định kỳ hằng ngày BẬT (§12b). Lead rất lớn để materialize luôn chạy
 * bất kể giờ chạy test; notify=false nên chỉ tạo cửa sổ, không bắn thông báo. Kiểm:
 * tạo ĐÚNG MỘT cửa sổ SCHEDULED cho lần kế tiếp (giờ VN → UTC), idempotent (unique
 * recurrence_key), auto bật/tắt BẬT, và cửa sổ định kỳ KHÔNG lên banner upcoming.
 */
@SpringBootTest
@TestPropertySource(properties = {
        "app.maintenance.daily.enabled=true",
        "app.maintenance.daily.time=03:00",
        "app.maintenance.daily.duration-minutes=15",
        "app.maintenance.daily.mode=FULL",
        "app.maintenance.daily.notify=false",
        "app.maintenance.daily.materialize-lead-minutes=100000",
})
@DisplayName("Maintenance daily recurring (V302) — enabled path")
class MaintenanceDailyRecurringIntegrationTest extends AbstractPostgresIntegrationTest {

    private static final ZoneId VN = ZoneId.of("Asia/Ho_Chi_Minh");

    @Autowired private MaintenanceWindowService service;
    @Autowired private MaintenanceWindowRepository repository;
    @Autowired private MaintenanceStateService stateService;

    @AfterEach
    void cleanup() {
        repository.deleteAll();
        stateService.refreshNow();
    }

    @Test
    @DisplayName("tạo đúng MỘT cửa sổ định kỳ cho lần 03:00 VN kế tiếp; gọi lại idempotent")
    void materializesNextOccurrenceOnce() {
        assertThat(service.materializeDailyWindow()).isEqualTo(1);
        assertThat(service.materializeDailyWindow()).isZero(); // đã có → không tạo trùng

        var all = repository.findAll();
        assertThat(all).hasSize(1);
        MaintenanceWindow w = all.get(0);
        assertThat(w.getStatus()).isEqualTo(MaintenanceWindow.Status.SCHEDULED);
        assertThat(w.getMode()).isEqualTo(MaintenanceWindow.Mode.FULL);
        assertThat(w.isAutoActivate()).isTrue();
        assertThat(w.isAutoComplete()).isTrue();
        assertThat(w.getCreatedBy()).isEqualTo("recurring-daily");
        assertThat(w.getRecurrenceKey()).startsWith("daily:");

        // starts_at (UTC) đúng là 03:00 giờ VN của một ngày, kết thúc +15'.
        ZonedDateTime startVn = w.getStartsAt().atOffset(ZoneOffset.UTC).atZoneSameInstant(VN);
        assertThat(startVn.getHour()).isEqualTo(3);
        assertThat(startVn.getMinute()).isZero();
        assertThat(startVn).isAfter(ZonedDateTime.now(VN)); // lần KẾ TIẾP, không phải quá khứ
        assertThat(w.getEndsAt()).isEqualTo(w.getStartsAt().plusMinutes(15));
    }

    @Test
    @DisplayName("cửa sổ định kỳ KHÔNG lên banner upcoming (khỏi spam mỗi ngày)")
    void recurringWindowNotOnBanner() {
        service.materializeDailyWindow();
        stateService.refreshNow();
        assertThat(stateService.upcomingWindow()).isEmpty();
    }

    @Test
    @DisplayName("notify=false: chỉ tạo cửa sổ, không sinh thông báo SYSTEM_MAINTENANCE nào")
    void noNotificationsWhenNotifyOff() {
        service.materializeDailyWindow();
        MaintenanceWindow w = repository.findAll().get(0);
        assertThat(w.getNotifiedScheduleAt()).isNull();
    }
}
