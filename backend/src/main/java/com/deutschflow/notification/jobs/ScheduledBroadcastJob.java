package com.deutschflow.notification.jobs;

import com.deutschflow.common.audit.AuditActor;
import com.deutschflow.common.audit.AuditLogService;
import com.deutschflow.notification.entity.ScheduledBroadcast;
import com.deutschflow.notification.repository.ScheduledBroadcastRepository;
import com.deutschflow.notification.service.UserNotificationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Dispatches admin broadcasts that were scheduled for future delivery. Polls for
 * {@link ScheduledBroadcast.Status#PENDING} rows whose {@code scheduledAt} has passed,
 * fans each one out, and records the outcome.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class ScheduledBroadcastJob {

    private static final int MAX_ERROR_LENGTH = 1000;

    /** Job chạy không có principal — actor SYSTEM (noi theo SepayWebhookService). */
    private static final AuditActor DISPATCH_ACTOR =
            new AuditActor(null, "scheduled-broadcast-job", "SYSTEM");

    private final ScheduledBroadcastRepository scheduledBroadcastRepository;
    private final UserNotificationService userNotificationService;
    private final AuditLogService auditLogService;

    @Scheduled(fixedDelayString = "${app.notifications.scheduled-broadcast.delay-ms:60000}")
    @SchedulerLock(name = "scheduledBroadcastDispatch", lockAtMostFor = "PT5M", lockAtLeastFor = "PT0S")
    public void dispatchDueBroadcasts() {
        LocalDateTime now = LocalDateTime.now(ZoneOffset.UTC);
        List<ScheduledBroadcast> due = scheduledBroadcastRepository
                .findByStatusAndScheduledAtLessThanEqualOrderByScheduledAtAsc(ScheduledBroadcast.Status.PENDING, now);

        if (due.isEmpty()) {
            return;
        }
        log.info("[ScheduledBroadcastJob] dispatching {} due broadcast(s)", due.size());

        for (ScheduledBroadcast broadcast : due) {
            try {
                int count = userNotificationService.dispatchScheduledBroadcast(broadcast);
                broadcast.setStatus(ScheduledBroadcast.Status.SENT);
                broadcast.setRecipientCount(count);
                broadcast.setSentAt(LocalDateTime.now(ZoneOffset.UTC));
                log.info("[ScheduledBroadcastJob] broadcast id={} sent → {} recipients", broadcast.getId(), count);
            } catch (Exception e) {
                broadcast.setStatus(ScheduledBroadcast.Status.FAILED);
                broadcast.setError(truncate(e.getMessage()));
                log.error("[ScheduledBroadcastJob] broadcast id={} failed: {}", broadcast.getId(), e.getMessage(), e);
            }
            scheduledBroadcastRepository.save(broadcast);
            auditDispatch(broadcast);
        }
    }

    /**
     * Audit R-M7 (03/09/2026): trước đây broadcast lên lịch chỉ để lại vết LÚC TẠO
     * ({@code admin.notification.broadcast} status=scheduled). Khi job nền thực sự gửi — hoặc gửi
     * THẤT BẠI — không có dòng nào vào {@code audit_logs}, nên màn audit của admin mãi chỉ thấy "đã
     * lên lịch", không bao giờ thấy "đã gửi cho N người" hay "gửi thất bại". Ghi ở đây (SAU khi đã
     * lưu trạng thái, ngoài transaction của dispatchScheduledBroadcast) nên cả ca thất bại — vốn
     * rollback tx dispatch — vẫn để lại vết. Vết lỗi ghi ở đây không được làm gãy lượt của broadcast
     * kế tiếp, nên bọc try/catch riêng.
     */
    private void auditDispatch(ScheduledBroadcast broadcast) {
        try {
            boolean sent = broadcast.getStatus() == ScheduledBroadcast.Status.SENT;
            Map<String, Object> meta = new LinkedHashMap<>();
            meta.put("scheduledId", broadcast.getId());
            meta.put("audienceType", broadcast.getAudienceType());
            meta.put("recipientCount", broadcast.getRecipientCount());
            meta.put("status", sent ? "sent" : "failed");
            if (!sent && broadcast.getError() != null) {
                meta.put("error", broadcast.getError());
            }
            auditLogService.log("admin.notification.broadcast.dispatched", DISPATCH_ACTOR,
                    "NOTIFICATION", String.valueOf(broadcast.getId()), meta);
        } catch (Exception e) {
            log.error("[ScheduledBroadcastJob] ghi vết dispatch id={} lỗi: {}", broadcast.getId(), e.getMessage());
        }
    }

    private static String truncate(String message) {
        if (message == null) {
            return "unknown error";
        }
        return message.length() <= MAX_ERROR_LENGTH ? message : message.substring(0, MAX_ERROR_LENGTH);
    }
}
