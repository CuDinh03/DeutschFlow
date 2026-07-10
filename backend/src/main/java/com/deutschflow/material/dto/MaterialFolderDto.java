package com.deutschflow.material.dto;

import com.deutschflow.material.entity.MaterialFolder;

import java.time.Instant;

/**
 * Read view of a {@link MaterialFolder}. Ownership internals (teacherId/orgId) are not exposed;
 * {@code ownerScope} is enough for the UI to group "Của tôi" vs "Trung tâm".
 */
public record MaterialFolderDto(
        Long id,
        String ownerScope,
        String name,
        Integer orderIndex,
        Long createdBy,
        Instant createdAt
) {
    public static MaterialFolderDto from(MaterialFolder f) {
        return new MaterialFolderDto(
                f.getId(),
                f.getOwnerScope(),
                f.getName(),
                f.getOrderIndex(),
                f.getCreatedBy(),
                f.getCreatedAt());
    }
}
