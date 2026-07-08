package com.deutschflow.teacher.controller;

import com.deutschflow.teacher.dto.CreateModuleRequest;
import com.deutschflow.teacher.dto.CurriculumModuleDto;
import com.deutschflow.teacher.dto.ReorderModulesRequest;
import com.deutschflow.teacher.dto.UpdateModuleRequest;
import com.deutschflow.teacher.service.CurriculumModuleService;
import com.deutschflow.user.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v2/teacher/classes/{classId}/modules")
@PreAuthorize("hasRole('TEACHER')")
@RequiredArgsConstructor
public class CurriculumModuleController {

    private final CurriculumModuleService moduleService;

    @GetMapping
    public ResponseEntity<List<CurriculumModuleDto>> list(
            @AuthenticationPrincipal User user,
            @PathVariable Long classId) {
        return ResponseEntity.ok(moduleService.listForTeacher(user.getId(), classId));
    }

    @PostMapping
    public ResponseEntity<CurriculumModuleDto> create(
            @AuthenticationPrincipal User user,
            @PathVariable Long classId,
            @RequestBody CreateModuleRequest req) {
        return ResponseEntity.ok(moduleService.create(user.getId(), classId, req));
    }

    @PatchMapping("/{moduleId}")
    public ResponseEntity<CurriculumModuleDto> update(
            @AuthenticationPrincipal User user,
            @PathVariable Long classId,
            @PathVariable Long moduleId,
            @RequestBody UpdateModuleRequest req) {
        return ResponseEntity.ok(moduleService.update(user.getId(), classId, moduleId, req));
    }

    @DeleteMapping("/{moduleId}")
    public ResponseEntity<Void> delete(
            @AuthenticationPrincipal User user,
            @PathVariable Long classId,
            @PathVariable Long moduleId) {
        moduleService.delete(user.getId(), classId, moduleId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/reorder")
    public ResponseEntity<List<CurriculumModuleDto>> reorder(
            @AuthenticationPrincipal User user,
            @PathVariable Long classId,
            @RequestBody ReorderModulesRequest req) {
        return ResponseEntity.ok(moduleService.reorder(user.getId(), classId, req));
    }
}
