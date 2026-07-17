package com.deutschflow.user.controller;

import com.deutschflow.teacher.service.TeacherService;
import com.deutschflow.teacher.dto.StudentAssignmentDto;
import com.deutschflow.user.entity.User;
import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.common.exception.ConflictException;
import com.deutschflow.common.exception.ForbiddenException;
import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.teacher.repository.StudentAssignmentRepository;
import com.deutschflow.teacher.repository.ClassAssignmentRepository;
import com.deutschflow.teacher.repository.ClassStudentRepository;
import com.deutschflow.teacher.entity.ClassAssignment;
import com.deutschflow.teacher.repository.StudentAssignmentRepository;
import com.deutschflow.teacher.entity.StudentAssignment;
import com.deutschflow.teacher.entity.AssignmentScenario;
import com.deutschflow.media.service.S3StorageService;
import lombok.RequiredArgsConstructor;
import lombok.Data;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.Set;

@RestController
@RequestMapping("/api/v2/students/assignments")
@PreAuthorize("hasRole('STUDENT')")
@RequiredArgsConstructor
public class StudentAssignmentController {

    private static final Set<String> ALLOWED_UPLOAD_TYPES = Set.of(
        "image/jpeg", "image/png", "image/gif", "image/webp",
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        // audio/mp4, audio/m4a, audio/x-m4a, audio/aac: native mobile recording formats
        // (expo-audio HIGH_QUALITY records .m4a/AAC on both iOS and Android).
        "audio/mpeg", "audio/mp3", "audio/wav", "audio/ogg", "audio/webm",
        "audio/mp4", "audio/m4a", "audio/x-m4a", "audio/aac",
        "video/mp4",
        "text/plain"
    );

    private final TeacherService teacherService;
    private final StudentAssignmentRepository studentAssignmentRepository;
    private final ClassAssignmentRepository classAssignmentRepository;
    private final ClassStudentRepository classStudentRepository;
    private final S3StorageService s3StorageService;
    private final com.deutschflow.material.service.MaterialService materialService;

    /**
     * The assignment the class handed out — resolved and access-checked by ENROLLMENT (the student must be
     * in the assignment's class), not by an existing StudentAssignment row. A late-joining student has no
     * row for assignments created before they arrived (see AssignmentBackfillService), so requiring one
     * here would block them from ever opening or submitting that work.
     */
    private ClassAssignment assertAssignmentAccessible(Long studentId, Long assignmentId) {
        ClassAssignment ca = classAssignmentRepository.findById(assignmentId)
                .orElseThrow(() -> new NotFoundException("Bài tập không tồn tại"));
        if (!classStudentRepository.existsByIdClassIdAndIdStudentId(ca.getClassId(), studentId)) {
            throw new ForbiddenException("Bạn không có quyền với bài tập này");
        }
        return ca;
    }

    /** The student's row for this assignment, lazily created (PENDING) on first write if it's missing. */
    private StudentAssignment getOrCreateRow(Long studentId, Long assignmentId) {
        return studentAssignmentRepository.findByStudentIdAndAssignmentId(studentId, assignmentId)
                .orElseGet(() -> {
                    assertAssignmentAccessible(studentId, assignmentId);
                    return studentAssignmentRepository.save(StudentAssignment.builder()
                            .assignmentId(assignmentId)
                            .studentId(studentId)
                            .status("PENDING")
                            .build());
                });
    }

    @GetMapping
    @Transactional(readOnly = true)
    public ResponseEntity<List<StudentAssignmentDto>> getMyAssignments(@AuthenticationPrincipal User user) {
        List<StudentAssignmentDto> assignments = studentAssignmentRepository.findByStudentIdOrderByCreatedAtDesc(user.getId())
                .stream()
                .map(a -> {
                    ClassAssignment ca = classAssignmentRepository.findById(a.getAssignmentId()).orElse(null);
                    return new StudentAssignmentDto(
                            a.getId(), a.getAssignmentId(), a.getStudentId(), a.getStatus(),
                            a.getScore(), a.getFeedback(), a.getSubmittedAt(), a.getCreatedAt(),
                            ca != null ? ca.getTopic() : "",
                            ca != null ? ca.getDescription() : "",
                            ca != null ? ca.getAssignmentType() : "GENERAL",
                            ca != null ? ca.getDueDate() : null,
                            a.getSubmissionContent(),
                            a.getSubmissionFileUrl(),
                            ca != null ? ca.getAttachmentUrl() : null,
                            ca != null ? ca.getReferenceId() : null
                    );
                })
                .toList();
        return ResponseEntity.ok(assignments);
    }

    @GetMapping("/presigned-url")
    public ResponseEntity<PresignedUrlResponse> getPresignedUrl(
            @AuthenticationPrincipal User user,
            @RequestParam Long assignmentId,
            @RequestParam String filename,
            @RequestParam String contentType) {

        String normalizedType = contentType != null ? contentType.toLowerCase().split(";")[0].trim() : "";
        if (!ALLOWED_UPLOAD_TYPES.contains(normalizedType)) {
            throw new BadRequestException("Loại file không được phép: " + contentType);
        }

        // Verify the student is enrolled in the assignment's class (a late-joiner may not have a row yet;
        // the row is created when they actually submit).
        assertAssignmentAccessible(user.getId(), assignmentId);

        String extension = "";
        if (filename != null && filename.contains(".")) {
            extension = filename.substring(filename.lastIndexOf("."));
        }

        String objectKey = String.format("assignments/%d/%d_%d%s",
                assignmentId, user.getId(), System.currentTimeMillis(), extension);

        String url = s3StorageService.generatePresignedUrl(objectKey, contentType);
        return ResponseEntity.ok(new PresignedUrlResponse(url, objectKey));
    }

