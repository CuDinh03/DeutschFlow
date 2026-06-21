package com.deutschflow.material.dto;

import com.deutschflow.material.entity.Material;

import java.time.Instant;

/**
 * Read view of a {@link Material}. {@code url} is the resolvable object URL (filled by the service
 * from the S3 key). The raw S3 key is intentionally NOT exposed to clients.
 */
public record MaterialDto(
        Long id,
        String ownerScope,
        String title,
        String description,
        String kind,
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
                url,
                m.getMimeType(),
                m.getSizeBytes(),
                m.getVisibility(),
                m.getStatus(),
                m.getCreatedBy(),
                m.getCreatedAt());
    }
}
