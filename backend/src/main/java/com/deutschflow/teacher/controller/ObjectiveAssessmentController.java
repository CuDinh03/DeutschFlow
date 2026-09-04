package com.deutschflow.teacher.controller;

import com.deutschflow.teacher.dto.ObjectiveAssessRequest;
import com.deutschflow.teacher.dto.ObjectiveMatrixDto;
import com.deutschflow.teacher.service.ObjectiveAssessmentService;
import com.deutschflow.user.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

/** Đánh giá học viên theo mục tiêu giáo trình (PR-9, spec §7 — AC12). */
@RestController
@RequestMapping("/api/v2/teacher/classes/{classId}")
@PreAuthorize("hasRole('TEACHER')")
@RequiredArgsConstructor
public class ObjectiveAssessmentController {

    private final ObjectiveAssessmentService assessmentService;

    @GetMapping("/objective-matrix")
    public ObjectiveMatrixDto matrix(@AuthenticationPrincipal User user, @PathVariable Long classId) {
        return assessmentService.matrix(user.getId(), classId);
    }

    @PostMapping("/objective-assessments")
    public ObjectiveMatrixDto assess(@AuthenticationPrincipal User user, @PathVariable Long classId,
                                     @RequestBody ObjectiveAssessRequest req) {
        return assessmentService.assess(user.getId(), classId, req);
    }
}
