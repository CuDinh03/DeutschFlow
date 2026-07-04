package com.deutschflow.organization.controller;

import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.common.exception.ForbiddenException;
import com.deutschflow.organization.dto.CreateTeacherRequest;
import com.deutschflow.organization.dto.InviteTeacherRequest;
import com.deutschflow.organization.dto.OrgAnalyticsDto;
import com.deutschflow.organization.dto.OrgClassDetailDto;
import com.deutschflow.organization.dto.OrgClassDto;
import com.deutschflow.organization.dto.OrgInvitationDto;
import com.deutschflow.organization.dto.OrgInvoiceDto;
import com.deutschflow.organization.dto.OrgMemberDto;
import com.deutschflow.organization.dto.OrgStudentDetailDto;
import com.deutschflow.organization.dto.OrgSummaryDto;
import com.deutschflow.organization.dto.RosterImportResultDto;
import com.deutschflow.organization.entity.OrgMember;
import com.deutschflow.organization.service.OrgAnalyticsService;
import com.deutschflow.organization.service.OrgBillingService;
import com.deutschflow.organization.service.OrgEntitlementService;
import com.deutschflow.organization.service.OrgGuard;
import com.deutschflow.organization.service.OrgInvitationService;
import com.deutschflow.organization.service.OrgMembershipService;
import com.deutschflow.organization.service.OrgRosterService;
import com.deutschflow.organization.service.OrgService;
import com.deutschflow.notification.service.UserNotificationService;
import com.deutschflow.user.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.nio.charset.StandardCharsets;
import java.util.List;

/**
 * "Org của tôi" — quản trị tổ chức cho org-admin (OWNER/ADMIN).
 * orgId luôn lấy từ principal (user.getOrgId()), không nhận từ client để tránh giả mạo org.
 * Authz verify trong DB qua OrgGuard (mirror assertTeacherOwnsClass), JWT chỉ phục vụ frontend.
 */
@RestController
@RequestMapping("/api/org")
@RequiredArgsConstructor
@PreAuthorize("isAuthenticated()")
public class OrgController {

    private final OrgGuard orgGuard;
    private final OrgService orgService;
    private final OrgInvitationService orgInvitationService;
    private final OrgMembershipService orgMembershipService;
    private final OrgRosterService orgRosterService;
    private final OrgAnalyticsService orgAnalyticsService;
    private final OrgEntitlementService orgEntitlementService;
    private final OrgBillingService orgBillingService;
    private final UserNotificationService userNotificationService;

    private Long requireOrgId(User user) {
        Long orgId = user.getOrgId();
        if (orgId == null) {
            throw new ForbiddenException("Bạn không thuộc tổ chức nào");
        }
        return orgId;
    }

    @GetMapping
    public OrgSummaryDto getSummary(@AuthenticationPrincipal User user) {
        Long orgId = requireOrgId(user);
        orgGuard.assertMember(user.getId(), orgId);
        return orgService.getSummary(orgId);
    }

    /** Seat usage (ghế = học viên ACTIVE) — any active member may read it for the dashboard. */
    @GetMapping("/seats")
    public com.deutschflow.organization.dto.OrgSeatUsageDto getSeats(@AuthenticationPrincipal User user) {
        Long orgId = requireOrgId(user);
        orgGuard.assertMember(user.getId(), orgId);
        return orgService.getSeatUsage(orgId);
    }

    @GetMapping("/members")
    public List<OrgMemberDto> listMembers(@AuthenticationPrincipal User user,
                                          @RequestParam(required = false) String role) {
        Long orgId = requireOrgId(user);
        orgGuard.assertOrgAdmin(user.getId(), orgId);
        return orgService.listMembers(orgId, role);
    }

    @PostMapping("/teachers/invite")
    public OrgInvitationDto inviteTeacher(@AuthenticationPrincipal User user,
                                          @RequestBody InviteTeacherRequest body) {
        Long orgId = requireOrgId(user);
        orgGuard.assertOrgAdmin(user.getId(), orgId);
        return orgInvitationService.inviteTeacher(user.getId(), orgId, body.email());
    }

