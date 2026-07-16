package com.deutschflow.user.controller;

import com.deutschflow.teacher.dto.ClassLessonDto;
import com.deutschflow.teacher.dto.ClassroomDetailDto;
import com.deutschflow.teacher.dto.CurriculumModuleDto;
import com.deutschflow.teacher.dto.MyClassroomDto;
import com.deutschflow.teacher.dto.MySkillReportDto;
import com.deutschflow.teacher.dto.StudentAssignmentDto;
import com.deutschflow.teacher.dto.SetCompetencyRequest;
import com.deutschflow.teacher.dto.StudentAttendanceDto;
import com.deutschflow.teacher.dto.StudentCompetencyDto;
import com.deutschflow.teacher.dto.StudentSessionDto;
import com.deutschflow.teacher.service.ClassLessonService;
import com.deutschflow.teacher.service.CurriculumModuleService;
import com.deutschflow.teacher.service.StudentClassroomService;
import com.deutschflow.teacher.service.StudentCompetencyService;
import com.deutschflow.teacher.service.StudentEvaluationService;
import com.deutschflow.material.dto.MaterialDto;
import com.deutschflow.material.service.MaterialService;
import com.deutschflow.user.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
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
    private final CurriculumModuleService curriculumModuleService;
    private final StudentEvaluationService studentEvaluationService;
    private final StudentCompetencyService studentCompetencyService;
    private final MaterialService materialService;

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

    /** Curriculum modules of the class (for grouping the lesson list). */
    @GetMapping("/{classId}/modules")
    public ResponseEntity<List<CurriculumModuleDto>> listModules(
            @AuthenticationPrincipal User user,
            @PathVariable Long classId) {
        return ResponseEntity.ok(curriculumModuleService.listForStudent(user.getId(), classId));
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

    /** The class's session schedule for the enrolled student (P5). */
    @GetMapping("/{classId}/sessions")
    public ResponseEntity<List<StudentSessionDto>> listSessions(
            @AuthenticationPrincipal User user,
            @PathVariable Long classId) {
        return ResponseEntity.ok(studentClassroomService.listSessions(user.getId(), classId));
    }

    /** The student's OWN competency (Selbstevaluation) statuses for this class's can-dos (Phase 2a). */
    @GetMapping("/{classId}/competency")
    public ResponseEntity<List<StudentCompetencyDto>> getCompetency(
            @AuthenticationPrincipal User user,
            @PathVariable Long classId) {
        return ResponseEntity.ok(studentCompetencyService.getForClass(user.getId(), classId));
    }

    /**
     * Materials the teacher attached to a lesson, for the enrolled student. This is what actually
     * delivers a teacher's material to the class: attaching used to be a teacher-only shelf because no
     * student endpoint could read it (the whole /api/v2/materials surface is TEACHER/ADMIN-gated).
     * Access is by ENROLLMENT in the lesson's class, not by owning the material.
     */
    @GetMapping("/lessons/{lessonId}/materials")
    public ResponseEntity<List<MaterialDto>> lessonMaterials(
            @AuthenticationPrincipal User user,
            @PathVariable Long lessonId) {
        return ResponseEntity.ok(materialService.listLessonMaterialsForStudent(user.getId(), lessonId));
    }

    /** A fresh resolvable URL for one lesson material (the presigned GET expires after ~1h). */
    @GetMapping("/lessons/{lessonId}/materials/{materialId}/url")
    public ResponseEntity<MaterialUrlResponse> lessonMaterialUrl(
            @AuthenticationPrincipal User user,
            @PathVariable Long lessonId,
            @PathVariable Long materialId) {
        return ResponseEntity.ok(new MaterialUrlResponse(
                materialService.refreshLessonMaterialUrlForStudent(user.getId(), lessonId, materialId)));
    }

    public record MaterialUrlResponse(String url) {}

    /** Upsert the student's self-assessment of one can-do of this class (Phase 2a). */
    @PutMapping("/{classId}/competency/{canDoStatementId}")
    public ResponseEntity<StudentCompetencyDto> setCompetency(
            @AuthenticationPrincipal User user,
            @PathVariable Long classId,
            @PathVariable Long canDoStatementId,
            @RequestBody SetCompetencyRequest req) {
        return ResponseEntity.ok(
                studentCompetencyService.setSelfAssessment(user.getId(), classId, canDoStatementId, req));
    }
}
