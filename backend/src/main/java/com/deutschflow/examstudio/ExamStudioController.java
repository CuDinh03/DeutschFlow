package com.deutschflow.examstudio;

import com.deutschflow.common.audit.AuditActor;
import com.deutschflow.common.audit.AuditLogService;
import com.deutschflow.examstudio.ExamStudioDtos.*;
import com.deutschflow.user.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * Xưởng đề (admin): tạo một Teil đề thi từ nguồn báo Đức, AI viết bài và ra câu hỏi theo ma trận độ khó
 * 4 bậc, owner duyệt rồi Teil vào kho. Hợp đồng: {@code frontend/src/lib/adminExamStudioApi.ts}.
 */
@RestController
@RequestMapping("/api/admin/exam-studio")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class ExamStudioController {

    private final ExamDraftService service;
    private final AuditLogService audit;

    @GetMapping("/drafts")
    public List<DraftSummary> list(@RequestParam(required = false) String status) {
        return service.list(status);
    }

    @PostMapping("/drafts")
    public Draft create(@RequestBody CreateDraftRequest req, @AuthenticationPrincipal User actor) {
        Draft d = service.create(req, actor.getId());
        log("admin.exam_studio.draft_created", actor, d.id());
        return d;
    }

    @GetMapping("/drafts/{id}")
    public Draft get(@PathVariable long id) {
        return service.get(id);
    }

    @PatchMapping("/drafts/{id}")
    public Draft patch(@PathVariable long id, @RequestBody PatchDraftRequest req) {
        return service.patch(id, req);
    }

    @DeleteMapping("/drafts/{id}")
    public ResponseEntity<Void> discard(@PathVariable long id, @AuthenticationPrincipal User actor) {
        service.discard(id);
        log("admin.exam_studio.draft_discarded", actor, id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/drafts/{id}/sources")
    public Draft addSource(@PathVariable long id, @RequestBody AddSourceRequest req,
                           @AuthenticationPrincipal User actor) {
        return service.addSource(id, req, actor.getId());
    }

    @PatchMapping("/drafts/{id}/sources/{sourceId}")
    public Draft patchSource(@PathVariable long id, @PathVariable long sourceId, @RequestBody PatchSourceRequest req) {
        return service.patchSource(id, sourceId, req);
    }

    @DeleteMapping("/drafts/{id}/sources/{sourceId}")
    public Draft removeSource(@PathVariable long id, @PathVariable long sourceId) {
        return service.removeSource(id, sourceId);
    }

    @PostMapping("/drafts/{id}/text")
    public Draft writeText(@PathVariable long id, @RequestBody(required = false) WriteTextRequest req,
                           @AuthenticationPrincipal User actor) {
        return service.writeText(id, req, actor.getId());
    }

    @PostMapping("/drafts/{id}/items")
    public Draft generateItems(@PathVariable long id, @AuthenticationPrincipal User actor) {
        return service.generateItems(id, actor.getId());
    }

    @PostMapping("/drafts/{id}/items/{itemId}/regenerate")
    public Draft regenerateItem(@PathVariable long id, @PathVariable String itemId,
                                @RequestBody(required = false) RegenerateItemRequest req,
                                @AuthenticationPrincipal User actor) {
        return service.regenerateItem(id, itemId, req == null ? null : req.difficulty(), actor.getId());
    }

    @PostMapping("/drafts/{id}/verify")
    public Draft verify(@PathVariable long id, @AuthenticationPrincipal User actor) {
        return service.verify(id, actor.getId());
    }

    @PostMapping("/drafts/{id}/approve")
    public Draft approve(@PathVariable long id, @RequestBody ApproveRequest req, @AuthenticationPrincipal User actor) {
        Draft d = service.approve(id, req == null ? null : req.checklist(), actor.getId());
        audit.log("admin.exam_studio.block_approved", AuditActor.of(actor), "EXAM_TEIL_BLOCK",
                String.valueOf(d.blockId()), Map.of("draftId", id));
        return d;
    }

    @GetMapping("/blocks")
    public List<BlockSummary> blocks(@RequestParam(required = false) String cefrLevel,
                                     @RequestParam(required = false) String section,
                                     @RequestParam(required = false) Integer teil) {
        return service.listBlocks(cefrLevel, section, teil);
    }

    @GetMapping("/blocks/{id}")
    public BlockDetail block(@PathVariable long id) {
        return service.getBlock(id);
    }

    private void log(String event, User actor, long draftId) {
        audit.log(event, AuditActor.of(actor), "EXAM_DRAFT", String.valueOf(draftId), Map.of());
    }
}
