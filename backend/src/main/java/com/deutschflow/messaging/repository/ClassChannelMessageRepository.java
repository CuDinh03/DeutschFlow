package com.deutschflow.messaging.repository;

import com.deutschflow.messaging.entity.ClassChannelMessage;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ClassChannelMessageRepository extends JpaRepository<ClassChannelMessage, Long> {

    /** Most-recent 200 messages of a class channel (newest first); the client reverses for display. */
    List<ClassChannelMessage> findTop200ByClassIdOrderByIdDesc(Long classId);

    /**
     * Tra idempotency key: bản ghi đã tồn tại của một lượt gửi (senderId + clientTempId) — dùng để
     * REPLAY một POST retry thay vì tạo tin trùng (F-13). Được UNIQUE index V300 bảo chứng ≤ 1 kết quả.
     */
    Optional<ClassChannelMessage> findBySenderIdAndClientTempId(Long senderId, String clientTempId);
}
