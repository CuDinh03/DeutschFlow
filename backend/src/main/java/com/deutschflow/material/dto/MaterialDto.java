package com.deutschflow.material.dto;

import com.deutschflow.material.entity.Material;

import java.time.Instant;

/**
 * Read view of a {@link Material}. {@code url} is the resolvable object URL (filled by the service
 * from the S3 key); {@code objectKey} is kept for clients that build their own URL.
 */
public record MaterialDto(
        Long id,
        String ownerScope,
        String title,
        String description,
        String kind,
        String objectKey,
        String url,
        String mimeType,
        Long sizeBytes,
        String visibility,
        String status,
        Long createdBy,
        Instant createdAt
) {
    public static MaterialDto from(Material m, String url) {
        return new MaterialDto(
                m.getId(),
                m.getOwnerScope(),
                m.getTitle(),
                m.getDescription(),
                m.getKind(),
                m.getObjectKey(),
                url,
                m.getMimeType(),
                m.getSizeBytes(),
                m.getVisibility(),
                m.getStatus(),
                m.getCreatedBy(),
                m.getCreatedAt());
    }
}
