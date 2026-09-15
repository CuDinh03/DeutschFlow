package com.deutschflow.training.controller;

import com.deutschflow.common.audit.AuditActor;
import com.deutschflow.user.entity.User;
import com.deutschflow.common.audit.AuditLogService;
import com.deutschflow.training.service.TrainingDatasetService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
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
@Slf4j
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
     *
     * <p><b>🔴 Giới hạn đã biết (DEC-13, 09/09/2026): vết này giám đốc trung tâm KHÔNG đọc được.</b>
     * {@code audit_logs.org_id} ở đây là NULL, vì actor là admin nền tảng (không thuộc trung tâm nào
     * theo DEC-13) và điểm gọi không có {@code orgId} nào để truyền vào. Truy ngược cũng không rẻ:
     * tập dòng xuất ra do bộ lọc + {@code ORDER BY quality_score … LIMIT} bên trong
     * {@code TrainingDatasetService} quyết định, muốn biết chạm trung tâm nào phải chạy lại đúng câu
     * đó rồi join {@code users} trên tới 50.000 dòng — và chép logic lọc lên controller thì hai bên
     * sẽ lệch nhau ở đợt sau. Nên vết ghi {@code orgScope = CROSS_ORG} để nói thẳng "cửa này xuất dữ
     * liệu của nhiều trung tâm cùng lúc" thay vì gán bừa một orgId đơn trị.
     *
     * <p><b>Hướng xử cho đợt sau (KHÔNG làm trong PR này — sẽ đổi hợp đồng của service):</b> cho
     * {@code exportAlpacaJsonl}/{@code exportErrorSamplesJsonl} trả về một envelope kèm tập
     * {@code orgId} đã chạm (lấy ngay trong câu SELECT sẵn có bằng cách select thêm
     * {@code user_id}), rồi ghi MỘT vết cho mỗi trung tâm bị chạm — cách duy nhất để cửa 50.000 dòng
     * hiện lên trong sổ của giám đốc.
     */
    private void auditExport(String dataset, User actor,
                             String cefrLevel, boolean errorsOnly, int limit, String jsonl) {
        // Fail-open có tiếng: export ĐÃ chạy xong và tốn một truy vấn nặng — để lỗi ghi vết ném
        // 500 ra client chỉ khiến admin bấm tải lại, tức KÉO THÊM một bản PII nữa ra ngoài mà vẫn
        // không có vết nào. Nuốt kèm log.error như GlobalExceptionHandler làm với vết blocked-attempt.
        try {
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
                            "bytes", jsonl.getBytes(StandardCharsets.UTF_8).length,
                            "orgScope", "CROSS_ORG"
                    ));
        } catch (Exception e) {
            log.error("Không ghi được vết admin.training_dataset.exported (dataset={}): {}", dataset, e.toString());
        }
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
