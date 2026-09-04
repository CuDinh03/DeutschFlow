package com.deutschflow.grammar.controller;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import com.deutschflow.user.entity.User;
import com.deutschflow.common.audit.AuditLogService;
import com.deutschflow.common.audit.AuditActor;
import com.deutschflow.grammar.dto.CreateMockExamPackRequest;
import com.deutschflow.grammar.dto.MockExamPackAdminDto;
import com.deutschflow.grammar.dto.UpdateMockExamPackRequest;
import com.deutschflow.grammar.service.AdminMockExamPackService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * ADMIN curation of mock-exam packs (D3): create / update / retire packs without raw SQL. Mirrors
 * the thin-controller style of {@code AdminOrganizationController} (delegates to the service).
 */
@RestController
@RequestMapping("/api/admin/mock-exam-packs")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AdminMockExamPackController {

    private final AdminMockExamPackService adminMockExamPackService;
    private final AuditLogService auditLogService;

    @GetMapping
    public List<MockExamPackAdminDto> list() {
        return adminMockExamPackService.list();
    }

    @PostMapping
    public MockExamPackAdminDto create(@RequestBody CreateMockExamPackRequest request,
                                       @AuthenticationPrincipal User actor) {
        MockExamPackAdminDto created = adminMockExamPackService.create(request);
        audit("admin.mock_exam_pack.created", actor, created.id());
        return created;
    }

    @PatchMapping("/{id}")
    public MockExamPackAdminDto update(@PathVariable Long id, @RequestBody UpdateMockExamPackRequest request,
                                       @AuthenticationPrincipal User actor) {
        MockExamPackAdminDto updated = adminMockExamPackService.update(id, request);
        audit("admin.mock_exam_pack.updated", actor, id);
        return updated;
    }

    /** Soft-delete: retire the pack from the student catalog. */
    @DeleteMapping("/{id}")
    public MockExamPackAdminDto deactivate(@PathVariable Long id, @AuthenticationPrincipal User actor) {
        MockExamPackAdminDto deactivated = adminMockExamPackService.deactivate(id);
        audit("admin.mock_exam_pack.deactivated", actor, id);
        return deactivated;
    }

    /**
     * Audit F-M3 (03/09/2026): gói đề thi thử là catalog học viên mua/dùng; gỡ một gói khỏi catalog
     * là thay đổi nhìn thấy được với mọi người mà trước đây không truy được ai làm.
     */
    private void audit(String event, User actor, Long packId) {
        auditLogService.log(event, AuditActor.of(actor),
                "MOCK_EXAM_PACK", String.valueOf(packId), java.util.Map.of());
    }
}
