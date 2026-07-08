package com.deutschflow.teacher.controller;

import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.organization.service.OrgPoolGuard;
import com.deutschflow.teacher.dto.GradeImageResponse;
import com.deutschflow.teacher.dto.TeacherSessionEvaluationRequest;
import com.deutschflow.teacher.entity.ClassAssignment;
import com.deutschflow.teacher.entity.StudentAssignment;
import com.deutschflow.teacher.repository.ClassAssignmentRepository;
import com.deutschflow.teacher.repository.StudentAssignmentRepository;
import com.deutschflow.teacher.repository.ClassTeacherRepository;
import com.deutschflow.teacher.service.GradingService;
import com.deutschflow.teacher.service.HandwritingOcrService;
import com.deutschflow.user.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v2/teacher/grading")
@PreAuthorize("hasRole('TEACHER')")
@RequiredArgsConstructor
public class GradingController {

    private final GradingService gradingService;
    private final StudentAssignmentRepository studentAssignmentRepository;
    private final ClassAssignmentRepository classAssignmentRepository;
    private final ClassTeacherRepository classTeacherRepository;
    private final HandwritingOcrService handwritingOcrService;
    private final OrgPoolGuard orgPoolGuard;
    private final com.deutschflow.common.quota.FreeTierGuard freeTierGuard;

    /**
     * Ước lượng token cho 1 lần AI chấm bài viết (essay + rubric vào, ~800 token feedback ra) —
     * dùng hard-cap pool token cấp-org trước khi khởi chạy job chấm async.
     */
    private static final long GRADING_ESTIMATED_TOKENS = 2_000L;

    private static final long MAX_IMAGE_SIZE = 10L * 1024 * 1024; // 10MB
    /** Ước lượng token chấm-ảnh (Gemini vision OCR + 70B chấm) — hard-cap pool token cấp-org. */
    private static final long IMAGE_GRADE_ESTIMATED_TOKENS = 10_000L;

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

        // Authorize on the assignment's OWNING class — not merely on sharing the student. A teacher may
        // only grade submissions that belong to a class they teach; otherwise a teacher who shares one
        // student with another class/org could grade that student's work in a foreign assignment (IDOR).
        ClassAssignment ca = classAssignmentRepository.findById(sa.getAssignmentId()).orElse(null);
        boolean hasAccess = ca != null
                && classTeacherRepository.existsByIdClassIdAndIdTeacherId(ca.getClassId(), teacher.getId());
        if (!hasAccess) {
            return ResponseEntity.status(403).body(Map.of("error", "Bạn không có quyền chấm bài này"));
        }

        // Reject a finalized/already-graded submission up front (the async job also guards, but a 409
        // gives the teacher immediate feedback instead of a silent no-op).
        String status = sa.getStatus();
        if (!"SUBMITTED".equals(status) && !"GRADING_FAILED".equals(status)) {
            return ResponseEntity.status(409).body(Map.of("error", "Bài này đã được chấm; không thể chấm lại bằng AI."));
        }

        // Hard-cap pool token cấp-org trước khi kích hoạt AI chấm (429 nếu org hết ngân sách).
        orgPoolGuard.assertOrgPoolAvailable(teacher.getId(), GRADING_ESTIMATED_TOKENS);

        gradingService.aiGradeAssignment(submissionId, teacher.getId());
        return ResponseEntity.ok(Map.of("message", "AI đang chấm bài, vui lòng chờ vài giây"));
    }

    /**
     * POST /api/v2/teacher/grading/grade-image  (multipart: file [, topic])
     * Chấm ảnh bài viết TAY (D2): ảnh → Gemini OCR → chấm bằng model chấm → trả chữ + điểm + nhận xét.
     * Đồng bộ (giáo viên chờ vài giây). Trả về transcription để GV rà lại trước khi chốt.
     */
    @PostMapping(value = "/grade-image", consumes = "multipart/form-data")
    public GradeImageResponse gradeImage(@AuthenticationPrincipal User teacher,
                                         @RequestParam("file") MultipartFile file,
                                         @RequestParam(value = "topic", required = false) String topic) {
        if (file == null || file.isEmpty()) {
            throw new BadRequestException("Chưa chọn ảnh bài viết.");
        }
        if (file.getSize() > MAX_IMAGE_SIZE) {
            throw new BadRequestException("Ảnh quá lớn. Tối đa 10MB.");
        }
        // Hard-cap pool token cấp-org (chấm-ảnh đắt: Gemini vision + 70B) — dùng chung OrgPoolGuard.
        // B2C/non-org/pool=0 luôn qua.
        orgPoolGuard.assertOrgPoolAvailable(teacher.getId(), IMAGE_GRADE_ESTIMATED_TOKENS);
        // Gói miễn phí (GV tự do, non-org): cap OCR-ảnh theo ngày (D6) — chấm text core vẫn không giới hạn.
        freeTierGuard.assertAndConsume(teacher.getId(), teacher.getOrgId(),
                com.deutschflow.common.quota.FreeTierGuard.FEATURE_OCR_GRADE);

        byte[] bytes;
        try {
            bytes = file.getBytes();
        } catch (java.io.IOException e) {
            throw new BadRequestException("Không đọc được ảnh.");
        }
        return handwritingOcrService.ocrAndGrade(bytes, file.getContentType(), topic, teacher.getId());
    }
}
