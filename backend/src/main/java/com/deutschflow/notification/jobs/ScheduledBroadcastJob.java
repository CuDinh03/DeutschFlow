package com.deutschflow.notification.jobs;

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
import java.util.List;

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

    private final ScheduledBroadcastRepository scheduledBroadcastRepository;
    private final UserNotificationService userNotificationService;

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
        }
    }

    private static String truncate(String message) {
        if (message == null) {
            return "unknown error";
        }
        return message.length() <= MAX_ERROR_LENGTH ? message : message.substring(0, MAX_ERROR_LENGTH);
    }
}
