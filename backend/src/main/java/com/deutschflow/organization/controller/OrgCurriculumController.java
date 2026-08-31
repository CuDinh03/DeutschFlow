package com.deutschflow.organization.controller;

import com.deutschflow.common.exception.ForbiddenException;
import com.deutschflow.organization.dto.AssignCurriculumRequest;
import com.deutschflow.organization.dto.ClassCurriculumLinkDto;
import com.deutschflow.organization.dto.CreateCurriculumRequest;
import com.deutschflow.organization.dto.CreateVersionRequest;
import com.deutschflow.organization.dto.CurriculumAssignmentImpactDto;
import com.deutschflow.organization.dto.CurriculumItemDto;
import com.deutschflow.organization.dto.CurriculumLektionDto;
import com.deutschflow.organization.dto.CurriculumObjectiveDto;
import com.deutschflow.organization.dto.CurriculumVersionDetailDto;
import com.deutschflow.organization.dto.ImportCurriculumRequest;
import com.deutschflow.organization.dto.OrgCurriculumSummaryDto;
import com.deutschflow.organization.dto.ReorderLektionenRequest;
import com.deutschflow.organization.dto.ReplaceItemsRequest;
import com.deutschflow.organization.dto.ReplaceObjectivesRequest;
import com.deutschflow.organization.dto.UpdateCurriculumRequest;
import com.deutschflow.organization.dto.UpsertLektionRequest;
import com.deutschflow.organization.service.OrgCurriculumAssignmentService;
import com.deutschflow.organization.service.OrgCurriculumService;
import com.deutschflow.organization.service.OrgGuard;
import com.deutschflow.user.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Giáo trình trung tâm (PR-1, P03) — org-admin (OWNER/MANAGER) quản lý bộ giáo trình, phiên bản
 * DRAFT→PUBLISHED→ARCHIVED và gán phiên bản cho lớp. Giáo viên KHÔNG có quyền trên surface này
 * (AC01 — ranh giới giáo trình bất biến); orgId luôn lấy từ principal + re-verify DB như
 * {@link OrgTeachingController}.
 */
@RestController
@RequestMapping("/api/org")
@RequiredArgsConstructor
@PreAuthorize("isAuthenticated()")
public class OrgCurriculumController {

    private final OrgGuard orgGuard;
    private final OrgCurriculumService curriculumService;
    private final OrgCurriculumAssignmentService assignmentService;

    // ── Bộ giáo trình ────────────────────────────────────────────────────────

    @GetMapping("/curricula")
    public List<OrgCurriculumSummaryDto> list(@AuthenticationPrincipal User user) {
        return curriculumService.listForOrg(requireOrgAdmin(user));
    }

    @PostMapping("/curricula")
    public OrgCurriculumSummaryDto create(@AuthenticationPrincipal User user,
                                          @RequestBody CreateCurriculumRequest req) {
        return curriculumService.create(user.getId(), requireOrgAdmin(user), req);
    }

    /** Nhập bộ giáo trình thật thành bản nháp (P03): nhập → kiểm tra → công bố → gán lớp. */
    @PostMapping("/curricula/import")
    public OrgCurriculumSummaryDto importDraft(@AuthenticationPrincipal User user,
                                               @RequestBody ImportCurriculumRequest req) {
        return curriculumService.importDraft(user.getId(), requireOrgAdmin(user), req);
    }

    /** Bộ mẫu A1 tự soạn (is_sample=true) — chỉ để chạy thử luồng vận hành. */
    @PostMapping("/curricula/sample")
    public OrgCurriculumSummaryDto createSample(@AuthenticationPrincipal User user) {
        return curriculumService.createSampleA1(user.getId(), requireOrgAdmin(user));
    }

