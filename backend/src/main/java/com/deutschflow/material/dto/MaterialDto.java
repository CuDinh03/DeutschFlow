package com.deutschflow.material.dto;

import com.deutschflow.material.entity.Material;

import java.time.Instant;
import java.util.Arrays;
import java.util.List;

/**
 * Read view of a {@link Material}. {@code url} is the resolvable object URL — a presigned GET for file
 * materials, or the raw {@code externalUrl} for {@code kind=LINK} (the service fills it; this stays the
 * single abstraction point so a later CloudFront swap touches one method). The raw S3 key is never exposed.
 */
public record MaterialDto(
        Long id,
        String ownerScope,
        String title,
        String description,
        String kind,
        String url,
        String externalUrl,
        Long folderId,
        Integer durationSeconds,
        List<String> tags,
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
                m.getExternalUrl(),
                m.getFolderId(),
                m.getDurationSeconds(),
                m.getTags() == null ? List.of() : Arrays.asList(m.getTags()),
                m.getMimeType(),
                m.getSizeBytes(),
                m.getVisibility(),
                m.getStatus(),
                m.getCreatedBy(),
                m.getCreatedAt());
    }
}