    /**
     * Org-admin (OWNER/MANAGER) PRE-CREATE giáo viên trực tiếp (B2B model §2.1, Phase 1 NOW).
     * created_via = org-role người tạo (OWNER/MANAGER). MANAGER chỉ tạo TEACHER (endpoint chỉ sinh
     * TEACHER → không tạo được MANAGER). Danh tính portable: rời TT chỉ đóng membership, account sống.
     */
    @PostMapping("/teachers")
    public OrgMemberDto createTeacher(@AuthenticationPrincipal User user,
                                      @jakarta.validation.Valid @RequestBody CreateTeacherRequest body) {
        Long orgId = requireOrgId(user);
        OrgMember caller = orgGuard.assertMember(user.getId(), orgId);
        String callerRole = caller.getRole();
        if (!"OWNER".equals(callerRole) && !"MANAGER".equals(callerRole)) {
            throw new ForbiddenException("Chỉ chủ sở hữu hoặc quản lý mới tạo được giáo viên");
        }
        User.CreatedVia via = "OWNER".equals(callerRole) ? User.CreatedVia.OWNER : User.CreatedVia.MANAGER;
        OrgMemberDto created = orgInvitationService.preCreateTeacher(
                orgId, body.email(), body.displayName(), body.password(), via);
        // preCreateTeacher always creates a fresh user (rejects existing email), so this is a real new account.
        userNotificationService.onAccountProvisioned(
                created.userId(), created.email(), created.displayName(), via.name());
        return created;
    }

    @GetMapping("/invitations")
    public List<OrgInvitationDto> listPending(@AuthenticationPrincipal User user) {
        Long orgId = requireOrgId(user);
        orgGuard.assertOrgAdmin(user.getId(), orgId);
        return orgInvitationService.listPending(orgId);
    }

