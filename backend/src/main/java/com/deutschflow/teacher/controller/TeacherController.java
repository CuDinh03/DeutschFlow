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
        
        // Fetch metrics
        StudentPerformanceAnalyticsDto analytics = analyticsService.getComprehensiveAnalytics(classId, studentId);
        
        // Generate AI Advisory Report
        String advisoryReport = advisoryService.generateAdvisoryReport(analytics);
        analytics.setAiAdvisoryReport(advisoryReport);
        
        return ResponseEntity.ok(analytics);
    }
}
