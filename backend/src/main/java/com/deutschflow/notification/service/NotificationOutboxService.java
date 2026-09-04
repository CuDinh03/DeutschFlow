package com.deutschflow.notification.service;

import com.deutschflow.notification.entity.NotificationOutbox;
import com.deutschflow.notification.repository.NotificationOutboxRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Bean LOGIC của outbox thông báo (V294, G2) — tách khỏi wrapper {@code @Scheduled} theo bài học
 * ShedLock/Spring-proxy: worker (bean khác) gọi vào đây nên {@code @Transactional} từng dòng có
 * hiệu lực, và IT gọi thẳng các method này không bị khoá scheduler nuốt.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class NotificationOutboxService {

    /** Quá trần thì dòng nằm FAILED chờ xử lý tay — không retry vô hạn một địa chỉ hỏng. */
    public static final int MAX_ATTEMPTS = 8;
    static final int BATCH_SIZE = 100;

    private final NotificationOutboxRepository outboxRepo;
    private final UserNotificationService userNotificationService;

    /** Các dòng đến hạn của lượt quét này (đọc ngoài TX ghi — mỗi dòng xử lý trong TX riêng). */
    @Transactional(readOnly = true)
    public List<Long> findDueIds(LocalDateTime now) {
        return outboxRepo.findDue(now, MAX_ATTEMPTS, PageRequest.of(0, BATCH_SIZE)).stream()
                .map(NotificationOutbox::getId)
                .toList();
    }

    /**
     * Gửi MỘT dòng — notification cho người nhận + đánh dấu SENT trong cùng giao dịch (idempotent:
     * dòng đã SENT thì bỏ qua, nên worker chạy trùng lượt không gửi đôi).
     */
    @Transactional
    public void deliver(Long outboxId) {
        NotificationOutbox row = outboxRepo.findById(outboxId).orElse(null);
        if (row == null || row.getStatus() == NotificationOutbox.Status.SENT) return;
        userNotificationService.deliverToUser(row.getRecipientId(), row.getNotificationType(), row.getPayload());
        row.setStatus(NotificationOutbox.Status.SENT);
        row.setSentAt(LocalDateTime.now());
        outboxRepo.save(row);
    }

    /**
     * Ghi nhận một lần gửi lỗi — TX MỚI để sống sót qua rollback của {@link #deliver}: attempts++,
     * hẹn giờ thử lại lũy tiến (1′ → 4′ → 16′ → 64′ → trần 12h), chạm trần thì FAILED.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void markFailure(Long outboxId, String error) {
        NotificationOutbox row = outboxRepo.findById(outboxId).orElse(null);
        if (row == null || row.getStatus() == NotificationOutbox.Status.SENT) return;
        int attempts = row.getAttempts() + 1;
        row.setAttempts(attempts);
        row.setLastError(error == null ? "unknown" : error);
        long delayMinutes = Math.min(720, (long) Math.pow(4, attempts));
        row.setNextAttemptAt(LocalDateTime.now().plusMinutes(delayMinutes));
        if (attempts >= MAX_ATTEMPTS) {
            row.setStatus(NotificationOutbox.Status.FAILED);
            log.error("[outbox] row {} FAILED after {} attempts: {}", outboxId, attempts, error);
        }
        outboxRepo.save(row);
    }
}
