package com.deutschflow.organization.entity;

import java.util.Locale;
import java.util.Set;

/**
 * Canonical organization (tenant) role vocabulary.
 *
 * <p>The backing column {@code org_members.role} stays a {@code String} for DB stability; this enum
 * centralizes the values and permission tiers that were previously duplicated as String literals
 * across {@code OrgGuard} / {@code OrgMembershipService} / {@code OrgInvitationService} (P0-3).
 *
 * <p>Org-role ADMIN was renamed to MANAGER and ACCOUNTANT dropped (B2B model §1, D2 / V225).
 * {@link #from(String)} fails closed (returns {@code null}) on blank/unknown input so authz callers
 * deny by default.
 */
public enum OrgRole {
    OWNER,
    MANAGER,
    TEACHER,
    STUDENT;

    /** Org-admin tier — full management + finance visibility (OWNER or MANAGER). */
    public static final Set<OrgRole> ADMIN = Set.of(OWNER, MANAGER);

    /** Roles assignable via the role-change / invite endpoints (OWNER is set only via ownership). */
    public static final Set<OrgRole> ASSIGNABLE = Set.of(MANAGER, TEACHER);

    /** Parse a stored/raw role string; {@code null} when blank or unrecognized. */
    public static OrgRole from(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        try {
            return OrgRole.valueOf(raw.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    /** True for OWNER/MANAGER (org-admin tier). */
    public boolean isAdmin() {
        return ADMIN.contains(this);
    }

    /** True for roles assignable via role-change / invite (MANAGER/TEACHER). */
    public boolean isAssignable() {
        return ASSIGNABLE.contains(this);
    }
}
