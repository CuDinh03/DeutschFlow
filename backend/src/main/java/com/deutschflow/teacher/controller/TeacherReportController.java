package com.deutschflow.teacher.controller;

import com.deutschflow.teacher.dto.GradebookDto;
import com.deutschflow.teacher.service.TeacherReportService;
import com.deutschflow.user.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * Teacher reports over the live classroom schema. Served under /api/v2/teacher to match the
 * rest of the active teacher API (the legacy /api/teacher/reports + quiz package were removed).
 */
@RestController
@RequestMapping("/api/v2/teacher/reports")
@RequiredArgsConstructor
@PreAuthorize("hasRole('TEACHER')")
public class TeacherReportController {

    private final TeacherReportService teacherReportService;

    @GetMapping("/overview")
    public Map<String, Object> overview(@AuthenticationPrincipal User teacher) {
        return teacherReportService.overview(teacher.getId());
    }

    @GetMapping("/classes/{classId}")
    public Map<String, Object> classReport(@AuthenticationPrincipal User teacher, @PathVariable Long classId) {
        return teacherReportService.classReport(teacher.getId(), classId);
    }

    @GetMapping("/classes/{classId}/gradebook")
    public GradebookDto gradebook(@AuthenticationPrincipal User teacher, @PathVariable Long classId) {
        return teacherReportService.gradebook(teacher.getId(), classId);
    }
}
