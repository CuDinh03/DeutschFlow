package com.deutschflow.grammar.controller;

import com.deutschflow.common.audit.AuditActor;
import com.deutschflow.common.audit.AuditLogService;
import com.deutschflow.grammar.service.PracticeAccessAdminService;
import com.deutschflow.user.entity.User;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * Admin quản lý quyền dùng luyện đề telc (04/11/2026): chế độ OFF / ALLOWLIST / ALL và danh sách học
 * viên được phép. Có hiệu lực ngay — {@code MockExamPracticeService} đọc thẳng DB mỗi lần gọi.
 */
@RestController
@RequestMapping("/api/admin/practice-access")
@PreAuthorize("hasRole('ADMIN')")
public class AdminPracticeAccessController {

    private final PracticeAccessAdminService service;
    private final AuditLogService auditLogService;

    public AdminPracticeAccessController(PracticeAccessAdminService service, AuditLogService auditLogService) {
        this.service = service;
        this.auditLogService = auditLogService;
    }

    public record ModeRequest(String mode) {}

    public record AddRequest(String identifier) {}

    @GetMapping
    public PracticeAccessAdminService.State state() {
        return service.state();
    }

    @PutMapping("/mode")
    public PracticeAccessAdminService.State setMode(@RequestBody ModeRequest body, @AuthenticationPrincipal User actor) {
        PracticeAccessAdminService.State state = service.setMode(body.mode());
        audit("admin.practice_access.mode", actor, state.mode(), Map.of("mode", state.mode()));
        return state;
    }

    @PostMapping("/users")
    public PracticeAccessAdminService.State add(@RequestBody AddRequest body, @AuthenticationPrincipal User actor) {
        PracticeAccessAdminService.State state = service.add(body.identifier());
        audit("admin.practice_access.added", actor, body.identifier(), Map.of());
        return state;
    }

    @DeleteMapping("/users/{userId}")
    public PracticeAccessAdminService.State remove(@PathVariable long userId, @AuthenticationPrincipal User actor) {
        PracticeAccessAdminService.State state = service.remove(userId);
        audit("admin.practice_access.removed", actor, String.valueOf(userId), Map.of());
        return state;
    }

    @DeleteMapping("/tokens")
    public PracticeAccessAdminService.State removeToken(@RequestParam String token, @AuthenticationPrincipal User actor) {
        PracticeAccessAdminService.State state = service.removeToken(token);
        audit("admin.practice_access.token_removed", actor, token, Map.of());
        return state;
    }

    @GetMapping("/search")
    public List<PracticeAccessAdminService.Member> search(@RequestParam(defaultValue = "") String q) {
        return service.search(q);
    }

    private void audit(String event, User actor, String target, Map<String, Object> meta) {
        auditLogService.log(event, AuditActor.of(actor), "PRACTICE_ACCESS", target, meta);
    }
}
