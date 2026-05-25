package com.deutschflow.training.controller;

import com.deutschflow.training.service.TrainingDatasetService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
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
            @RequestParam(defaultValue = "5000") int limit
    ) {
        String jsonl = trainingDatasetService.exportAlpacaJsonl(cefrLevel, errorsOnly, Math.min(limit, 50_000));
        String filename = buildFilename("conversations", cefrLevel, errorsOnly);

        return ResponseEntity.ok()
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
            @RequestParam(defaultValue = "5000") int limit
    ) {
        String jsonl = trainingDatasetService.exportErrorSamplesJsonl(cefrLevel, Math.min(limit, 50_000));
        String filename = buildFilename("error_samples", cefrLevel, false);

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                .contentType(MediaType.parseMediaType("application/jsonl+json"))
                .body(jsonl.getBytes(StandardCharsets.UTF_8));
    }

    // -----------------------------------------------------------------------
    // Private helpers
    // -----------------------------------------------------------------------

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