    @DeleteMapping("/invitations/{id}")
    public ResponseEntity<Void> revokeInvitation(@AuthenticationPrincipal User user,
                                                 @PathVariable Long id) {
        Long orgId = requireOrgId(user);
        orgGuard.assertOrgAdmin(user.getId(), orgId);
        orgInvitationService.revoke(orgId, id);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/members/{userId}")
    public ResponseEntity<Void> removeMember(@AuthenticationPrincipal User user,
                                             @PathVariable Long userId) {
        Long orgId = requireOrgId(user);
        orgGuard.assertOrgAdmin(user.getId(), orgId);
        orgMembershipService.removeMember(orgId, userId);
        // Removed student loses the org-granted plan; web/Apple subs are left untouched.
        orgEntitlementService.revokeStudent(userId);
        return ResponseEntity.noContent().build();
    }

    /**
     * Changes a staff member's org-role (MANAGER ↔ TEACHER). OWNER-only — the role of the OWNER
     * itself, and promotion to OWNER, are out of scope here (ownership transfer is separate).
     */
    @PatchMapping("/members/{userId}/role")
    public OrgMemberDto changeMemberRole(@AuthenticationPrincipal User user,
                                         @PathVariable Long userId,
                                         @jakarta.validation.Valid @RequestBody com.deutschflow.organization.dto.ChangeRoleRequest body) {
        Long orgId = requireOrgId(user);
        orgGuard.assertOrgOwner(user.getId(), orgId);
        return orgMembershipService.changeRole(orgId, userId, body.role());
    }

    /**
     * Transfers ownership of the org to another ACTIVE staff member ({@code userId}), demoting the
     * caller (the current OWNER) to MANAGER — atomically. OWNER-only. This is the in-tenant recovery
     * path: because the OWNER cannot be removed or self-leave, an owner must transfer ownership before
     * leaving, and the org therefore always keeps exactly one ACTIVE OWNER. orgId comes from the
     * principal, never the client.
     */
    @PostMapping("/members/{userId}/transfer-ownership")
    public OrgMemberDto transferOwnership(@AuthenticationPrincipal User user,
                                          @PathVariable Long userId) {
        Long orgId = requireOrgId(user);
        orgGuard.assertOrgOwner(user.getId(), orgId);
        return orgMembershipService.transferOwnership(orgId, user.getId(), userId);
    }

    /**
     * Self-leave: a TEACHER/MANAGER leaves their own org (membership → LEFT). The OWNER cannot
     * self-leave (must transfer ownership first). orgId comes from the principal, never the client.
     */
    @PostMapping("/membership/leave")
    public ResponseEntity<Void> leaveOrg(@AuthenticationPrincipal User user) {
        Long orgId = requireOrgId(user);
        orgMembershipService.selfLeave(orgId, user.getId());
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/classes")
    public Page<OrgClassDto> listClasses(@AuthenticationPrincipal User user, Pageable pageable) {
        Long orgId = requireOrgId(user);
        orgGuard.assertOrgAdmin(user.getId(), orgId);
        return orgService.listClasses(orgId, pageable);
    }

    /**
     * Org-admin (OWNER/MANAGER) tạo lớp cho trung tâm. Lớp được stamp org_id của người gọi và
     * gán giáo viên phụ trách (teacherId phải là TEACHER ACTIVE của chính org — verify trong service).
     */
    @PostMapping("/classes")
    public OrgClassDto createClass(@AuthenticationPrincipal User user,
                                   @jakarta.validation.Valid @RequestBody com.deutschflow.organization.dto.CreateClassRequest body) {
        Long orgId = requireOrgId(user);
        orgGuard.assertOrgAdmin(user.getId(), orgId);
        return orgService.createClass(orgId, body.name(), body.teacherId());
    }

    /** Chi tiết một lớp thuộc tổ chức (B1.1). 404 nếu lớp không thuộc org của người gọi. */
    @GetMapping("/classes/{id}")
    public OrgClassDetailDto getClassDetail(@AuthenticationPrincipal User user, @PathVariable Long id) {
        Long orgId = requireOrgId(user);
        orgGuard.assertOrgAdmin(user.getId(), orgId);
        return orgService.getClassDetail(orgId, id);
    }

    /**
     * Bulk import học viên từ file CSV (cột: email,displayName[,phone]).
     * classId tùy chọn — nếu có, mọi học viên import được enroll vào lớp đó.
     */
    @PostMapping(value = "/students/import", consumes = "multipart/form-data")
    public RosterImportResultDto importStudents(@AuthenticationPrincipal User user,
                                                @RequestParam("file") MultipartFile file,
                                                @RequestParam(value = "classId", required = false) Long classId) {
        Long orgId = requireOrgId(user);
        orgGuard.assertOrgAdmin(user.getId(), orgId);

        if (file == null || file.isEmpty()) {
            throw new BadRequestException("File CSV không được để trống");
        }
        String name = file.getOriginalFilename();
        if (name == null || !name.toLowerCase().endsWith(".csv")) {
            throw new BadRequestException("Chỉ chấp nhận file .csv");
        }

        String csvText;
        try {
            csvText = new String(file.getBytes(), StandardCharsets.UTF_8);
        } catch (java.io.IOException ex) {
            throw new BadRequestException("Không đọc được file CSV");
        }
        return orgRosterService.importStudents(orgId, csvText, classId);
    }

    @GetMapping("/students")
    public List<OrgMemberDto> listStudents(@AuthenticationPrincipal User user) {
        Long orgId = requireOrgId(user);
        orgGuard.assertOrgAdmin(user.getId(), orgId);
        return orgService.listMembers(orgId, "STUDENT");
    }

    /** Chi tiết một học viên thuộc tổ chức (B1.2). 404 nếu user không phải thành viên org của người gọi. */
    @GetMapping("/students/{id}")
    public OrgStudentDetailDto getStudentDetail(@AuthenticationPrincipal User user, @PathVariable Long id) {
        Long orgId = requireOrgId(user);
        orgGuard.assertOrgAdmin(user.getId(), orgId);
        return orgService.getStudentDetail(orgId, id);
    }

    @GetMapping("/analytics")
    public OrgAnalyticsDto getAnalytics(@AuthenticationPrincipal User user) {
        Long orgId = requireOrgId(user);
        orgGuard.assertOrgAdmin(user.getId(), orgId);
        return orgAnalyticsService.getAnalytics(orgId);
    }

    @GetMapping("/invoices")
    public List<OrgInvoiceDto> listInvoices(@AuthenticationPrincipal User user) {
        Long orgId = requireOrgId(user);
        orgGuard.assertOrgFinance(user.getId(), orgId);
        return orgBillingService.listInvoices(orgId);
    }

    @GetMapping("/payment-info")
    public com.deutschflow.organization.dto.PaymentInfoDto getPaymentInfo(@AuthenticationPrincipal User user) {
        Long orgId = requireOrgId(user);
        orgGuard.assertOrgFinance(user.getId(), orgId);
        return orgBillingService.getPaymentInfo();
    }
}
