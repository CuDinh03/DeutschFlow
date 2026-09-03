package com.deutschflow.training.controller;

import com.deutschflow.common.audit.AuditActor;
import com.deutschflow.user.entity.User;
import com.deutschflow.common.audit.AuditLogService;
import com.deutschflow.training.service.TrainingDatasetService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.Map;

/**
 * Admin-only API để xem thống kê và export dataset huấn luyện AI.
 * Base path: /api/admin/training-dataset
 */
@RestController
@RequestMapping("/api/admin/training-dataset")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class TrainingDatasetController {

    private final TrainingDatasetService trainingDatasetService;
    private final AuditLogService auditLogService;

    /**
     * GET /api/admin/training-dataset/stats
     * Thống kê tổng quan dataset
     */
    @GetMapping("/stats")
    public ResponseEntity<Map<String, Object>> getStats() {
        return ResponseEntity.ok(trainingDatasetService.getStats());
    }

    /**
     * GET /api/admin/training-dataset/export/conversations
     * Export conversations dưới dạng JSONL (Alpaca format)
     *
     * Params:
     *   - cefrLevel: A1 | A2 | B1 | B2 | C1 (optional)
     *   - errorsOnly: true/false (default false)
     *   - limit: max rows (default 5000)
     */
    @GetMapping("/export/conversations")
    public ResponseEntity<byte[]> exportConversations(
            @RequestParam(required = false) String cefrLevel,
            @RequestParam(defaultValue = "false") boolean errorsOnly,
            @RequestParam(defaultValue = "5000") int limit,
            @AuthenticationPrincipal User actor
    ) {
        int safeLimit = Math.min(limit, 50_000);
        String jsonl = trainingDatasetService.exportAlpacaJsonl(cefrLevel, errorsOnly, safeLimit);
        String filename = buildFilename("conversations", cefrLevel, errorsOnly);
        auditExport("conversations", actor, cefrLevel, errorsOnly, safeLimit, jsonl);

        // C2 (F-M10, 03/09/2026): corpus hội thoại thô của người học — cấm mọi tầng cache (proxy,
        // browser disk) giữ lại một bản PII sau khi tải.
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                .contentType(MediaType.parseMediaType("application/jsonl+json"))
                .body(jsonl.getBytes(StandardCharsets.UTF_8));
    }

    /**
     * GET /api/admin/training-dataset/export/errors
     * Export error samples dưới dạng JSONL (Alpaca correction format)
     *
     * Params:
     *   - cefrLevel: A1 | A2 | B1 | B2 | C1 (optional)
     *   - limit: max rows (default 5000)
     */
    @GetMapping("/export/errors")
    public ResponseEntity<byte[]> exportErrors(
            @RequestParam(required = false) String cefrLevel,
            @RequestParam(defaultValue = "5000") int limit,
            @AuthenticationPrincipal User actor
    ) {
        int safeLimit = Math.min(limit, 50_000);
        String jsonl = trainingDatasetService.exportErrorSamplesJsonl(cefrLevel, safeLimit);
        String filename = buildFilename("error_samples", cefrLevel, false);
        auditExport("error_samples", actor, cefrLevel, false, safeLimit, jsonl);

        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                .contentType(MediaType.parseMediaType("application/jsonl+json"))
                .body(jsonl.getBytes(StandardCharsets.UTF_8));
    }

    // -----------------------------------------------------------------------
    // Private helpers
    // -----------------------------------------------------------------------

    /**
     * Audit F-M3/F-M10 (03/09/2026): hai endpoint này kéo ra tới 50.000 dòng hội thoại TỰ DO của
     * người học — dữ liệu cá nhân ở dạng thô nhất mà hệ thống có — và trước đây rời máy chủ mà
     * không để lại vết nào. Không ai trả lời được "ai đã tải, bao nhiêu, lúc nào" khi cần.
     *
     * <p>Ghi số DÒNG thật đã xuất, không phải limit yêu cầu: đó mới là lượng dữ liệu đã ra ngoài.
     */
    private void auditExport(String dataset, User actor,
                             String cefrLevel, boolean errorsOnly, int limit, String jsonl) {
        auditLogService.log(
                "admin.training_dataset.exported",
                AuditActor.of(actor),
                "TRAINING_DATASET",
                dataset,
                Map.of(
                        "cefrLevel", String.valueOf(cefrLevel),
                        "errorsOnly", errorsOnly,
                        "limit", limit,
                        "rowsExported", jsonl.isEmpty() ? 0 : jsonl.split("\n", -1).length - (jsonl.endsWith("\n") ? 1 : 0),
                        "bytes", jsonl.getBytes(StandardCharsets.UTF_8).length
                ));
    }

    private String buildFilename(String type, String cefrLevel, boolean errorsOnly) {
        StringBuilder sb = new StringBuilder("deutschflow_");
        sb.append(type);
        if (cefrLevel != null && !cefrLevel.isBlank()) {
            sb.append("_").append(cefrLevel.toLowerCase());
        }
        if (errorsOnly) {
            sb.append("_errors_only");
        }
        sb.append("_").append(LocalDate.now()).append(".jsonl");
        return sb.toString();
    }
}
