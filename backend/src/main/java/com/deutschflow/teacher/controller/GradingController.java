package com.deutschflow.teacher.controller;

import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.teacher.dto.TeacherSessionEvaluationRequest;
import com.deutschflow.teacher.entity.StudentAssignment;
import com.deutschflow.teacher.repository.StudentAssignmentRepository;
import com.deutschflow.teacher.repository.ClassTeacherRepository;
import com.deutschflow.teacher.repository.ClassStudentRepository;
import com.deutschflow.teacher.service.GradingService;
import com.deutschflow.user.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v2/teacher/grading")
@PreAuthorize("hasRole('TEACHER')")
@RequiredArgsConstructor
public class GradingController {

    private final GradingService gradingService;
    private final StudentAssignmentRepository studentAssignmentRepository;
    private final ClassTeacherRepository classTeacherRepository;
    private final ClassStudentRepository classStudentRepository;

    /**
     * GET /api/v2/teacher/grading/queue
     * Lấy toàn bộ bài nộp cần chấm (status=SUBMITTED) thuộc các lớp của giáo viên.
     * Query params: classId (optional), type (optional)
     */
    @GetMapping("/queue")
    public ResponseEntity<List<Map<String, Object>>> getGradingQueue(
            @AuthenticationPrincipal User teacher,
            @RequestParam(required = false) Long classId,
            @RequestParam(required = false) String type) {
        return ResponseEntity.ok(gradingService.getGradingQueue(teacher.getId(), classId, type));
    }

    /**
     * GET /api/v2/teacher/grading/stats
     * Thống kê số bài chờ chấm / đã chấm theo lớp.
     */
    @GetMapping("/stats")
    public ResponseEntity<Map<String, Object>> getGradingStats(@AuthenticationPrincipal User teacher) {
        return ResponseEntity.ok(gradingService.getGradingStats(teacher.getId()));
    }

    /**
     * GET /api/v2/teacher/grading/classes/{classId}/assignments/{assignmentId}/submissions
     * Lấy danh sách submissions của một bài tập cụ thể (tất cả học viên trong lớp).
     */
    @GetMapping("/classes/{classId}/assignments/{assignmentId}/submissions")
    public ResponseEntity<List<Map<String, Object>>> getAssignmentSubmissions(
            @AuthenticationPrincipal User teacher,
            @PathVariable Long classId,
            @PathVariable Long assignmentId) {
        return ResponseEntity.ok(gradingService.getAssignmentSubmissions(teacher.getId(), classId, assignmentId));
    }

    /**
     * POST /api/v2/teacher/grading/submissions/{submissionId}/ai-grade
     * Trigger AI chấm bài cho một bài nộp cụ thể.
     */
    @PostMapping("/submissions/{submissionId}/ai-grade")
    public ResponseEntity<Map<String, String>> triggerAiGrade(
            @AuthenticationPrincipal User teacher,
            @PathVariable Long submissionId) {

        StudentAssignment sa = studentAssignmentRepository.findById(submissionId)
                .orElseThrow(() -> new NotFoundException("Bài nộp không tồn tại"));

        // Verify teacher has access via class membership
        boolean hasAccess = classTeacherRepository.findByIdTeacherId(teacher.getId()).stream()
                .anyMatch(ct -> classStudentRepository.existsByIdClassIdAndIdStudentId(
                        ct.getId().getClassId(), sa.getStudentId()));

        if (!hasAccess) {
            return ResponseEntity.status(403).body(Map.of("error", "Bạn không có quyền chấm bài này"));
        }

        gradingService.aiGradeAssignment(submissionId, teacher.getId());
        return ResponseEntity.ok(Map.of("message", "AI đang chấm bài, vui lòng chờ vài giây"));
    }
}
