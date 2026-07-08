package com.deutschflow.material.controller;

import com.deutschflow.material.dto.MaterialDto;
import com.deutschflow.material.service.MaterialService;
import com.deutschflow.user.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

/**
 * Persisted teaching materials (B2B model §5/§6). Distinct from {@code TeacherMaterialController}
 * (which only generates a throwaway PPTX). TEACHER/ADMIN only; ORG vs PERSONAL access is enforced
 * in {@link MaterialService} by ACTIVE membership.
 */
@RestController
@RequestMapping("/api/v2/materials")
@RequiredArgsConstructor
@PreAuthorize("hasRole('TEACHER') or hasRole('ADMIN')")
public class MaterialController {

    private final MaterialService materialService;

    /** Create a PERSONAL or ORG material from an uploaded file (multipart). */
    @PostMapping(consumes = "multipart/form-data")
    public MaterialDto create(@AuthenticationPrincipal User user,
                              @RequestParam("file") MultipartFile file,
                              @RequestParam("title") String title,
                              @RequestParam(value = "description", required = false) String description,
                              @RequestParam(value = "scope", defaultValue = "PERSONAL") String scope) {
        return materialService.create(user, scope, file, title, description);
    }

    /** PERSONAL of the caller ∪ ORG of the caller's org (ACTIVE only). */
    @GetMapping
    public List<MaterialDto> list(@AuthenticationPrincipal User user) {
        return materialService.list(user);
    }

    @GetMapping("/{id}")
    public MaterialDto get(@AuthenticationPrincipal User user, @PathVariable Long id) {
        return materialService.get(user, id);
    }

    @PostMapping("/{id}/archive")
    public MaterialDto archive(@AuthenticationPrincipal User user, @PathVariable Long id) {
        return materialService.archive(user, id);
    }

    /** Materials attached to a class (caller must teach it or org-admin the class's org). */
    @GetMapping("/class/{classId}")
    public List<MaterialDto> listForClass(@AuthenticationPrincipal User user, @PathVariable Long classId) {
        return materialService.listForClass(user, classId);
    }

    @PostMapping("/{id}/classes/{classId}")
    public ResponseEntity<Void> attach(@AuthenticationPrincipal User user,
                                       @PathVariable Long id, @PathVariable Long classId) {
        materialService.attachToClass(user, id, classId);
        return ResponseEntity.noContent().build();
    }

    /** Materials attached to a lesson, in order (Phase 1d-D2). */
    @GetMapping("/lesson/{lessonId}")
    public List<MaterialDto> listForLesson(@AuthenticationPrincipal User user, @PathVariable Long lessonId) {
        return materialService.listForLesson(user, lessonId);
    }

    @PostMapping("/{id}/lessons/{lessonId}")
    public ResponseEntity<Void> attachToLesson(@AuthenticationPrincipal User user,
                                               @PathVariable Long id, @PathVariable Long lessonId) {
        materialService.attachToLesson(user, id, lessonId);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{id}/lessons/{lessonId}")
    public ResponseEntity<Void> detachFromLesson(@AuthenticationPrincipal User user,
                                                 @PathVariable Long id, @PathVariable Long lessonId) {
        materialService.detachFromLesson(user, id, lessonId);
        return ResponseEntity.noContent().build();
    }
}
