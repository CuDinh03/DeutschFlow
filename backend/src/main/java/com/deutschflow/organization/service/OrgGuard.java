package com.deutschflow.organization.service;

import com.deutschflow.common.exception.ForbiddenException;
import com.deutschflow.organization.entity.OrgMember;
import com.deutschflow.organization.entity.OrgRole;
import com.deutschflow.organization.repository.OrgMemberRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * DB-backed authorization guard for organization (tenant) access.
 *
 * <p>Mirrors {@code TeacherService.assertTeacherOwnsClass}: backend authz always re-verifies
 * membership in {@code org_members} from the DB rather than trusting the JWT {@code orgRole}
 * claim (the claim only drives frontend routing/UI).
 *
 * <p>Role tiers come from {@link OrgRole} (P0-3 — single source of truth); an unrecognized stored
 * role parses to {@code null} and is denied (fail closed).
 */
@Service
@RequiredArgsConstructor
public class OrgGuard {

    private static final String STATUS_ACTIVE = "ACTIVE";

    private final OrgMemberRepository memberRepo;

    /** Asserts the user is an ACTIVE member of the org; returns the membership row. */
    @Transactional(readOnly = true)
    public OrgMember assertMember(Long userId, Long orgId) {
        return memberRepo.findByIdOrgIdAndIdUserId(orgId, userId)
                .filter(m -> STATUS_ACTIVE.equals(m.getStatus()))
                .orElseThrow(() -> new ForbiddenException("Bạn không thuộc tổ chức này"));
    }

    /** Asserts the user is an ACTIVE OWNER/MANAGER of the org. */
    @Transactional(readOnly = true)
    public void assertOrgAdmin(Long userId, Long orgId) {
        OrgMember member = assertMember(userId, orgId);
        OrgRole role = OrgRole.from(member.getRole());
        if (role == null || !role.isAdmin()) {
            throw new ForbiddenException("Chỉ quản trị viên tổ chức mới được thao tác này");
        }
    }

    /** Asserts the user is the ACTIVE OWNER of the org (role changes, ownership-level actions). */
    @Transactional(readOnly = true)
    public void assertOrgOwner(Long userId, Long orgId) {
        OrgMember member = assertMember(userId, orgId);
        if (OrgRole.from(member.getRole()) != OrgRole.OWNER) {
            throw new ForbiddenException("Chỉ chủ sở hữu tổ chức mới được thao tác này");
        }
    }

    /**
     * Asserts the user may view financial information (OWNER or MANAGER).
     * Org-role ADMIN was renamed to MANAGER and ACCOUNTANT dropped (B2B model §1, D2).
     */
    @Transactional(readOnly = true)
    public void assertOrgFinance(Long userId, Long orgId) {
        OrgMember member = assertMember(userId, orgId);
        OrgRole role = OrgRole.from(member.getRole());
        if (role == null || !role.isAdmin()) {
            throw new ForbiddenException("Chỉ quản trị viên hoặc kế toán mới xem được thông tin tài chính");
        }
    }
}
