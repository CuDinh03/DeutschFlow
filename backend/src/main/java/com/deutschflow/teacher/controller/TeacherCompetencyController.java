package com.deutschflow.teacher.controller;

import com.deutschflow.teacher.dto.ClassCompetencyDto;
import com.deutschflow.teacher.service.StudentCompetencyService;
import com.deutschflow.user.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Teacher-facing competency overview (Phase 2c) — the read-side of the ledger: per-can-do mastery
 * across the class's enrolled students, for remediation targeting. Scoped to the teacher's own class.
 */
@RestController
@RequestMapping("/api/v2/teacher/classes/{classId}/competency")
@PreAuthorize("hasRole('TEACHER')")
@RequiredArgsConstructor
public class TeacherCompetencyController {

    private final StudentCompetencyService studentCompetencyService;

    @GetMapping
    public ClassCompetencyDto getClassCompetency(@AuthenticationPrincipal User teacher,
                                                 @PathVariable Long classId) {
        return studentCompetencyService.getClassCompetencyOverview(teacher.getId(), classId);
    }
}
