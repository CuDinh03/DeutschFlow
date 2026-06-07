package com.deutschflow.teacher.controller;

import com.deutschflow.teacher.dto.ClassLessonDto;
import com.deutschflow.teacher.dto.CreateLessonRequest;
import com.deutschflow.teacher.dto.ReorderLessonsRequest;
import com.deutschflow.teacher.dto.UpdateLessonRequest;
import com.deutschflow.teacher.service.ClassLessonService;
import com.deutschflow.user.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v2/teacher/classes/{classId}/lessons")
@PreAuthorize("hasRole('TEACHER')")
@RequiredArgsConstructor
public class ClassLessonController {

    private final ClassLessonService lessonService;

    @GetMapping
    public ResponseEntity<List<ClassLessonDto>> list(
            @AuthenticationPrincipal User user,
            @PathVariable Long classId) {
        return ResponseEntity.ok(lessonService.listForTeacher(user.getId(), classId));
    }

    @PostMapping
    public ResponseEntity<ClassLessonDto> create(
            @AuthenticationPrincipal User user,
            @PathVariable Long classId,
            @RequestBody CreateLessonRequest req) {
        return ResponseEntity.ok(lessonService.create(user.getId(), classId, req));
    }

    @PatchMapping("/{lessonId}")
    public ResponseEntity<ClassLessonDto> update(
            @AuthenticationPrincipal User user,
            @PathVariable Long classId,
            @PathVariable Long lessonId,
            @RequestBody UpdateLessonRequest req) {
        return ResponseEntity.ok(lessonService.update(user.getId(), classId, lessonId, req));
    }

    @DeleteMapping("/{lessonId}")
    public ResponseEntity<Void> delete(
            @AuthenticationPrincipal User user,
            @PathVariable Long classId,
            @PathVariable Long lessonId) {
        lessonService.delete(user.getId(), classId, lessonId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/reorder")
    public ResponseEntity<List<ClassLessonDto>> reorder(
            @AuthenticationPrincipal User user,
            @PathVariable Long classId,
            @RequestBody ReorderLessonsRequest req) {
        return ResponseEntity.ok(lessonService.reorder(user.getId(), classId, req));
    }
}