    @PatchMapping("/curricula/{curriculumId}")
    public ResponseEntity<Void> updateMeta(@AuthenticationPrincipal User user,
                                           @PathVariable Long curriculumId,
                                           @RequestBody UpdateCurriculumRequest req) {
        curriculumService.updateMeta(requireOrgAdmin(user), curriculumId, req);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/curricula/{curriculumId}")
    public ResponseEntity<Void> delete(@AuthenticationPrincipal User user,
                                       @PathVariable Long curriculumId) {
        curriculumService.delete(requireOrgAdmin(user), curriculumId);
        return ResponseEntity.noContent().build();
    }

    // ── Phiên bản ────────────────────────────────────────────────────────────

    @PostMapping("/curricula/{curriculumId}/versions")
    public CurriculumVersionDetailDto createVersion(@AuthenticationPrincipal User user,
                                                    @PathVariable Long curriculumId,
                                                    @RequestBody(required = false) CreateVersionRequest req) {
        return curriculumService.createVersion(requireOrgAdmin(user), curriculumId, req);
    }

    @GetMapping("/curriculum-versions/{versionId}")
    public CurriculumVersionDetailDto versionDetail(@AuthenticationPrincipal User user,
                                                    @PathVariable Long versionId) {
        return curriculumService.getVersionDetail(requireOrgAdmin(user), versionId);
    }

    @PostMapping("/curriculum-versions/{versionId}/publish")
    public ResponseEntity<Void> publish(@AuthenticationPrincipal User user, @PathVariable Long versionId) {
        curriculumService.publish(user.getId(), requireOrgAdmin(user), versionId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/curriculum-versions/{versionId}/archive")
    public ResponseEntity<Void> archive(@AuthenticationPrincipal User user, @PathVariable Long versionId) {
        curriculumService.archive(requireOrgAdmin(user), versionId);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/curriculum-versions/{versionId}")
    public ResponseEntity<Void> deleteVersion(@AuthenticationPrincipal User user, @PathVariable Long versionId) {
        curriculumService.deleteVersion(requireOrgAdmin(user), versionId);
        return ResponseEntity.noContent().build();
    }

    // ── Lektion (bản DRAFT) ──────────────────────────────────────────────────

    @PostMapping("/curriculum-versions/{versionId}/lektionen")
    public CurriculumLektionDto addLektion(@AuthenticationPrincipal User user,
                                           @PathVariable Long versionId,
                                           @RequestBody UpsertLektionRequest req) {
        return curriculumService.addLektion(requireOrgAdmin(user), versionId, req);
    }

    @PostMapping("/curriculum-versions/{versionId}/lektionen/reorder")
    public List<CurriculumLektionDto> reorderLektionen(@AuthenticationPrincipal User user,
                                                       @PathVariable Long versionId,
                                                       @RequestBody ReorderLektionenRequest req) {
        return curriculumService.reorderLektionen(requireOrgAdmin(user), versionId, req);
    }

    @PatchMapping("/curriculum-lektionen/{lektionId}")
    public CurriculumLektionDto updateLektion(@AuthenticationPrincipal User user,
                                              @PathVariable Long lektionId,
                                              @RequestBody UpsertLektionRequest req) {
        return curriculumService.updateLektion(requireOrgAdmin(user), lektionId, req);
    }

    @DeleteMapping("/curriculum-lektionen/{lektionId}")
    public ResponseEntity<Void> deleteLektion(@AuthenticationPrincipal User user,
                                              @PathVariable Long lektionId) {
        curriculumService.deleteLektion(requireOrgAdmin(user), lektionId);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/curriculum-lektionen/{lektionId}/items")
    public List<CurriculumItemDto> replaceItems(@AuthenticationPrincipal User user,
                                                @PathVariable Long lektionId,
                                                @RequestBody ReplaceItemsRequest req) {
        return curriculumService.replaceItems(requireOrgAdmin(user), lektionId, req);
    }

    @PutMapping("/curriculum-lektionen/{lektionId}/objectives")
    public List<CurriculumObjectiveDto> replaceObjectives(@AuthenticationPrincipal User user,
                                                          @PathVariable Long lektionId,
                                                          @RequestBody ReplaceObjectivesRequest req) {
        return curriculumService.replaceObjectives(requireOrgAdmin(user), lektionId, req);
    }

    // ── Gán lớp ↔ phiên bản ──────────────────────────────────────────────────

    @GetMapping("/classes/{classId}/curriculum")
    public ResponseEntity<ClassCurriculumLinkDto> classLink(@AuthenticationPrincipal User user,
                                                            @PathVariable Long classId) {
        ClassCurriculumLinkDto link = assignmentService.getLink(requireOrgAdmin(user), classId);
        return link == null ? ResponseEntity.noContent().build() : ResponseEntity.ok(link);
    }

    /** Dữ liệu cho dialog xác nhận gán/đổi/gỡ (targetVersionId null = gỡ) — §2.11 plan. */
    @GetMapping("/classes/{classId}/curriculum/impact")
    public CurriculumAssignmentImpactDto impact(@AuthenticationPrincipal User user,
                                                @PathVariable Long classId,
                                                @RequestParam(required = false) Long versionId) {
        return assignmentService.impact(requireOrgAdmin(user), classId, versionId);
    }

    @PostMapping("/classes/{classId}/curriculum")
    public ClassCurriculumLinkDto assign(@AuthenticationPrincipal User user,
                                         @PathVariable Long classId,
                                         @RequestBody AssignCurriculumRequest req) {
        return assignmentService.assign(user.getId(), requireOrgAdmin(user), classId, req);
    }

    @DeleteMapping("/classes/{classId}/curriculum")
    public ResponseEntity<Void> unassign(@AuthenticationPrincipal User user, @PathVariable Long classId) {
        assignmentService.unassign(requireOrgAdmin(user), classId);
        return ResponseEntity.noContent().build();
    }

    /** orgId từ principal + re-verify org-admin membership trong DB — cùng khuôn OrgTeachingController. */
    private Long requireOrgAdmin(User user) {
        Long orgId = user.getOrgId();
        if (orgId == null) {
            throw new ForbiddenException("Bạn không thuộc tổ chức nào");
        }
        orgGuard.assertOrgAdmin(user.getId(), orgId);
        return orgId;
    }
}
