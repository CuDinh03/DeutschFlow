package com.deutschflow.user.controller;

import com.deutschflow.notification.NotificationType;
import com.deutschflow.notification.service.UserNotificationService;
import com.deutschflow.teacher.service.TeacherService;
import com.deutschflow.teacher.dto.StudentAssignmentDto;
import com.deutschflow.user.entity.User;
import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.common.exception.ConflictException;
import com.deutschflow.common.exception.ForbiddenException;
import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.teacher.repository.StudentAssignmentRepository;
import com.deutschflow.teacher.repository.ClassAssignmentRepository;
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

import java.util.LinkedHashMap;
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
        "audio/mpeg", "audio/mp3", "audio/wav", "audio/ogg", "audio/webm",
        "video/mp4",
        "text/plain"
    );

    private final TeacherService teacherService;
    private final StudentAssignmentRepository studentAssignmentRepository;
    private final ClassAssignmentRepository classAssignmentRepository;
    private final S3StorageService s3StorageService;
    private final UserNotificationService userNotificationService;

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

        // Verify the assignment belongs to this student
        studentAssignmentRepository.findByStudentIdAndAssignmentId(user.getId(), assignmentId)
                .orElseThrow(() -> new ForbiddenException("Bạn không có quyền upload cho bài tập này"));

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
            
        StudentAssignment assignment = studentAssignmentRepository.findByStudentIdAndAssignmentId(user.getId(), assignmentId)
                .orElseThrow(() -> new NotFoundException("Bài tập không tồn tại"));

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
        if (ca != null) {
            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("assignmentId", ca.getId());
            payload.put("classId", ca.getClassId());
            payload.put("className", ca.getTopic() != null ? ca.getTopic() : "");
            payload.put("topic", ca.getTopic() != null ? ca.getTopic() : "");
            payload.put("studentId", user.getId());
            payload.put("studentName", user.getDisplayName());
            payload.put("assignmentType", ca.getAssignmentType());
            payload.put("referenceId", ca.getReferenceId());
            userNotificationService.insertForUser(
                user,
                NotificationType.QUIZ_SUBMISSION_RECEIVED,
                payload
            );
        }
        
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
