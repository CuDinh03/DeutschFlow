package com.deutschflow.feedback.service;

import com.deutschflow.feedback.repository.FeedbackAttachmentRepository;
import com.deutschflow.media.service.S3StorageService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.util.List;

/**
 * Xoá file ảnh góp ý trên R2 khi người dùng xoá tài khoản (FBK-64, BR-30).
 *
 * <p>Dòng DB tự đi theo FK CASCADE khi xoá {@code users}; file thì không, nên phải đọc danh sách khoá
 * TRƯỚC lệnh xoá và chỉ xoá file SAU commit (rollback thì file còn nguyên, khớp với dòng còn nguyên).
 * Lỗi xoá một file chỉ ghi {@code log.error} kèm khoá — không làm hỏng việc xoá tài khoản.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class FeedbackAccountCleanup {

    private final FeedbackAttachmentRepository attachments;
    private final S3StorageService storage;

    /** Gọi trong giao dịch xoá tài khoản, trước {@code DELETE FROM users}. */
    public void deleteFilesAfterCommit(long userId) {
        List<String> keys = attachments.findLiveObjectKeysByUploader(userId);
        if (keys.isEmpty()) return;
        Runnable deleteAll = () -> keys.forEach(this::deleteQuietly);
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    deleteAll.run();
                }
            });
        } else {
            deleteAll.run();
        }
    }

    private void deleteQuietly(String key) {
        try {
            storage.deleteFile(key);
        } catch (RuntimeException e) {
            log.error("[feedback] account deletion: could not delete storage object {}: {}", key, e.getMessage());
        }
    }
}