    @PostMapping("/{assignmentId}/submit")
    @Transactional
    public ResponseEntity<StudentAssignmentDto> submitAssignment(
            @AuthenticationPrincipal User user, 
            @PathVariable Long assignmentId,
            @RequestBody SubmitRequest request) {
            
        // Late-joiners have no row for pre-join assignments — create it on first submit (with an
        // enrollment check) so the student isn't permanently blocked from handing the work in.
        StudentAssignment assignment = getOrCreateRow(user.getId(), assignmentId);

        if (!"PENDING".equals(assignment.getStatus())) {
            throw new ConflictException("Bài tập đã được nộp hoặc đã được chấm");
        }

        assignment.setStatus("SUBMITTED");
        assignment.setSubmittedAt(java.time.LocalDateTime.now());
        
        if (request.getSubmissionContent() != null && !request.getSubmissionContent().isBlank()) {
            assignment.setSubmissionContent(request.getSubmissionContent());
        }
        
        if (request.getSubmissionFileUrl() != null && !request.getSubmissionFileUrl().isBlank()) {
            assignment.setSubmissionFileUrl(request.getSubmissionFileUrl());
        }
        
        assignment = studentAssignmentRepository.save(assignment);
        ClassAssignment ca = classAssignmentRepository.findById(assignment.getAssignmentId()).orElse(null);

        // Tell the TEACHERS of the class. This used to be insertForUser(user, ...) — and `user` is the
        // @AuthenticationPrincipal of a STUDENT-only endpoint, so the notification went back to the
        // student who had just submitted, rendered with the teacher-facing copy ("📥 Bài cần xem — Có bài
        // cần xem từ {studentName}"). The teacher, meanwhile, was told nothing whatsoever.
        teacherService.notifyTeachersOfSubmission(
                assignment.getAssignmentId(), user.getId(), user.getDisplayName());

        return ResponseEntity.ok(new StudentAssignmentDto(
                assignment.getId(), assignment.getAssignmentId(), assignment.getStudentId(), assignment.getStatus(),
                assignment.getScore(), assignment.getFeedback(), assignment.getSubmittedAt(), assignment.getCreatedAt(),
                ca != null ? ca.getTopic() : "",
                ca != null ? ca.getDescription() : "",
                ca != null ? ca.getAssignmentType() : "GENERAL",
                ca != null ? ca.getDueDate() : null,
                assignment.getSubmissionContent(),
                assignment.getSubmissionFileUrl(),
                ca != null ? ca.getAttachmentUrl() : null,
                ca != null ? ca.getReferenceId() : null
        ));
    }

    @GetMapping("/{assignmentId}/scenario")
    public ResponseEntity<AssignmentScenario> getScenario(@PathVariable Long assignmentId,
                                                          @AuthenticationPrincipal User user) {
        // Lazily generates the scenario if a creation-time LLM failure left the assignment without one.
        // IDOR guard + SPEAKING_SCENARIO check live in the service; missing/forbidden → 404.
        try {
            return ResponseEntity.ok(teacherService.getOrCreateScenarioForStudent(assignmentId, user.getId()));
        } catch (NotFoundException e) {
            return ResponseEntity.notFound().build();
        }
    }
    
    /**
     * Materials the teacher attached to this assignment, for the student it was handed to. This is the
     * ONLY way a student reaches those materials (the whole /api/v2/materials surface is TEACHER/ADMIN-
     * gated). Access is by having been GIVEN the assignment, enforced server-side.
     */
    @GetMapping("/{assignmentId}/materials")
    public ResponseEntity<List<com.deutschflow.material.dto.MaterialDto>> assignmentMaterials(
            @AuthenticationPrincipal User user,
            @PathVariable Long assignmentId) {
        return ResponseEntity.ok(materialService.listAssignmentMaterialsForStudent(user.getId(), assignmentId));
    }

    /** A fresh resolvable URL for one assignment material (the presigned GET expires after ~1h). */
    @GetMapping("/{assignmentId}/materials/{materialId}/url")
    public ResponseEntity<MaterialUrlResponse> assignmentMaterialUrl(
            @AuthenticationPrincipal User user,
            @PathVariable Long assignmentId,
            @PathVariable Long materialId) {
        return ResponseEntity.ok(new MaterialUrlResponse(
                materialService.refreshAssignmentMaterialUrlForStudent(user.getId(), assignmentId, materialId)));
    }

    public record MaterialUrlResponse(String url) {}

    @Data
    public static class PresignedUrlResponse {
        private final String url;
        private final String objectKey;
    }
    
    @Data
    public static class SubmitRequest {
        private String submissionContent;
        private String submissionFileUrl;
    }
}
