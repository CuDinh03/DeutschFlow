package com.deutschflow.messaging.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.time.Instant;

/** DTOs for the class group channel (P6). */
public final class ClassChannelDtos {

    /** POST body to send a class-channel message. */
    public record PostClassMessageRequest(
            @NotBlank @Size(max = 8000) String body
    ) {}

    /**
     * One channel message as seen by the caller.
     * {@code body} is null when {@code deleted} (members see a "[đã xoá]" placeholder — the
     * original text is retained server-side for teacher audit). {@code mine} drives bubble
     * alignment; {@code canDelete} drives the delete affordance (own message, or the caller
     * is a teacher of the class, and it isn't already deleted).
     */
    public record ClassMessageDto(
            Long id,
            Long senderId,
            String senderName,
            String body,
            Instant createdAt,
            boolean mine,
            boolean deleted,
            boolean canDelete
    ) {}

    private ClassChannelDtos() {}
}
