package com.deutschflow.notification.repository;

import com.deutschflow.notification.entity.NotificationOutbox;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface NotificationOutboxRepository extends JpaRepository<NotificationOutbox, Long> {

    /** Dòng đến hạn gửi (PENDING lẫn FAILED còn quota retry) — worker quét theo idx_outbox_due. */
    @Query("""
            SELECT o FROM NotificationOutbox o
            WHERE o.status <> 'SENT' AND o.attempts < :maxAttempts AND o.nextAttemptAt <= :now
            ORDER BY o.nextAttemptAt ASC
            """)
    List<NotificationOutbox> findDue(@Param("now") LocalDateTime now,
                                     @Param("maxAttempts") int maxAttempts,
                                     Pageable pageable);
}
