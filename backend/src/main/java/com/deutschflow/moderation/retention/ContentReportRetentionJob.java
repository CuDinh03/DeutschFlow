package com.deutschflow.moderation.retention;

import lombok.extern.slf4j.Slf4j;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Instant;

/**
 * Vỏ lịch chạy của {@link ContentReportRetentionService}. Ở đây chỉ có giờ chạy, khoá giữa các node
 * và một chốt bắt mọi ngoại lệ để một đêm hỏng không giết luồng scheduler của cả tiến trình.
 *
 * <p><b>05:00 giờ Việt Nam</b> — khe trống sau {@code DataRetentionJob} (03:30),
 * {@code UserNotificationRetentionJob} (04:00) và {@code MinorAudioRetentionJob} (04:30). Xếp cuối
 * là cố ý: ba job kia nặng hơn nhiều; job này UPDATE vài chục dòng mỗi đêm.
 *
 * <p>🪤 <b>{@code zone = "Asia/Ho_Chi_Minh"} bắt buộc.</b> Container chạy giờ UTC; không ghim zone
 * thì "05:00" thành trưa giờ Việt Nam — job dọn chạy giữa giờ cao điểm.
 *
 * <p>🪤 <b>{@code @SchedulerLock} đòi phương thức trả {@code void}</b> ({@code SchedulerLockVoidContractTest}
 * quét bytecode). Số đếm của lượt chạy lấy ở {@link ContentReportRetentionService#purgeOnce(Instant)}
 * khi cần cho ca test, không lấy ở đây.
 */
@Slf4j
@Component
public class ContentReportRetentionJob {

    private final ContentReportRetentionService retentionService;
    private final boolean enabled;

    public ContentReportRetentionJob(
            ContentReportRetentionService retentionService,
            @Value("${app.moderation.retention.enabled:true}") boolean enabled) {
        this.retentionService = retentionService;
        this.enabled = enabled;
    }

    @Scheduled(cron = "${app.moderation.retention.cron:0 0 5 * * *}", zone = "Asia/Ho_Chi_Minh")
    @SchedulerLock(name = "contentReportRetention", lockAtMostFor = "PT30M", lockAtLeastFor = "PT1M")
    public void purgeResolvedReportContent() {
        if (!enabled) {
            return;
        }
        try {
            retentionService.purgeOnce(Instant.now());
        } catch (RuntimeException e) {
            // Dọn dẹp là việc tốt-nhất-có-thể. Ném ra khỏi đây là mất luôn các lượt sau.
            log.warn("[ContentReportRetentionJob] lượt dọn thất bại: {}", e.getMessage(), e);
        }
    }
}
