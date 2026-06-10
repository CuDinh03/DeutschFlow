package com.deutschflow.organization.controller;

import com.deutschflow.common.exception.ForbiddenException;
import com.deutschflow.organization.dto.InviteTeacherRequest;
import com.deutschflow.organization.dto.OrgClassDto;
import com.deutschflow.organization.dto.OrgInvitationDto;
import com.deutschflow.organization.dto.OrgMemberDto;
import com.deutschflow.organization.dto.OrgSummaryDto;
import com.deutschflow.organization.service.OrgGuard;
import com.deutschflow.organization.service.OrgInvitationService;
import com.deutschflow.organization.service.OrgMembershipService;
import com.deutschflow.organization.service.OrgService;
import com.deutschflow.user.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

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
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/classes")
    public Page<OrgClassDto> listClasses(@AuthenticationPrincipal User user, Pageable pageable) {
        Long orgId = requireOrgId(user);
        orgGuard.assertOrgAdmin(user.getId(), orgId);
        return orgService.listClasses(orgId, pageable);
    }
}
