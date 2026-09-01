package com.deutschflow.notification.jobs;

import com.deutschflow.notification.service.NotificationOutboxService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Worker gửi outbox thông báo (V294, G2): quét dòng đến hạn mỗi phút, gửi từng dòng trong TX riêng
 * của {@link NotificationOutboxService}; lỗi một dòng không chặn các dòng còn lại. Một entry point
 * duy nhất, method khoá trả void (hợp đồng ShedLock — SchedulerLockVoidContractTest tự quét);
 * initialDelay để app boot xong hẳn mới chạy lượt đầu.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class NotificationOutboxWorker {

    private final NotificationOutboxService outboxService;

    @Scheduled(initialDelay = 30_000, fixedDelay = 60_000)
    @SchedulerLock(name = "notificationOutboxDispatch", lockAtMostFor = "PT5M", lockAtLeastFor = "PT10S")
    public void dispatchDue() {
        List<Long> due = outboxService.findDueIds(LocalDateTime.now());
        if (due.isEmpty()) return;
        int sent = 0;
        for (Long id : due) {
            try {
                outboxService.deliver(id);
                sent++;
            } catch (Exception e) {
                outboxService.markFailure(id, e.toString());
            }
        }
        log.info("[outbox] dispatched {}/{} due rows", sent, due.size());
    }
}
