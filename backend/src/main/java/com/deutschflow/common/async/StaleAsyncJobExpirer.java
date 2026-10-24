package com.deutschflow.common.async;

import lombok.RequiredArgsConstructor;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Entry point LỊCH cho việc dọn job {@code async_jobs} bị bỏ rơi — logic thật ở
 * {@link StaleAsyncJobMaintenance}, gọi qua proxy (không tự-gọi cùng bean).
 *
 * <p>Quét ~5 phút một lần chứ không chờ cron đêm: người dùng đang ngồi chờ chính job đó (nộp bài
 * thi thử, sinh bài luyện). initialDelay &gt; 0 để không chạy ngay lúc boot.
 *
 * <p>Method mang @SchedulerLock phải trả {@code void} — {@code SchedulerLockVoidContractTest} khoá
 * ràng buộc này.
 */
@Component
@RequiredArgsConstructor
public class StaleAsyncJobExpirer {

    private final StaleAsyncJobMaintenance maintenance;

    @Scheduled(
            fixedDelayString = "${app.async-jobs.sweep-delay-ms:300000}",
            initialDelayString = "${app.async-jobs.sweep-initial-delay-ms:90000}")
    @SchedulerLock(name = "staleAsyncJobExpire", lockAtMostFor = "PT4M", lockAtLeastFor = "PT30S")
    public void expireStaleJobs() {
        maintenance.expireStale();
    }
}
