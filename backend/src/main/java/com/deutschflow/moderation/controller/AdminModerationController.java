package com.deutschflow.moderation.controller;

import com.deutschflow.common.audit.AuditActor;
import com.deutschflow.common.audit.AuditLogService;
import com.deutschflow.common.audit.AuditOrgResolver;
import com.deutschflow.moderation.dto.ModerationDtos.ReportDto;
import com.deutschflow.moderation.entity.ContentReport.Status;
import com.deutschflow.moderation.service.ContentReportService;
import com.deutschflow.user.entity.User;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Admin triage of user-filed content reports (Apple Guideline 1.2).
 *
 * <p>Ghi vết (owner chốt 10/09/2026, quyết định 7): đường ĐỌC {@code GET /reports} trả về tối đa
 * 200 dòng kèm {@code snapshotBody} — tức nội dung tin nhắn riêng của người khác — nên nó là một
 * lần truy xuất dữ liệu nhạy cảm và phải để lại dấu, MỘT vết cho MỖI trung tâm có dòng bị đọc (nhóm
 * theo {@code org_id} đóng băng; dòng không org gom một vết không org). Vết mang định danh và số
 * lượng, KHÔNG nội dung.
 *
 * <p>🪤 Vết đường đọc nằm ở CONTROLLER, fail-open có tiếng: service đọc là
 * {@code @Transactional(readOnly = true)}, một INSERT ở đó ném <i>"cannot execute INSERT in a
 * read-only transaction"</i> (xem {@code AuditOrgResolver}). Vết hỏng thì log.error và vẫn trả dữ
 * liệu — admin không được mù vì sổ hỏng, nhưng sổ hỏng cũng không được im.
 */
@Slf4j
@RestController
@RequestMapping("/api/admin/moderation")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AdminModerationController {

    static final String EVENT_REPORTS_READ = "admin.moderation.reports.read";
    static final String EVENT_REPORT_RESOLVED = "admin.moderation.report.resolved";
    static final String TARGET_TYPE = "CONTENT_REPORT";

    /** Trần số id chép vào một vết — đủ để đối chiếu, không biến sổ thành bản sao của bảng. */
    static final int MAX_REPORT_IDS_IN_TRACE = 50;

    private final ContentReportService reportService;
    private final AuditLogService auditLogService;
    private final AuditOrgResolver auditOrgResolver;

    /** Most recent reports, optionally filtered by status (PENDING / RESOLVED / DISMISSED). */
    @GetMapping("/reports")
    public List<ReportDto> reports(@AuthenticationPrincipal User admin,
                                   @RequestParam(required = false) Status status) {
        List<ReportDto> reports = reportService.list(status);
        auditReadPerOrg(admin, status, reports);
        return reports;
    }

    /** Resolve or dismiss a report. */
    @PostMapping("/reports/{id}/resolve")
    public ResponseEntity<Void> resolve(@AuthenticationPrincipal User admin,
                                        @PathVariable Long id,
                                        @RequestParam Status status) {
        // DEC-13: trung tâm BỊ TÁC ĐỘNG là org_id đóng băng trên chính báo cáo — tra ở controller
        // theo khuôn AuditOrgResolver, để vết rơi vào sổ của giám đốc trung tâm đó.
        Long touchedOrgId = auditOrgResolver.forContentReport(id);
        reportService.resolve(admin.getId(), id, status);
        // Audit F-M3 (03/09/2026): phán quyết một báo cáo nội dung là quyết định kiểm duyệt có thể
        // bị chất vấn về sau (Apple Guideline 1.2) — cần biết ai đã quyết và quyết thế nào.
        auditLogService.log(EVENT_REPORT_RESOLVED, AuditActor.of(admin),
                TARGET_TYPE, String.valueOf(id), touchedOrgId, Map.of("status", String.valueOf(status)));
        return ResponseEntity.noContent().build();
    }

    /**
     * Một vết cho mỗi trung tâm bị chạm. Danh sách rỗng vẫn để lại đúng một vết (không org, count 0):
     * "admin đã mở hàng đợi kiểm duyệt" là sự kiện, dù hôm đó không có gì để đọc.
     */
    private void auditReadPerOrg(User admin, Status status, List<ReportDto> reports) {
        Map<Long, List<Long>> idsByOrg = new LinkedHashMap<>();
        for (ReportDto r : reports) {
            idsByOrg.computeIfAbsent(r.orgId(), k -> new ArrayList<>()).add(r.id());
        }
        if (idsByOrg.isEmpty()) {
            idsByOrg.put(null, List.of());
        }
        String statusLabel = status == null ? "ALL" : status.name();
        idsByOrg.forEach((orgId, ids) -> auditRead(() -> auditLogService.log(
                EVENT_REPORTS_READ, AuditActor.of(admin), TARGET_TYPE, null, orgId, readMetadata(statusLabel, ids))));
    }

    /** ⛔ Chỉ định danh + số lượng. Không {@code snapshotBody}, không {@code details}, không tên ai. */
    private static Map<String, Object> readMetadata(String statusLabel, List<Long> ids) {
        Map<String, Object> metadata = new LinkedHashMap<>();
        metadata.put("status", statusLabel);
        metadata.put("count", ids.size());
        metadata.put("reportIds", ids.size() > MAX_REPORT_IDS_IN_TRACE ? ids.subList(0, MAX_REPORT_IDS_IN_TRACE) : ids);
        metadata.put("reportIdsTruncated", ids.size() > MAX_REPORT_IDS_IN_TRACE);
        return metadata;
    }

    private void auditRead(Runnable auditWrite) {
        try {
            auditWrite.run();
        } catch (Exception e) {
            log.error("Không ghi được vết đường đọc admin (moderation): {}", e.getMessage(), e);
        }
    }
}
