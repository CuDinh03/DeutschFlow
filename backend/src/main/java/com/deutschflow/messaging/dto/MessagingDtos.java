package com.deutschflow.messaging.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.Instant;

/** DTOs for direct student ↔ teacher messaging. */
public final class MessagingDtos {

    /**
     * POST /api/messages — send a 1-1 message.
     * {@code clientTempId} (tuỳ chọn) là idempotency key: client outbox gửi lại cùng key khi retry,
     * server thấy key đã dùng thì trả lại bản ghi cũ thay vì tạo tin trùng (F-13). Bỏ trống = mỗi
     * POST một bản ghi như trước (web/client cũ không đổi hành vi).
     */
    public record SendMessageRequest(
            @NotNull Long recipientId,
            @NotBlank @Size(max = 8000) String body,
            @Size(max = 64) String clientTempId
    ) {}

    /** A single message in a thread. {@code mine} = sent by the caller (drives bubble alignment). */
    public record MessageDto(
            Long id,
            Long senderId,
            Long recipientId,
            String body,
            Instant createdAt,
            Instant readAt,
            boolean mine
    ) {}

    /** A conversation summary: the other party + last message preview + unread count for the caller. */
    public record ConversationDto(
            Long userId,
            String displayName,
            String email,
            String lastMessage,
            Instant lastAt,
            long unread
    ) {}

    private MessagingDtos() {}
}
