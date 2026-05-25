package com.deutschflow.teacher.controller;

import com.deutschflow.common.quota.RequestContext;
import com.deutschflow.teacher.dto.*;
import com.deutschflow.teacher.service.TeacherService;
import com.deutschflow.gamification.service.XpService;
import com.deutschflow.gamification.dto.LeaderboardDto;
import com.deutschflow.user.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v2/teacher")
@PreAuthorize("hasRole('TEACHER')")
@RequiredArgsConstructor
public class TeacherController {

    private final TeacherService teacherService;
    private final XpService xpService;
    private final com.deutschflow.teacher.service.TeacherAnalyticsService analyticsService;
    private final com.deutschflow.teacher.service.TeacherAdvisoryService advisoryService;
    private final com.deutschflow.teacher.service.GradingService gradingService;
    private final com.deutschflow.teacher.repository.StudentAssignmentRepository assignmentRepository;
    private final com.deutschflow.teacher.repository.ClassStudentRepository classStudentRepository;

    @PostMapping("/classes")
    public ResponseEntity<TeacherClassDto> createClass(@AuthenticationPrincipal User user, @RequestBody Map<String, String> payload) {
        String name = payload.get("name");
        return ResponseEntity.ok(teacherService.createClass(user.getId(), name));
    }

    @GetMapping("/classes")
    public ResponseEntity<List<TeacherClassDto>> getClasses(@AuthenticationPrincipal User user) {
        return ResponseEntity.ok(teacherService.getClassesForTeacher(user.getId()));
    }

    @GetMapping("/classes/{classId}/students")
    public ResponseEntity<List<ClassStudentDto>> getClassStudents(@AuthenticationPrincipal User user, @PathVariable Long classId) {
        return ResponseEntity.ok(teacherService.getClassStudents(user.getId(), classId));
    }

    @GetMapping("/classes/{classId}/join-requests")
    public ResponseEntity<List<JoinRequestDto>> getPendingJoinRequests(@AuthenticationPrincipal User user, @PathVariable Long classId) {
        return ResponseEntity.ok(teacherService.getPendingJoinRequests(user.getId(), classId));
    }

