package com.deutschflow.organization.controller;

import com.deutschflow.organization.dto.FreeTeacherDto;
import com.deutschflow.organization.dto.OrgMemberDto;
import com.deutschflow.organization.service.AdminTeacherService;
import com.deutschflow.user.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Platform-admin teacher operations (ADMIN-only): the "free teacher" recruiting list and the
 * audited break-glass view of an org-affiliated teacher (B2B model §3/§6).
 */
@RestController
@RequestMapping("/api/admin/teachers")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AdminTeacherController {

    private final AdminTeacherService adminTeacherService;

    /** Free teachers (TEACHER with no ACTIVE org membership). */
    @GetMapping("/free")
    public List<FreeTeacherDto> listFreeTeachers() {
        return adminTeacherService.listFreeTeachers();
    }

    /** Break-glass view of an org-affiliated teacher — every call is audit-logged. */
    @GetMapping("/{userId}/break-glass")
    public OrgMemberDto breakGlass(@PathVariable Long userId,
                                   @RequestParam Long orgId,
                                   @AuthenticationPrincipal User admin) {
        return adminTeacherService.breakGlassViewTeacher(orgId, userId, admin);
    }
}
