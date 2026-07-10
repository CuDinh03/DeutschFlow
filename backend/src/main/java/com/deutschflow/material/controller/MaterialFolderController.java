package com.deutschflow.material.controller;

import com.deutschflow.material.dto.MaterialFolderDto;
import com.deutschflow.material.service.MaterialService;
import com.deutschflow.user.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * One-level folders for organizing teaching materials (Materials Library). CRUD lives in
 * {@link MaterialService} so it reuses the same ownership/authz helpers as materials. TEACHER/ADMIN only;
 * PERSONAL vs ORG access is enforced in the service by ACTIVE membership.
 */
@RestController
@RequestMapping("/api/v2/material-folders")
@RequiredArgsConstructor
@PreAuthorize("hasRole('TEACHER') or hasRole('ADMIN')")
public class MaterialFolderController {

    private final MaterialService materialService;

    /** PERSONAL of the caller ∪ ORG of the caller's org (ACTIVE only), ordered. */
    @GetMapping
    public List<MaterialFolderDto> list(@AuthenticationPrincipal User user) {
        return materialService.listFolders(user);
    }

    @PostMapping
    public MaterialFolderDto create(@AuthenticationPrincipal User user, @RequestBody FolderRequest req) {
        return materialService.createFolder(user, req.scope(), req.name(), req.orderIndex());
    }

    @PatchMapping("/{id}")
    public MaterialFolderDto rename(@AuthenticationPrincipal User user, @PathVariable Long id,
                                    @RequestBody FolderRequest req) {
        return materialService.renameFolder(user, id, req.name(), req.orderIndex());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@AuthenticationPrincipal User user, @PathVariable Long id) {
        materialService.deleteFolder(user, id);
        return ResponseEntity.noContent().build();
    }

    /** {@code scope} only used on create; {@code name}/{@code orderIndex} optional on rename. */
    public record FolderRequest(String scope, String name, Integer orderIndex) {}
}
