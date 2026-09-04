package com.deutschflow.admin.controller;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import com.deutschflow.user.entity.User;
import com.deutschflow.common.audit.AuditLogService;
import com.deutschflow.common.audit.AuditActor;
import com.deutschflow.admin.service.WeeklySpeakingAdminService;
import com.deutschflow.speaking.dto.WeeklySpeakingDtos;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin/speaking/weekly-prompts")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class WeeklySpeakingAdminController {

    private final WeeklySpeakingAdminService weeklySpeakingAdminService;
    private final AuditLogService auditLogService;

    @GetMapping
    public List<Map<String, Object>> list(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate weekStart
    ) {
        return weeklySpeakingAdminService.listPrompts(weekStart);
    }

    @GetMapping("/{id}")
    public Map<String, Object> get(@PathVariable long id) {
        return weeklySpeakingAdminService.getPrompt(id);
    }

    @PostMapping
    public ResponseEntity<Map<String, Object>> create(
            @Valid @RequestBody WeeklySpeakingDtos.WeeklyPromptAdminUpsertRequest body,
            @AuthenticationPrincipal User actor
    ) throws Exception {
        long id = weeklySpeakingAdminService.createPrompt(body);
        audit("admin.weekly_speaking.prompt.created", actor, id);
        return ResponseEntity.status(201).body(Map.of("id", id));
    }

    @PutMapping("/{id}")
    public Map<String, Object> replace(
            @PathVariable long id,
            @Valid @RequestBody WeeklySpeakingDtos.WeeklyPromptAdminUpsertRequest body,
            @AuthenticationPrincipal User actor
    ) throws Exception {
        Map<String, Object> updated = weeklySpeakingAdminService.updatePrompt(id, body);
        audit("admin.weekly_speaking.prompt.updated", actor, id);
        return updated;
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(org.springframework.http.HttpStatus.NO_CONTENT)
    public void deactivate(@PathVariable long id, @AuthenticationPrincipal User actor) {
        weeklySpeakingAdminService.deactivatePrompt(id);
        audit("admin.weekly_speaking.prompt.deactivated", actor, id);
    }

    /**
     * Audit F-M3 (03/09/2026): đề nói hằng tuần là nội dung mọi học viên nhìn thấy cùng lúc; tạo,
     * thay và gỡ đều là curation có ảnh hưởng rộng mà trước đây không để lại vết nào.
     */
    private void audit(String event, User actor, long promptId) {
        auditLogService.log(event, AuditActor.of(actor),
                "WEEKLY_SPEAKING_PROMPT", String.valueOf(promptId), Map.of());
    }
}
