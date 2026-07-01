package com.deutschflow.user.controller;

import com.deutschflow.teacher.dto.ClassLessonDto;
import com.deutschflow.teacher.dto.ClassroomDetailDto;
import com.deutschflow.teacher.dto.MyClassroomDto;
import com.deutschflow.teacher.dto.MySkillReportDto;
import com.deutschflow.teacher.dto.StudentAssignmentDto;
import com.deutschflow.teacher.dto.StudentAttendanceDto;
import com.deutschflow.teacher.service.ClassLessonService;
import com.deutschflow.teacher.service.StudentClassroomService;
import com.deutschflow.teacher.service.StudentEvaluationService;
import com.deutschflow.user.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v2/students/classes")
@PreAuthorize("hasRole('STUDENT')")
@RequiredArgsConstructor
public class StudentClassroomController {

    private final StudentClassroomService studentClassroomService;
    private final ClassLessonService classLessonService;
    private final StudentEvaluationService studentEvaluationService;

    @GetMapping
    public ResponseEntity<List<MyClassroomDto>> listMyClasses(@AuthenticationPrincipal User user) {
        return ResponseEntity.ok(studentClassroomService.listMyClasses(user.getId()));
    }

    @GetMapping("/{classId}")
    public ResponseEntity<ClassroomDetailDto> getClassDetail(
            @AuthenticationPrincipal User user,
            @PathVariable Long classId) {
        return ResponseEntity.ok(studentClassroomService.getClassDetail(user.getId(), classId));
    }

    @GetMapping("/{classId}/assignments")
    public ResponseEntity<List<StudentAssignmentDto>> listAssignments(
            @AuthenticationPrincipal User user,
            @PathVariable Long classId) {
        return ResponseEntity.ok(studentClassroomService.listAssignments(user.getId(), classId));
    }

    @GetMapping("/{classId}/lessons")
    public ResponseEntity<List<ClassLessonDto>> listLessons(
            @AuthenticationPrincipal User user,
            @PathVariable Long classId) {
        return ResponseEntity.ok(classLessonService.listForStudent(user.getId(), classId));
    }

    /** The student's OWN attendance for the class (P4) — never other students'. */
    @GetMapping("/{classId}/my-attendance")
    public ResponseEntity<List<StudentAttendanceDto>> myAttendance(
            @AuthenticationPrincipal User user,
            @PathVariable Long classId) {
        return ResponseEntity.ok(studentEvaluationService.myAttendance(user.getId(), classId));
    }

    /** The student's OWN 4-skill report row (P4) — never the class list. */
    @GetMapping("/{classId}/my-skill-report")
    public ResponseEntity<MySkillReportDto> mySkillReport(
            @AuthenticationPrincipal User user,
            @PathVariable Long classId) {
        return ResponseEntity.ok(studentEvaluationService.mySkillReport(user.getId(), classId));
    }
}
