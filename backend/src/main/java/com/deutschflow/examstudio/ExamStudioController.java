package com.deutschflow.examstudio;

import com.deutschflow.common.audit.AuditActor;
import com.deutschflow.common.audit.AuditLogService;
import com.deutschflow.examstudio.ExamStudioDtos.*;
import com.deutschflow.user.entity.User;
import lombok.RequiredArgsConstructor;
import com.deutschflow.common.exception.BadRequestException;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
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
    private final ExamAssemblyService assembly;
    private final AuditLogService audit;
    private final ExamStudioAi ai;

    /** Hai kênh tạo đề và kênh nào đã cấu hình (không trả khoá hay địa chỉ). */
    @GetMapping("/channels")
    public List<ExamStudioAi.ChannelInfo> channels() {
        return ai.channels();
    }

    /** Chạy một thao tác AI trên kênh admin chọn ({@code channel} trống = Fireworks). */
    private Draft onChannel(String channel, java.util.function.Supplier<Draft> action) {
        ExamStudioAi.useChannel(ai.requireChannel(channel));
        try {
            return action.get();
        } finally {
            ExamStudioAi.clearChannel();
        }
    }

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

    /** Nhập một Teil soạn ngoài hệ thống (tệp JSON theo prompt mẫu). Bản nháp vẫn phải qua tự kiểm và duyệt. */
    @PostMapping(value = "/drafts/import", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public Draft importDraft(@RequestParam("file") MultipartFile file, @AuthenticationPrincipal User actor)
            throws IOException {
        if (file.getSize() > ExamDraftService.IMPORT_MAX_BYTES) throw new BadRequestException("Tệp lớn hơn 512 KB.");
        Draft d = service.importTeil(file.getBytes(), actor.getId());
        log("admin.exam_studio.draft_imported", actor, d.id());
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
                           @RequestParam(required = false) String channel, @AuthenticationPrincipal User actor) {
        return onChannel(channel, () -> service.addSource(id, req, actor.getId()));
    }

    /** Nguồn từ tệp (PDF, DOCX, TXT): máy bóc văn bản rồi rút dữ kiện như văn bản dán tay. Tệp không được lưu. */
    @PostMapping(value = "/drafts/{id}/sources/file", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public Draft addSourceFile(@PathVariable long id, @RequestParam("file") MultipartFile file,
                               @RequestParam(required = false) String title,
                               @RequestParam(required = false) String publisher,
                               @RequestParam(required = false) String url,
                               @RequestParam(required = false) String channel,
                               @AuthenticationPrincipal User actor) throws IOException {
        if (file.getSize() > SourceFileReader.MAX_BYTES) throw new BadRequestException("Tệp lớn hơn 10 MB.");
        byte[] bytes = file.getBytes();
        return onChannel(channel, () -> service.addSourceFile(id, file.getOriginalFilename(), bytes, title, publisher,
                url, actor.getId()));
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
                           @RequestParam(required = false) String channel, @AuthenticationPrincipal User actor) {
        return onChannel(channel, () -> service.writeText(id, req, actor.getId()));
    }

    @PostMapping("/drafts/{id}/items")
    public Draft generateItems(@PathVariable long id, @RequestParam(required = false) String channel,
                               @AuthenticationPrincipal User actor) {
        return onChannel(channel, () -> service.generateItems(id, actor.getId()));
    }

    @PostMapping("/drafts/{id}/items/{itemId}/regenerate")
    public Draft regenerateItem(@PathVariable long id, @PathVariable String itemId,
                                @RequestBody(required = false) RegenerateItemRequest req,
                                @RequestParam(required = false) String channel,
                                @AuthenticationPrincipal User actor) {
        return onChannel(channel,
                () -> service.regenerateItem(id, itemId, req == null ? null : req.difficulty(), actor.getId()));
    }

    @PostMapping("/drafts/{id}/verify")
    public Draft verify(@PathVariable long id, @RequestParam(required = false) String channel,
                        @AuthenticationPrincipal User actor) {
        return onChannel(channel, () -> service.verify(id, actor.getId()));
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

    // ── Ghép bộ đề từ kho (đợt 2) ───────────────────────────────────────────────────────────

    @GetMapping("/assembly/bases")
    public List<ExamAssemblyService.BaseExam> bases(@RequestParam(defaultValue = "TELC") String examFormat,
                                                    @RequestParam(defaultValue = "B1") String cefrLevel) {
        return assembly.bases(examFormat, cefrLevel);
    }

    @GetMapping("/assembly/slots")
    public List<ExamAssemblyService.SlotBlocks> slots(@RequestParam(defaultValue = "TELC") String examFormat,
                                                      @RequestParam(defaultValue = "B1") String cefrLevel) {
        return assembly.slots(examFormat, cefrLevel);
    }

    @GetMapping("/assembly/blueprints")
    public List<ExamAssemblyService.Blueprint> blueprints() {
        return assembly.blueprints();
    }

    /** Ghép từ khung (cấp chưa có đề viết tay làm nền, vd. telc A2): mọi Teil lấy từ kho. */
    @PostMapping("/assemblies/blueprint")
    public ExamAssemblyService.Assembled assembleFromBlueprint(@RequestBody ExamAssemblyService.BlueprintAssembleRequest req,
                                                               @AuthenticationPrincipal User actor) {
        ExamAssemblyService.Assembled a = assembly.assembleFromBlueprint(req);
        audit.log("admin.exam_studio.exam_assembled", AuditActor.of(actor), "MOCK_EXAM", String.valueOf(a.id()),
                Map.of("blueprint", req.examFormat() + ":" + req.cefrLevel(), "teile", a.teile().size()));
        return a;
    }

    @GetMapping("/assemblies")
    public List<ExamAssemblyService.Assembled> assemblies() {
        return assembly.list();
    }

    @PostMapping("/assemblies")
    public ExamAssemblyService.Assembled assemble(@RequestBody ExamAssemblyService.AssembleRequest req,
                                                  @AuthenticationPrincipal User actor) {
        ExamAssemblyService.Assembled a = assembly.assemble(req);
        audit.log("admin.exam_studio.exam_assembled", AuditActor.of(actor), "MOCK_EXAM", String.valueOf(a.id()),
                Map.of("baseExamId", a.baseExamId(), "teile", a.teile().size()));
        return a;
    }

    public record RenameExamRequest(String title) {}

    @PatchMapping("/assemblies/{examId}")
    public ExamAssemblyService.Assembled rename(@PathVariable long examId, @RequestBody RenameExamRequest req,
                                                @AuthenticationPrincipal User actor) {
        ExamAssemblyService.Assembled a = assembly.rename(examId, req == null ? null : req.title());
        audit.log("admin.exam_studio.exam_renamed", AuditActor.of(actor), "MOCK_EXAM", String.valueOf(examId), Map.of());
        return a;
    }

    @PostMapping("/assemblies/{examId}/publish")
    public ExamAssemblyService.Assembled publish(@PathVariable long examId, @AuthenticationPrincipal User actor) {
        ExamAssemblyService.Assembled a = assembly.publish(examId);
        audit.log("admin.exam_studio.exam_published", AuditActor.of(actor), "MOCK_EXAM", String.valueOf(examId), Map.of());
        return a;
    }

    @PostMapping("/assemblies/{examId}/retire")
    public ExamAssemblyService.Assembled retire(@PathVariable long examId, @AuthenticationPrincipal User actor) {
        ExamAssemblyService.Assembled a = assembly.retire(examId);
        audit.log("admin.exam_studio.exam_retired", AuditActor.of(actor), "MOCK_EXAM", String.valueOf(examId), Map.of());
        return a;
    }

    private void log(String event, User actor, long draftId) {
        audit.log(event, AuditActor.of(actor), "EXAM_DRAFT", String.valueOf(draftId), Map.of());
    }
}
