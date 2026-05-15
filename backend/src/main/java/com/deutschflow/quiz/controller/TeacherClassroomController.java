package com.deutschflow.quiz.controller;

import com.deutschflow.quiz.service.TeacherClassroomService;
import com.deutschflow.user.entity.User;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/teacher/classes")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('TEACHER', 'ADMIN')")
public class TeacherClassroomController {
    private final TeacherClassroomService teacherClassroomService;

    @GetMapping
    public List<Map<String, Object>> list(@AuthenticationPrincipal User teacher) {
        return teacherClassroomService.listClasses(teacher.getId());
    }

    @PostMapping
    public Map<String, Object> create(@AuthenticationPrincipal User teacher, @Valid @RequestBody ClassroomRequest req) {
        return teacherClassroomService.createClass(teacher.getId(), req.name());
    }

    @GetMapping("/{classId}")
    public Map<String, Object> detail(@AuthenticationPrincipal User teacher, @PathVariable Long classId) {
        return teacherClassroomService.getClassDetail(teacher.getId(), classId);
    }

    @PutMapping("/{classId}")
    public Map<String, Object> update(@AuthenticationPrincipal User teacher, @PathVariable Long classId, @Valid @RequestBody ClassroomRequest req) {
        return teacherClassroomService.updateClass(teacher.getId(), classId, req.name());
    }

    @DeleteMapping("/{classId}")
    public void delete(@AuthenticationPrincipal User teacher, @PathVariable Long classId) {
        teacherClassroomService.deleteClass(teacher.getId(), classId);
    }

    @GetMapping("/{classId}/students")
    public List<Map<String, Object>> listStudents(@AuthenticationPrincipal User teacher, @PathVariable Long classId) {
        return teacherClassroomService.listStudents(teacher.getId(), classId);
    }

    @PostMapping("/{classId}/students")
    public void addStudent(
            @AuthenticationPrincipal User teacher,
            @PathVariable Long classId,
            @Valid @RequestBody StudentRequest req
    ) {
        teacherClassroomService.addStudent(teacher.getId(), classId, req.email());
    }

    @DeleteMapping("/{classId}/students/{studentId}")
    public void removeStudent(@AuthenticationPrincipal User teacher, @PathVariable Long classId, @PathVariable Long studentId) {
        teacherClassroomService.removeStudent(teacher.getId(), classId, studentId);
    }

    public record ClassroomRequest(@NotBlank(message = "name is required") String name) {}

    public record StudentRequest(@Email(message = "invalid email") @NotBlank(message = "email is required") String email) {}
}

