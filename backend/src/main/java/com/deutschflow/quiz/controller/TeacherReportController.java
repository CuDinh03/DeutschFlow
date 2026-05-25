package com.deutschflow.quiz.controller;

import com.deutschflow.quiz.service.TeacherReportService;
import com.deutschflow.user.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/teacher/reports")
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
}

