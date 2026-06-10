package com.deutschflow.organization.controller;

import com.deutschflow.organization.dto.AcceptInviteRequest;
import com.deutschflow.organization.dto.InvitationPreviewDto;
import com.deutschflow.organization.service.OrgInvitationService;
import com.deutschflow.user.dto.AuthResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

/**
 * Accept-invite token-based — KHÔNG cần auth (SecurityConfig permit /api/public/**).
 * Token là "secret" của link mời. Preview để hiển thị org/role/email trước khi nhận.
 */
@RestController
@RequestMapping("/api/public/org-invitations")
@RequiredArgsConstructor
public class PublicOrgInvitationController {

    private final OrgInvitationService orgInvitationService;

    @GetMapping("/{token}")
    public InvitationPreviewDto preview(@PathVariable String token) {
        return orgInvitationService.preview(token);
    }

    @PostMapping("/{token}/accept")
    public AuthResponse accept(@PathVariable String token, @RequestBody AcceptInviteRequest body) {
        return orgInvitationService.accept(token, body);
    }
}