    @PostMapping("/classes/{classId}/join-requests/{requestId}/approve")
    public ResponseEntity<Void> approveJoinRequest(@AuthenticationPrincipal User user, @PathVariable Long classId, @PathVariable Long requestId) {
        teacherService.approveJoinRequest(user.getId(), classId, requestId);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/classes/{classId}/join-requests/{requestId}/reject")
    public ResponseEntity<Void> rejectJoinRequest(@AuthenticationPrincipal User user, @PathVariable Long classId, @PathVariable Long requestId) {
        teacherService.rejectJoinRequest(user.getId(), classId, requestId);
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/classes/{classId}")
    public ResponseEntity<Void> deleteClass(@AuthenticationPrincipal User user, @PathVariable Long classId) {
        teacherService.deleteClass(user.getId(), classId);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/classes/{classId}/students")
    public ResponseEntity<Void> addStudentToClass(@AuthenticationPrincipal User user, @PathVariable Long classId, @RequestBody Map<String, String> payload) {
        String email = payload.get("email");
        teacherService.addStudentToClassByEmail(user.getId(), classId, email);
        return ResponseEntity.ok().build();
    }

    @GetMapping("/classes/{classId}/analytics")
    public ResponseEntity<ClassAnalyticsOverviewDto> getClassAnalytics(@AuthenticationPrincipal User user, @PathVariable Long classId) {
        return ResponseEntity.ok(teacherService.getClassAnalytics(user.getId(), classId));
    }

    @GetMapping("/classes/{classId}/leaderboard")
    public ResponseEntity<List<LeaderboardDto>> getClassLeaderboard(
            @AuthenticationPrincipal User user, 
            @PathVariable Long classId,
            @RequestParam(defaultValue = "ALL_TIME") String type) {
        // TeacherService could verify if the teacher owns the class here
        return ResponseEntity.ok(xpService.getClassLeaderboard(classId, type));
    }

    @GetMapping("/assignments/presigned-url")
    public ResponseEntity<Map<String, String>> getPresignedUrl(
            @AuthenticationPrincipal User user,
            @RequestParam String filename,
            @RequestParam String contentType) {
        
        String extension = "";
        if (filename != null && filename.contains(".")) {
            extension = filename.substring(filename.lastIndexOf("."));
        }
        
        String objectKey = String.format("teacher_materials/%d/%d%s", 
                user.getId(), System.currentTimeMillis(), extension);
                
        // Need to autowire S3StorageService
        String url = teacherService.generatePresignedUrl(objectKey, contentType);
        return ResponseEntity.ok(Map.of("url", url, "objectKey", objectKey));
    }

    @PostMapping("/classes/{classId}/assignments")
    public ResponseEntity<ClassAssignmentDto> createAssignment(@AuthenticationPrincipal User user,
                                                               @PathVariable Long classId,
                                                               @RequestBody CreateAssignmentRequest req) {
        return ResponseEntity.ok(teacherService.createAssignment(user.getId(), classId, req));
    }

    @GetMapping("/classes/{classId}/assignments")
    public ResponseEntity<List<ClassAssignmentDto>> getClassAssignments(@PathVariable Long classId) {
        // Teacher has access, but we should probably verify teacher owns class here as well, 
        // however, teacherService could handle it if we pass teacherId.
        return ResponseEntity.ok(teacherService.getClassAssignments(classId));
    }

    @GetMapping("/students/{studentId}/speaking-sessions")
    public ResponseEntity<List<TeacherSpeakingSessionDto>> getStudentSpeakingSessions(@AuthenticationPrincipal User user, @PathVariable Long studentId) {
        return ResponseEntity.ok(teacherService.getStudentSpeakingSessions(user.getId(), studentId));
    }

    @GetMapping("/students/{studentId}/assignments")
    public ResponseEntity<List<StudentAssignmentDto>> getStudentAssignments(@AuthenticationPrincipal User user, @PathVariable Long studentId) {
        return ResponseEntity.ok(teacherService.getStudentAssignments(user.getId(), studentId));
    }

    @PostMapping("/speaking-sessions/{sessionId}/evaluate")
    public ResponseEntity<TeacherSpeakingSessionDto> evaluateSpeakingSession(
            @AuthenticationPrincipal User user,
            @PathVariable Long sessionId,
            @RequestBody TeacherSessionEvaluationRequest req) {
        return ResponseEntity.ok(teacherService.evaluateSpeakingSession(user.getId(), sessionId, req));
    }

    @PostMapping("/assignments/{assignmentId}/evaluate")
    public ResponseEntity<StudentAssignmentDto> evaluateAssignment(
            @AuthenticationPrincipal User user,
            @PathVariable Long assignmentId,
            @RequestBody TeacherSessionEvaluationRequest req) {
        return ResponseEntity.ok(teacherService.evaluateAssignment(user.getId(), assignmentId, req));
    }

    @GetMapping("/classes/{classId}/students/{studentId}/comprehensive-report")
    public ResponseEntity<StudentPerformanceAnalyticsDto> getComprehensiveReport(
            @AuthenticationPrincipal User user,
            @PathVariable Long classId,
            @PathVariable Long studentId) {
        
        // Fetch metrics with real data
        StudentPerformanceAnalyticsDto analytics = analyticsService.getComprehensiveAnalytics(classId, studentId);
        
        // Generate AI Advisory Report with real context
        String advisoryReport = advisoryService.generateAdvisoryReport(analytics);
        analytics.setAiAdvisoryReport(advisoryReport);
        
        return ResponseEntity.ok(analytics);
    }

    /**
     * Dashboard summary: số bài tập chờ chấm và số yêu cầu vào lớp chờ duyệt
     * GET /api/v2/teacher/dashboard/summary
     */
    @GetMapping("/dashboard/summary")
    public ResponseEntity<Map<String, Long>> getDashboardSummary(@AuthenticationPrincipal User user) {
        // Lấy tất cả học sinh thuộc các lớp của giáo viên này
        List<TeacherClassDto> classes = teacherService.getClassesForTeacher(user.getId());

        long pendingReviewCount = classes.stream()
                .flatMap(cls -> {
                    try {
                        return teacherService.getClassStudents(user.getId(), cls.id()).stream();
                    } catch (Exception e) {
                        return java.util.stream.Stream.empty();
                    }
                })
                .mapToLong(student -> assignmentRepository.countPendingReview(student.studentId()))
                .sum();

        long pendingJoinRequests = classes.stream()
                .flatMap(cls -> {
                    try {
                        return teacherService.getPendingJoinRequests(user.getId(), cls.id()).stream();
                    } catch (Exception e) {
                        return java.util.stream.Stream.empty();
                    }
                })
                .count();

        return ResponseEntity.ok(Map.of(
                "pendingReviewCount", pendingReviewCount,
                "pendingJoinRequests", pendingJoinRequests
        ));
    }

    /**
     * POST /api/v2/teacher/assignments/{assignmentId}/ai-grade
     * Trigger AI chấm bài cho một StudentAssignment (bài viết/essay).
     * Chạy async — trả về ngay, kết quả cập nhật sau vài giây.
     */
    @PostMapping("/assignments/{assignmentId}/ai-grade")
    public ResponseEntity<Map<String, String>> triggerAiGradeForAssignment(
            @AuthenticationPrincipal User user,
            @PathVariable Long assignmentId) {

        com.deutschflow.teacher.entity.StudentAssignment sa = assignmentRepository.findById(assignmentId)
                .orElseThrow(() -> new com.deutschflow.common.exception.NotFoundException("Bài nộp không tồn tại"));

        boolean hasAccess = classStudentRepository.findByIdStudentId(sa.getStudentId()).stream()
                .anyMatch(cs -> {
                    try {
                        return teacherService.getClassesForTeacher(user.getId()).stream()
                                .anyMatch(cls -> cls.id().equals(cs.getId().getClassId()));
                    } catch (Exception e) {
                        return false;
                    }
                });

        if (!hasAccess) {
            return ResponseEntity.status(403).body(Map.of("error", "Bạn không có quyền chấm bài này"));
        }

        gradingService.aiGradeAssignment(assignmentId);
        return ResponseEntity.ok(Map.of("message", "AI đang chấm bài, vui lòng chờ vài giây"));
    }
}
