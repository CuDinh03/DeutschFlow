package com.deutschflow.system.jobs;

import com.deutschflow.system.service.MaintenanceWindowService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Nhịp vận hành cửa sổ bảo trì (thiết kế §5.5): nhắc trước giờ → tự bật → tự tắt →
 * chuông quên tắt. Job mỏng delegate sang service {@code @Transactional} (tránh bẫy
 * self-invocation vô hiệu transaction — pattern {@code ScheduledBroadcastJob}); mỗi
 * bước một transaction riêng + try/catch riêng để một bước hỏng không kéo các bước
 * còn lại rơi theo.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class MaintenanceWindowJob {

    private final MaintenanceWindowService maintenanceWindowService;

    @Scheduled(
            fixedDelayString = "${app.maintenance.job-delay-ms:60000}",
            initialDelayString = "${app.maintenance.job-initial-delay-ms:15000}")
    @SchedulerLock(name = "maintenanceWindowTick", lockAtMostFor = "PT5M", lockAtLeastFor = "PT0S")
    public void tick() {
        // Vật chất hoá cửa sổ định kỳ TRƯỚC — để cùng nhịp còn kịp nhắc/bật nếu tới giờ.
        step("materializeDailyWindow", maintenanceWindowService::materializeDailyWindow);
        step("sendDueReminders", maintenanceWindowService::sendDueReminders);
        step("activateDueWindows", maintenanceWindowService::activateDueWindows);
        step("completeDueWindows", maintenanceWindowService::completeDueWindows);
        step("alertOverdueWindows", maintenanceWindowService::alertOverdueWindows);
    }

    private void step(String name, java.util.function.IntSupplier action) {
        try {
            int n = action.getAsInt();
            if (n > 0) {
                log.info("[MaintenanceWindowJob] {} → {} window(s)", name, n);
            }
        } catch (Exception e) {
            log.error("[MaintenanceWindowJob] {} failed: {}", name, e.getMessage(), e);
        }
    }
}
