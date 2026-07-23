package com.deutschflow.organization.controller;

import com.deutschflow.common.exception.ForbiddenException;
import com.deutschflow.organization.service.OrgGuard;
import com.deutschflow.teacher.dto.ClassLessonLogDto;
import com.deutschflow.teacher.dto.ClassSessionDto;
import com.deutschflow.teacher.dto.ClassStudentDto;
import com.deutschflow.teacher.dto.GradebookDto;
import com.deutschflow.teacher.dto.TeacherClassDto;
import com.deutschflow.teacher.service.ClassScheduleService;
import com.deutschflow.teacher.service.LessonLogService;
import com.deutschflow.teacher.service.TeacherReportService;
import com.deutschflow.teacher.service.TeacherService;
import com.deutschflow.user.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
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
    private final TeacherService teacherService;
    private final TeacherReportService teacherReportService;
    private final LessonLogService lessonLogService;

    /** Center-wide weekly class schedule — every class session in the caller's org for [from, to]. */
    @GetMapping("/schedule/week")
    public List<ClassSessionDto> scheduleWeek(
            @AuthenticationPrincipal User user,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime to) {
        return classScheduleService.weekForOrg(requireOrgAdmin(user), from, to);
    }

    /** M-17: danh sách học viên của một lớp trong org (roster). */
    @GetMapping("/classes/{classId}/roster")
    public List<ClassStudentDto> roster(@AuthenticationPrincipal User user, @PathVariable Long classId) {
        return teacherService.getClassStudentsForOrg(requireOrgAdmin(user), classId);
    }

    /** M-17: sổ điểm của một lớp trong org — cùng DTO với màn teacher tc-reports. */
    @GetMapping("/classes/{classId}/gradebook")
    public GradebookDto gradebook(@AuthenticationPrincipal User user, @PathVariable Long classId) {
        return teacherReportService.gradebookForOrg(requireOrgAdmin(user), classId);
    }

    /** M-17: nhật ký buổi dạy + điểm danh của một lớp trong org. */
    @GetMapping("/classes/{classId}/lesson-logs")
    public List<ClassLessonLogDto> lessonLogs(@AuthenticationPrincipal User user, @PathVariable Long classId) {
        return lessonLogService.getLogsForOrg(requireOrgAdmin(user), classId);
    }

    /** M-17: các lớp trong org của một giáo viên (lớp ngoài org lặng lẽ vắng mặt). */
    @GetMapping("/teachers/{teacherId}/classes")
    public List<TeacherClassDto> teacherClasses(@AuthenticationPrincipal User user, @PathVariable Long teacherId) {
        return teacherService.getClassesForTeacherInOrg(requireOrgAdmin(user), teacherId);
    }

    /** orgId từ principal + re-verify org-admin membership trong DB — dùng chung cho mọi handler. */
    private Long requireOrgAdmin(User user) {
        Long orgId = user.getOrgId();
        if (orgId == null) {
            throw new ForbiddenException("Bạn không thuộc tổ chức nào");
        }
        orgGuard.assertOrgAdmin(user.getId(), orgId);
        return orgId;
    }
}
