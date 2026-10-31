package com.deutschflow.organization.controller;

import com.deutschflow.common.audit.AuditActor;
import com.deutschflow.common.exception.ForbiddenException;
import com.deutschflow.organization.service.OrgGuard;
import com.deutschflow.organization.service.OrgLogoService;
import com.deutschflow.user.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

/**
 * Logo trung tâm (đợt 4A A+B+E). OWNER-only như cấu hình trung tâm; đổi logo là thao tác ghi nên trung
 * tâm chỉ-đọc bị chặn. Quyền kiểm TRƯỚC trạng thái: người ngoài không biết được trung tâm bị đình chỉ.
 */
@RestController
@RequestMapping("/api/org/logo")
@RequiredArgsConstructor
@PreAuthorize("isAuthenticated()")
public class OrgLogoController {

    public record LogoResponse(String logoUrl) {}

    private final OrgLogoService logoService;
    private final OrgGuard orgGuard;

    @GetMapping
    public LogoResponse get(@AuthenticationPrincipal User user) {
        Long orgId = requireOrgContext(user);
        orgGuard.assertOrgOwner(user.getId(), orgId);
        return new LogoResponse(logoService.currentViewUrl(orgId));
    }

    @PostMapping(consumes = "multipart/form-data")
    public LogoResponse upload(@AuthenticationPrincipal User user, @RequestParam("file") MultipartFile file) {
        Long orgId = requireOrgContext(user);
        orgGuard.assertOrgOwner(user.getId(), orgId);
        orgGuard.assertOrgWritable(orgId);
        return new LogoResponse(logoService.update(AuditActor.of(user), orgId, file));
    }

    @DeleteMapping
    public ResponseEntity<Void> remove(@AuthenticationPrincipal User user) {
        Long orgId = requireOrgContext(user);
        orgGuard.assertOrgOwner(user.getId(), orgId);
        orgGuard.assertOrgWritable(orgId);
        logoService.remove(AuditActor.of(user), orgId);
        return ResponseEntity.noContent().build();
    }

    private Long requireOrgContext(User user) {
        Long orgId = user.getOrgId();
        if (orgId == null) {
            throw new ForbiddenException("Bạn không thuộc tổ chức nào");
        }
        return orgId;
    }
}
