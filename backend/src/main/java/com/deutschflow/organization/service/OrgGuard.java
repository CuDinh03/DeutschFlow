package com.deutschflow.organization.service;

import com.deutschflow.common.exception.ForbiddenException;
import com.deutschflow.common.exception.OrgReadOnlyException;
import com.deutschflow.organization.entity.OrgMember;
import com.deutschflow.organization.entity.Organization;
import com.deutschflow.organization.repository.OrgAcademicApproverRepository;
import com.deutschflow.organization.repository.OrgMemberRepository;
import com.deutschflow.organization.repository.OrganizationRepository;
import com.deutschflow.teacher.repository.TeacherClassRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
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
    private final OrgAcademicApproverRepository academicApproverRepo;
    private final TeacherClassRepository teacherClassRepository;
    private final OrganizationRepository organizationRepository;

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
     * Quyền DUYỆT HỌC VỤ (PR-2, quyết định P01 — spec D13/§6): OWNER (giám đốc) luôn có; ngoài ra
     * cần một phân công {@code org_academic_approvers} ĐANG hiệu lực phủ đúng phạm vi — scope ORG
     * phủ mọi lớp của trung tâm, scope CLASS phải đúng {@code classId}; {@code classId} null
     * (mốc học vụ mức trung tâm) thì chỉ scope ORG đạt.
     *
     * <p>MANAGER KHÔNG mặc định có quyền này — tách quyền duyệt học vụ khỏi quyền quản trị/tài
     * chính (spec §6). Ngoại lệ học Thứ Bảy/Chủ nhật (D14) KHÔNG đi qua đây — luôn dùng
     * {@link #assertOrgOwner}.
     */
    @Transactional(readOnly = true)
    public void assertAcademicApprover(Long userId, Long orgId, Long classId) {
        OrgMember member = assertMember(userId, orgId);
        // Guard tự vệ (security M1): classId do caller truyền PHẢI thuộc đúng trung tâm — áp cho
        // MỌI vai, kể cả OWNER; không tin caller đã tự xác minh.
        if (classId != null && !teacherClassRepository.existsByIdAndOrgId(classId, orgId)) {
            throw new ForbiddenException("Lớp không thuộc trung tâm này");
        }
        // Phòng thủ theo chiều sâu (security H1): STUDENT không bao giờ duyệt học vụ — kể cả khi
        // còn sót một dòng phân công cũ (ví dụ rời org rồi quay lại làm học viên).
        if ("STUDENT".equals(member.getRole())) {
            throw new ForbiddenException("Học viên không có quyền duyệt học vụ");
        }
        if ("OWNER".equals(member.getRole())) {
            return;
        }
        if (!academicApproverRepo.hasActiveApproval(orgId, userId, classId)) {
            throw new ForbiddenException("Chỉ giám đốc hoặc giáo viên trưởng được phân công mới duyệt được thay đổi học vụ này");
        }
    }

    /** Bản boolean của {@link #assertAcademicApprover} — cho DTO/UI, không ném lỗi. */
    @Transactional(readOnly = true)
    public boolean isAcademicApprover(Long userId, Long orgId, Long classId) {
        try {
            assertAcademicApprover(userId, orgId, classId);
            return true;
        } catch (ForbiddenException ex) {
            return false;
        }
    }

    /**
     * Cổng TRẠNG THÁI TRUNG TÂM (D5) — chỉ dành cho đường GHI.
     *
     * <p>Trung tâm bị đình chỉ, hoặc giấy phép đã hết hạn, mất quyền ghi NGAY (owner chốt
     * 09/09/2026 — xem {@link OrgLicenseState}): ném {@link OrgReadOnlyException} (403 +
     * {@code ORG_READ_ONLY}). Ân hạn 7 ngày sau mốc neo là quãng CHỈ-ĐỌC trước khi cắt quyền lợi,
     * không phải quãng còn ghi được — nên cổng này chặn ở cả {@code READ_ONLY} lẫn {@code CUT}.
     *
     * <p><b>Cố ý KHÔNG gộp vào {@link #assertMember}/{@link #assertOrgAdmin}:</b> hai hàm đó đang
     * gác cả đường ĐỌC (danh sách lớp, chi tiết học viên, phân tích, hoá đơn) lẫn đường GHI. D5 nói
     * rõ trung tâm hết hạn VẪN PHẢI XEM ĐƯỢC dữ liệu, nên nhét cổng vào đó là chặn nhầm đúng thứ
     * owner muốn giữ. Call-site GHI gọi thêm hàm này (hoặc {@link #assertOrgAdminForWrite}).
     *
     * <p>Không tìm thấy org → không chặn: {@link #assertMember} đã là hàng rào định danh, và một
     * dòng org biến mất là lỗi dữ liệu chứ không phải trạng thái giấy phép.
     */
    @Transactional(readOnly = true)
    public void assertOrgWritable(Long orgId) {
        Organization org = organizationRepository.findById(orgId).orElse(null);
        if (org == null) {
            return;
        }
        if (!licenceMode(org).writable()) {
            throw new OrgReadOnlyException(orgId, OrgLicenseState.reason(org.getStatus()));
        }
    }

    /** {@code true} khi trung tâm đang ở chế độ chỉ đọc — cho DTO/UI, không ném lỗi. */
    @Transactional(readOnly = true)
    public boolean isOrgReadOnly(Long orgId) {
        return organizationRepository.findById(orgId)
                .map(org -> !licenceMode(org).writable())
                .orElse(false);
    }

    /**
     * Mức giấy phép của một trung tâm — MỘT chỗ duy nhất ghép ba mảnh
     * ({@code status}, {@code valid_until}, {@code suspended_at}) cho cả đường ném lẫn đường DTO.
     *
     * <p>Package-private để test chốt được mức THẬT chứ không chỉ "có ném hay không":
     * {@code READ_ONLY} và {@code CUT} đều chặn ghi, nên một bản vá lỡ quên truyền mốc neo sẽ đẩy
     * mọi trung tâm bị đình chỉ xuống thẳng {@code CUT} mà không ca hành vi nào nhìn thấy.
     */
    OrgLicenseState.Mode licenceMode(Organization org) {
        return OrgLicenseState.evaluate(org.getStatus(), org.getValidUntil(), org.getSuspendedAt(),
                Instant.now());
    }

    /**
     * {@link #assertOrgAdmin} + {@link #assertOrgWritable} — dùng cho các endpoint TẠO MỚI của
     * org-admin. Kiểm quyền TRƯỚC trạng thái: người ngoài trung tâm không được biết trung tâm đang
     * bị đình chỉ hay hết hạn.
     */
    @Transactional(readOnly = true)
    public void assertOrgAdminForWrite(Long userId, Long orgId) {
        assertOrgAdmin(userId, orgId);
        assertOrgWritable(orgId);
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
