package com.deutschflow.teacher.controller;

import com.deutschflow.teacher.dto.SkillReportDto;
import com.deutschflow.teacher.dto.StudentEvaluationDto;
import com.deutschflow.teacher.dto.StudentEvaluationRequest;
import com.deutschflow.teacher.service.StudentEvaluationService;
import com.deutschflow.user.entity.User;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v2/teacher")
@RequiredArgsConstructor
@PreAuthorize("hasRole('TEACHER')")
public class StudentEvaluationController {

    private final StudentEvaluationService evaluationService;

    /** Bảng điểm 4 kỹ năng của cả lớp */
    @GetMapping("/reports/classes/{classId}/skill-report")
    public SkillReportDto skillReport(@AuthenticationPrincipal User teacher,
                                       @PathVariable Long classId) {
        return evaluationService.skillReport(teacher.getId(), classId);
    }

    /** Danh sách phiếu đánh giá cả lớp */
    @GetMapping("/classes/{classId}/evaluations")
    public List<StudentEvaluationDto> allEvaluations(@AuthenticationPrincipal User teacher,
                                                      @PathVariable Long classId) {
        return evaluationService.getAllEvaluations(teacher.getId(), classId);
    }

    /** Phiếu đánh giá một học viên */
    @GetMapping("/classes/{classId}/evaluations/{studentId}")
    public StudentEvaluationDto getEvaluation(@AuthenticationPrincipal User teacher,
                                               @PathVariable Long classId,
                                               @PathVariable Long studentId) {
        return evaluationService.getEvaluation(teacher.getId(), classId, studentId);
    }

    /** Lưu/cập nhật phiếu đánh giá học viên */
    @PutMapping("/classes/{classId}/evaluations/{studentId}")
    public StudentEvaluationDto saveEvaluation(@AuthenticationPrincipal User teacher,
                                                @PathVariable Long classId,
                                                @PathVariable Long studentId,
                                                @Valid @RequestBody StudentEvaluationRequest req) {
        return evaluationService.saveEvaluation(teacher.getId(), classId, studentId, req);
    }
}
