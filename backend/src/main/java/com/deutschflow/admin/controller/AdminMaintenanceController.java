package com.deutschflow.admin.controller;

import com.deutschflow.common.audit.AuditActor;
import com.deutschflow.common.audit.AuditLogService;
import com.deutschflow.system.dto.MaintenanceWindowDto;
import com.deutschflow.system.service.MaintenanceWindowService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Quản trị cửa sổ bảo trì (thiết kế plans/2026-09-03 §5.4). Nằm dưới
 * {@code /api/admin/**} nên hưởng cả hai lớp gate có sẵn: {@code @PreAuthorize}
 * tại class + URL backstop trong SecurityConfig; đồng thời được
 * {@code MaintenanceModeFilter} whitelist — admin luôn TẮT được bảo trì qua UI.
 * Mọi mutation ghi audit log (pattern {@code AdminAiConfigController}).
 */
@RestController
@RequestMapping("/api/admin/maintenance-windows")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AdminMaintenanceController {

    private final MaintenanceWindowService maintenanceWindowService;
    private final AuditLogService auditLogService;

    // ── DTOs ────────────────────────────────────────────────────────────────

    public record CreateRequest(
            @NotBlank @Size(max = 200) String title,
            @Size(max = 2000) String note,
            @NotNull Instant startsAtUtc,
            Instant endsAtUtc,
            String mode,
            Boolean autoActivate,
            Boolean autoComplete,
            /** Mặc định true — gửi ngay thông báo "có lịch" cho toàn bộ user. */
            Boolean notifyUsers) {}

    public record UpdateRequest(
            @Size(max = 200) String title,
            @Size(max = 2000) String note,
            Instant startsAtUtc,
            Instant endsAtUtc,
            String mode,
            Boolean autoActivate,
            Boolean autoComplete) {}

    public record EmergencyRequest(
            @Size(max = 200) String title,
            @Size(max = 2000) String note,
            Instant endsAtUtc) {}

    /** {@code overlappingIds} — cảnh báo mềm lịch chồng lấn, không chặn tạo. */
    public record CreateResponse(MaintenanceWindowDto window, List<Long> overlappingIds) {}

    // ── Endpoints ───────────────────────────────────────────────────────────

    @GetMapping
    public ResponseEntity<Page<MaintenanceWindowDto>> list(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(maintenanceWindowService.list(page, size));
    }

    @PostMapping
    public ResponseEntity<CreateResponse> create(@Valid @RequestBody CreateRequest request,
                                                 Authentication authentication) {
        boolean notify = request.notifyUsers() == null || request.notifyUsers();
        MaintenanceWindowService.CreateResult result = maintenanceWindowService.create(
                request.title(), request.note(), request.startsAtUtc(), request.endsAtUtc(),
                request.mode(), request.autoActivate(), request.autoComplete(),
                notify, authentication.getName());
        audit("admin.maintenance.created", authentication, result.window().id(), Map.of(
                "title", request.title(),
                "startsAtUtc", String.valueOf(request.startsAtUtc()),
                "endsAtUtc", String.valueOf(request.endsAtUtc()),
                "notify", notify));
        return ResponseEntity.ok(new CreateResponse(result.window(), result.overlappingIds()));
    }

    @PatchMapping("/{id}")
    public ResponseEntity<MaintenanceWindowDto> update(@PathVariable long id,
                                                       @Valid @RequestBody UpdateRequest request,
                                                       Authentication authentication) {
        MaintenanceWindowDto dto = maintenanceWindowService.update(
                id, request.title(), request.note(), request.startsAtUtc(), request.endsAtUtc(),
                request.mode(), request.autoActivate(), request.autoComplete());
        Map<String, Object> changed = new LinkedHashMap<>();
        if (request.title() != null) changed.put("title", request.title());
        if (request.startsAtUtc() != null) changed.put("startsAtUtc", String.valueOf(request.startsAtUtc()));
        if (request.endsAtUtc() != null) changed.put("endsAtUtc", String.valueOf(request.endsAtUtc()));
        if (request.mode() != null) changed.put("mode", request.mode());
        if (request.note() != null) changed.put("note", "updated");
        if (request.autoActivate() != null) changed.put("autoActivate", request.autoActivate());
        if (request.autoComplete() != null) changed.put("autoComplete", request.autoComplete());
        audit("admin.maintenance.updated", authentication, id, changed);
        return ResponseEntity.ok(dto);
    }

    @PostMapping("/{id}/activate")
    public ResponseEntity<MaintenanceWindowDto> activate(@PathVariable long id, Authentication authentication) {
        MaintenanceWindowDto dto = maintenanceWindowService.activate(id);
        audit("admin.maintenance.activated", authentication, id, Map.of());
        return ResponseEntity.ok(dto);
    }

    @PostMapping("/{id}/complete")
    public ResponseEntity<MaintenanceWindowDto> complete(@PathVariable long id, Authentication authentication) {
        MaintenanceWindowDto dto = maintenanceWindowService.complete(id);
        audit("admin.maintenance.completed", authentication, id, Map.of());
        return ResponseEntity.ok(dto);
    }

    @PostMapping("/{id}/cancel")
    public ResponseEntity<MaintenanceWindowDto> cancel(@PathVariable long id, Authentication authentication) {
        MaintenanceWindowDto dto = maintenanceWindowService.cancel(id);
        audit("admin.maintenance.cancelled", authentication, id, Map.of());
        return ResponseEntity.ok(dto);
    }

    /** Bật bảo trì KHẨN CẤP — window ACTIVE mode FULL ngay lập tức, hiệu lực ≤15s trên mọi node. */
    @PostMapping("/emergency")
    public ResponseEntity<MaintenanceWindowDto> emergency(@Valid @RequestBody EmergencyRequest request,
                                                          Authentication authentication) {
        MaintenanceWindowDto dto = maintenanceWindowService.emergency(
                request.title(), request.note(), request.endsAtUtc(), authentication.getName());
        audit("admin.maintenance.emergency", authentication, dto.id(), Map.of(
                "endsAtUtc", String.valueOf(request.endsAtUtc())));
        return ResponseEntity.ok(dto);
    }

    // ── Helpers ─────────────────────────────────────────────────────────────

    private void audit(String event, Authentication authentication, long windowId, Map<String, Object> details) {
        // Audit F-M4 (03/09/2026): trước đây truyền null làm actor_user_id nên vết chỉ có email.
        auditLogService.log(event, AuditActor.ofAuthentication(authentication),
                "MAINTENANCE", String.valueOf(windowId), details);
    }

}
