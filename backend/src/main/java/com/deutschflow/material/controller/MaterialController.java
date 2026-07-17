package com.deutschflow.material.controller;

import com.deutschflow.material.dto.MaterialDto;
import com.deutschflow.material.dto.PresignUploadResponse;
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

    /** Create a PERSONAL or ORG material from an uploaded file (multipart, ≤25MB). */
    @PostMapping(consumes = "multipart/form-data")
    public MaterialDto create(@AuthenticationPrincipal User user,
                              @RequestParam("file") MultipartFile file,
                              @RequestParam("title") String title,
                              @RequestParam(value = "description", required = false) String description,
                              @RequestParam(value = "scope", defaultValue = "PERSONAL") String scope,
                              @RequestParam(value = "folderId", required = false) Long folderId,
                              @RequestParam(value = "tags", required = false) List<String> tags) {
        return materialService.create(user, scope, file, title, description, folderId, tags);
    }

    /** PERSONAL ∪ ORG (ACTIVE only), optionally filtered by query/kind/tag/folderId. */
    @GetMapping
    public List<MaterialDto> list(@AuthenticationPrincipal User user,
                                  @RequestParam(value = "query", required = false) String query,
                                  @RequestParam(value = "kind", required = false) String kind,
                                  @RequestParam(value = "tag", required = false) String tag,
                                  @RequestParam(value = "folderId", required = false) Long folderId) {
        return materialService.list(user, query, kind, tag, folderId);
    }

    @GetMapping("/{id}")
    public MaterialDto get(@AuthenticationPrincipal User user, @PathVariable Long id) {
        return materialService.get(user, id);
    }

    /** Create a kind=LINK material (external URL — allango/YouTube/Drive; no file hosted). */
    @PostMapping("/link")
    public MaterialDto createLink(@AuthenticationPrincipal User user, @RequestBody CreateLinkRequest req) {
        return materialService.createLink(user, req.scope(), req.url(), req.title(),
                req.description(), req.folderId(), req.tags());
    }

    /** Step 1 for files &gt;25MB: reserve an UPLOADING record + return a presigned PUT URL. */
    @PostMapping("/presign-upload")
    public PresignUploadResponse presignUpload(@AuthenticationPrincipal User user,
                                               @RequestBody PresignUploadRequest req) {
        return materialService.presignUpload(user, req.scope(), req.filename(), req.contentType(),
                req.sizeBytes(), req.title(), req.description(), req.folderId(), req.tags());
    }

    /** Step 2 for files &gt;25MB: verify the S3 object + real size, flip UPLOADING → ACTIVE. */
    @PostMapping("/{id}/complete")
    public MaterialDto complete(@AuthenticationPrincipal User user, @PathVariable Long id,
                                @RequestBody(required = false) CompleteRequest req) {
        return materialService.complete(user, id, req == null ? null : req.durationSeconds());
    }

    /** Fresh resolvable URL (re-signed presigned GET, or external link) when a previous URL expired. */
    @GetMapping("/{id}/url")
    public MaterialUrlResponse url(@AuthenticationPrincipal User user, @PathVariable Long id) {
        return new MaterialUrlResponse(materialService.refreshUrl(user, id));
    }

    /** Edit mutable metadata: title / tags / folder (folderId moves into a folder; clearFolder unfiles to root). */
    @PatchMapping("/{id}")
    public MaterialDto patch(@AuthenticationPrincipal User user, @PathVariable Long id,
                             @RequestBody PatchMaterialRequest req) {
        return materialService.patch(user, id, req.title(), req.tags(), req.folderId(), req.clearFolder());
    }

    /** Archived materials — the library's "Đã lưu trữ" filter, so archiving is discoverable + reversible. */
    @GetMapping("/archived")
    public List<MaterialDto> listArchived(@AuthenticationPrincipal User user) {
        return materialService.listArchived(user);
    }

    /** How many lessons/classes this material is attached to — read before archiving to warn the user. */
    @GetMapping("/{id}/attachments")
    public MaterialService.AttachmentCount attachments(@AuthenticationPrincipal User user, @PathVariable Long id) {
        return materialService.attachmentCount(user, id);
    }

    @PostMapping("/{id}/archive")
    public MaterialDto archive(@AuthenticationPrincipal User user, @PathVariable Long id) {
        return materialService.archive(user, id);
    }

    /** Restore an archived material (ARCHIVED → ACTIVE) — reappears in the lessons it was attached to. */
    @PostMapping("/{id}/unarchive")
    public MaterialDto unarchive(@AuthenticationPrincipal User user, @PathVariable Long id) {
        return materialService.unarchive(user, id);
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

    /** Materials attached to an assignment (caller must teach the assignment's class or org-admin it). */
    @GetMapping("/assignment/{assignmentId}")
    public List<MaterialDto> listForAssignment(@AuthenticationPrincipal User user, @PathVariable Long assignmentId) {
        return materialService.listForAssignment(user, assignmentId);
    }

    @PostMapping("/{id}/assignments/{assignmentId}")
    public ResponseEntity<Void> attachToAssignment(@AuthenticationPrincipal User user,
                                                   @PathVariable Long id, @PathVariable Long assignmentId) {
        materialService.attachToAssignment(user, id, assignmentId);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{id}/assignments/{assignmentId}")
    public ResponseEntity<Void> detachFromAssignment(@AuthenticationPrincipal User user,
                                                     @PathVariable Long id, @PathVariable Long assignmentId) {
        materialService.detachFromAssignment(user, id, assignmentId);
        return ResponseEntity.noContent().build();
    }

    // --------------------------------------------------------------- request/response bodies

    public record CreateLinkRequest(String scope, String url, String title, String description,
                                    Long folderId, List<String> tags) {}

    public record PresignUploadRequest(String scope, String filename, String contentType, Long sizeBytes,
                                       String title, String description, Long folderId, List<String> tags) {}

    public record CompleteRequest(Integer durationSeconds) {}

    /** {@code clearFolder=true} unfiles the material to root; otherwise a non-null {@code folderId} moves it. */
    public record PatchMaterialRequest(String title, List<String> tags, Long folderId, boolean clearFolder) {}

    public record MaterialUrlResponse(String url) {}
}
