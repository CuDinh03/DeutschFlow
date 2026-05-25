package com.deutschflow.media;

import com.deutschflow.common.exception.ForbiddenException;
import com.deutschflow.media.entity.MediaAsset;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.entity.User.Role;

/**
 * Centralizes upload / mutate authorization for media assets.
 */
public final class MediaAssetAccessPolicy {

    private MediaAssetAccessPolicy() {
    }

    public static boolean isAdmin(User user) {
        return user != null && user.getRole() == Role.ADMIN;
    }

    public static boolean isUploader(User user, MediaAsset asset) {
        return user != null && asset != null && asset.getUploadedBy() != null && asset.getUploadedBy().getId() != null
                && asset.getUploadedBy().getId().equals(user.getId());
    }

    public static void requireUploadAllowed(User user, MediaCategory category) {
        if (user == null) {
            throw new ForbiddenException("Authentication required");
        }
        if (user.getRole() == Role.ADMIN) {
            return;
        }
        if (user.getRole() == Role.TEACHER && category.isTeacherUploadAllowed()) {
            return;
        }
        throw new ForbiddenException("You are not allowed to upload media in category: " + category.name());
    }

    public static void requireDeleteAllowed(User user, MediaAsset asset) {
        if (user == null) {
            throw new ForbiddenException("Authentication required");
        }
        MediaCategory category = MediaCategory.parse(asset.getCategory());
        if (user.getRole() == Role.ADMIN) {
            return;
        }
        if (category.isAdminOnlyManaged()) {
            throw new ForbiddenException("Only administrators can delete this media asset");
        }
        if (isUploader(user, asset)) {
            return;
        }
        throw new ForbiddenException("You do not have permission to delete this media asset");
    }

    public static void requireUpdateAllowed(User user, MediaAsset asset) {
        requireDeleteAllowed(user, asset);
    }
}
