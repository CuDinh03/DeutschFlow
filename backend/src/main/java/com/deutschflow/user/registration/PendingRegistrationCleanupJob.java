package com.deutschflow.user.registration;

import lombok.RequiredArgsConstructor;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Lịch dọn hồ sơ đăng ký chờ, 03:30 giờ VN. Ba annotation trên CÙNG một method {@code void}
 * ({@code SchedulerLockVoidContractTest}), logic ở bean khác ({@link PendingRegistrationCleanup}).
 */
@Component
@RequiredArgsConstructor
public class PendingRegistrationCleanupJob {

    private final PendingRegistrationCleanup cleanup;

    @Scheduled(cron = "0 30 3 * * *", zone = "Asia/Ho_Chi_Minh")
    @SchedulerLock(name = "pendingRegistrationCleanup", lockAtMostFor = "PT10M", lockAtLeastFor = "PT1M")
    public void purge() {
        cleanup.purge();
    }
}
