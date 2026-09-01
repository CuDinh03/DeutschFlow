package com.deutschflow.teacher.controller;

import com.deutschflow.teacher.dto.ClassMilestoneDto;
import com.deutschflow.teacher.dto.UpsertMilestoneRequest;
import com.deutschflow.teacher.service.ClassMilestoneService;
import com.deutschflow.user.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/** Mốc của lớp (V295, PR-6) — thi chính thức + kết thúc khóa; dời ngày lớp giáo trình qua duyệt (P05). */
@RestController
@RequestMapping("/api/v2/teacher/classes/{classId}/milestones")
@PreAuthorize("hasRole('TEACHER')")
@RequiredArgsConstructor
public class ClassMilestoneController {

    private final ClassMilestoneService milestoneService;

    @GetMapping
    public List<ClassMilestoneDto> list(@AuthenticationPrincipal User user, @PathVariable Long classId) {
        return milestoneService.list(user.getId(), classId);
    }

    @PostMapping
    public ClassMilestoneDto create(@AuthenticationPrincipal User user, @PathVariable Long classId,
                                    @RequestBody UpsertMilestoneRequest req) {
        return milestoneService.create(user.getId(), classId, req);
    }

    @PatchMapping("/{milestoneId}")
    public ClassMilestoneDto update(@AuthenticationPrincipal User user, @PathVariable Long classId,
                                    @PathVariable Long milestoneId, @RequestBody UpsertMilestoneRequest req) {
        return milestoneService.update(user.getId(), classId, milestoneId, req);
    }

    @DeleteMapping("/{milestoneId}")
    public void delete(@AuthenticationPrincipal User user, @PathVariable Long classId,
                       @PathVariable Long milestoneId) {
        milestoneService.delete(user.getId(), classId, milestoneId);
    }
}
