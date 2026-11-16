package com.deutschflow.feedback.service;

import com.deutschflow.media.service.S3StorageService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.List;

/**
 * Dọn ảnh góp ý tải lên mà 24 giờ không gắn vào góp ý nào (BR-gopycapnhat-03): xoá dòng
 * {@code feedback_attachments} rồi xoá file R2 SAU commit. Ảnh chụp màn hình là dữ liệu riêng tư, không
 * giữ quá lâu hơn cần thiết.
 *
 * <p>Bean logic tách khỏi vỏ {@code @Scheduled} (bẫy ShedLock + proxy Spring): job gọi vào đây nên
 * {@code @Transactional} có hiệu lực, và IT gọi thẳng {@link #purgeOnce(Instant)}.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class FeedbackOrphanCleanupService {

    static final Duration ORPHAN_AFTER = Duration.ofHours(24);
    static final int BATCH = 500;

    private final JdbcTemplate jdbc;
    private final S3StorageService storage;

    /** Số ảnh mồ côi đã xoá trong lượt này (tối đa {@value #BATCH}; phần còn lại để đêm sau). */
    @Transactional
    public int purgeOnce(Instant now) {
        List<String> keys = jdbc.queryForList("""
                DELETE FROM feedback_attachments
                WHERE id IN (
                    SELECT id FROM feedback_attachments
                    WHERE feedback_id IS NULL AND created_at < ?
                    ORDER BY id
                    LIMIT ?)
                RETURNING object_key
                """, String.class, Timestamp.from(now.minus(ORPHAN_AFTER)), BATCH);
        if (keys.isEmpty()) return 0;
        Runnable deleteFiles = () -> keys.forEach(this::deleteQuietly);
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    deleteFiles.run();
                }
            });
        } else {
            deleteFiles.run();
        }
        log.info("[feedback] removed {} unattached screenshot(s) older than 24h", keys.size());
        return keys.size();
    }

    private void deleteQuietly(String key) {
        try {
            storage.deleteFile(key);
        } catch (RuntimeException e) {
            log.error("[feedback] orphan cleanup: could not delete storage object {}: {}", key, e.getMessage());
        }
    }
}
