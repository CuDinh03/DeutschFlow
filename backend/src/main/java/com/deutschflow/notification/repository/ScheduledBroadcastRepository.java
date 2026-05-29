package com.deutschflow.notification.repository;

import com.deutschflow.notification.entity.ScheduledBroadcast;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.List;

public interface ScheduledBroadcastRepository extends JpaRepository<ScheduledBroadcast, Long> {

    /** Broadcasts in the given status that are due (scheduled_at &le; the cutoff), oldest first. */
    List<ScheduledBroadcast> findByStatusAndScheduledAtLessThanEqualOrderByScheduledAtAsc(
            ScheduledBroadcast.Status status, LocalDateTime cutoff);
}
