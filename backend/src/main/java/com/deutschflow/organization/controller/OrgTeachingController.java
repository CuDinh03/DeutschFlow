package com.deutschflow.organization.controller;

import com.deutschflow.common.exception.ForbiddenException;
import com.deutschflow.organization.service.OrgGuard;
import com.deutschflow.teacher.dto.ClassSessionDto;
import com.deutschflow.teacher.service.ClassScheduleService;
import com.deutschflow.user.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDateTime;
import java.util.List;

/**
 * G-3 — read-only teaching views for org admins (OWNER/MANAGER). Read-only by design: writes
 * (grading, lessons, schedule edits) stay TEACHER-only. orgId always comes from the principal;
 * every handler re-verifies org-admin membership in the DB (assertOrgAdmin). This does NOT relax
 * the {@code hasRole('TEACHER')} gate on {@code /api/v2/teacher/**} — it is a separate org-scoped
 * surface that reuses the teacher read services.
 */
@RestController
@RequestMapping("/api/org")
@RequiredArgsConstructor
@PreAuthorize("isAuthenticated()")
public class OrgTeachingController {

    private final OrgGuard orgGuard;
    private final ClassScheduleService classScheduleService;

    /** Center-wide weekly class schedule — every class session in the caller's org for [from, to]. */
    @GetMapping("/schedule/week")
    public List<ClassSessionDto> scheduleWeek(
            @AuthenticationPrincipal User user,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime to) {
        Long orgId = user.getOrgId();
        if (orgId == null) {
            throw new ForbiddenException("Bạn không thuộc tổ chức nào");
        }
        orgGuard.assertOrgAdmin(user.getId(), orgId);
        return classScheduleService.weekForOrg(orgId, from, to);
    }
}
