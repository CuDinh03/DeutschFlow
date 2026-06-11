package com.deutschflow.organization.controller;

import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.common.exception.ForbiddenException;
import com.deutschflow.organization.dto.InviteTeacherRequest;
import com.deutschflow.organization.dto.OrgAnalyticsDto;
import com.deutschflow.organization.dto.OrgClassDto;
import com.deutschflow.organization.dto.OrgInvitationDto;
import com.deutschflow.organization.dto.OrgInvoiceDto;
import com.deutschflow.organization.dto.OrgMemberDto;
import com.deutschflow.organization.dto.OrgSummaryDto;
import com.deutschflow.organization.dto.RosterImportResultDto;
import com.deutschflow.organization.service.OrgAnalyticsService;
import com.deutschflow.organization.service.OrgBillingService;
import com.deutschflow.organization.service.OrgEntitlementService;
import com.deutschflow.organization.service.OrgGuard;
import com.deutschflow.organization.service.OrgInvitationService;
import com.deutschflow.organization.service.OrgMembershipService;
import com.deutschflow.organization.service.OrgRosterService;
import com.deutschflow.organization.service.OrgService;
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

    @GetMapping("/classes")
    public Page<OrgClassDto> listClasses(@AuthenticationPrincipal User user, Pageable pageable) {
        Long orgId = requireOrgId(user);
        orgGuard.assertOrgAdmin(user.getId(), orgId);
        return orgService.listClasses(orgId, pageable);
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

    @GetMapping("/analytics")
    public OrgAnalyticsDto getAnalytics(@AuthenticationPrincipal User user) {
        Long orgId = requireOrgId(user);
        orgGuard.assertOrgAdmin(user.getId(), orgId);
        return orgAnalyticsService.getAnalytics(orgId);
    }

    @GetMapping("/invoices")
    public List<OrgInvoiceDto> listInvoices(@AuthenticationPrincipal User user) {
        Long orgId = requireOrgId(user);
        orgGuard.assertOrgAdmin(user.getId(), orgId);
        return orgBillingService.listInvoices(orgId);
    }

    @GetMapping("/payment-info")
    public com.deutschflow.organization.dto.PaymentInfoDto getPaymentInfo(@AuthenticationPrincipal User user) {
        Long orgId = requireOrgId(user);
        orgGuard.assertOrgAdmin(user.getId(), orgId);
        return orgBillingService.getPaymentInfo();
    }
}
