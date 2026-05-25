package com.deutschflow.media;

import java.util.EnumSet;
import java.util.Set;

/**
 * Known media asset categories and role-based access rules.
 */
public enum MediaCategory {
    LANDING,
    LESSON,
    PERSONA,
    ACHIEVEMENT,
    NEWS,
    VOCABULARY,
    TEACHER_MATERIAL,
    ASSIGNMENT,
    AVATAR,
    GENERAL;

    private static final Set<MediaCategory> ADMIN_ONLY_MANAGED = EnumSet.of(
            LANDING, LESSON, PERSONA, ACHIEVEMENT, NEWS, VOCABULARY
    );

    private static final Set<MediaCategory> TEACHER_UPLOAD = EnumSet.of(
            TEACHER_MATERIAL, ASSIGNMENT, AVATAR, GENERAL
    );

    public static MediaCategory parse(String raw) {
        if (raw == null || raw.isBlank()) {
            return GENERAL;
        }
        try {
            return MediaCategory.valueOf(raw.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            return GENERAL;
        }
    }

    public boolean isAdminOnlyManaged() {
        return ADMIN_ONLY_MANAGED.contains(this);
    }

    public boolean isTeacherUploadAllowed() {
        return TEACHER_UPLOAD.contains(this);
    }
}
