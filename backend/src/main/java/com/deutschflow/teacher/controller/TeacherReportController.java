package com.deutschflow.teacher.controller;

import com.deutschflow.teacher.dto.ClassSummaryDto;
import com.deutschflow.teacher.dto.ClassTrendDto;
import com.deutschflow.teacher.dto.GradebookDto;
import com.deutschflow.teacher.dto.SkillDistributionDto;
import com.deutschflow.teacher.service.TeacherReportService;
import com.deutschflow.user.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
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

    /** Per-class summary rows for every class the teacher owns, in one batched call (no N+1). */
    @GetMapping("/classes-summary")
    public List<ClassSummaryDto> classesSummary(@AuthenticationPrincipal User teacher) {
        return teacherReportService.classesSummary(teacher.getId());
    }

    /** Weekly average of confirmed grades per class, for the analytics trend chart. */
    @GetMapping("/trends")
    public ClassTrendDto trends(@AuthenticationPrincipal User teacher) {
        return teacherReportService.weeklyTrends(teacher.getId());
    }

    /** Cross-class 4-skill (0–10) distribution over the teacher's students. */
    @GetMapping("/skill-distribution")
    public SkillDistributionDto skillDistribution(@AuthenticationPrincipal User teacher) {
        return teacherReportService.skillDistribution(teacher.getId());
    }

    @GetMapping("/classes/{classId}/gradebook")
    public GradebookDto gradebook(@AuthenticationPrincipal User teacher, @PathVariable Long classId) {
        return teacherReportService.gradebook(teacher.getId(), classId);
    }
}
