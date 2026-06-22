package com.deutschflow.organization.service;

import com.deutschflow.common.exception.ForbiddenException;
import com.deutschflow.organization.entity.OrgMember;
import com.deutschflow.organization.repository.OrgMemberRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Set;

/**
 * DB-backed authorization guard for organization (tenant) access.
 *
 * <p>Mirrors {@code TeacherService.assertTeacherOwnsClass}: backend authz always re-verifies
 * membership in {@code org_members} from the DB rather than trusting the JWT {@code orgRole}
 * claim (the claim only drives frontend routing/UI).
 */
@Service
@RequiredArgsConstructor
public class OrgGuard {

    private static final String STATUS_ACTIVE = "ACTIVE";
    private static final Set<String> ADMIN_ROLES = Set.of("OWNER", "MANAGER");
    // Tài chính (hoá đơn/thanh toán) CHỈ dành cho OWNER (giám đốc trung tâm). MANAGER (nhân sự)
    // là org-admin cho vận hành hằng ngày nhưng KHÔNG xem tiền — quyết định sản phẩm 2026-06-22.
    private static final Set<String> FINANCE_ROLES = Set.of("OWNER");

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
        if (!ADMIN_ROLES.contains(member.getRole())) {
            throw new ForbiddenException("Chỉ quản trị viên tổ chức mới được thao tác này");
        }
    }

    /** Asserts the user is the ACTIVE OWNER of the org (role changes, ownership-level actions). */
    @Transactional(readOnly = true)
    public void assertOrgOwner(Long userId, Long orgId) {
        OrgMember member = assertMember(userId, orgId);
        if (!"OWNER".equals(member.getRole())) {
            throw new ForbiddenException("Chỉ chủ sở hữu tổ chức mới được thao tác này");
        }
    }

    /**
     * Asserts the user may view financial information — OWNER only.
     * Org-role ADMIN→MANAGER + ACCOUNTANT dropped (B2B model §1, D2); finance was then narrowed
     * from {OWNER, MANAGER} to OWNER only (2026-06-22): OWNER = giám đốc nắm tài chính, MANAGER =
     * nhân sự lo vận hành (mời/import/xoá/xem lớp–học viên–phân tích) nhưng không xem tiền.
     */
    @Transactional(readOnly = true)
    public void assertOrgFinance(Long userId, Long orgId) {
        OrgMember member = assertMember(userId, orgId);
        if (!FINANCE_ROLES.contains(member.getRole())) {
            throw new ForbiddenException("Chỉ chủ sở hữu (giám đốc) mới xem được thông tin tài chính");
        }
    }
}
