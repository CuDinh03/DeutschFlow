package com.deutschflow.vocabulary.galerie.controller;

import com.deutschflow.user.entity.User;
import com.deutschflow.vocabulary.galerie.dto.GalerieConceptBatchResponse;
import com.deutschflow.vocabulary.galerie.dto.GalerieSvgBatchResponse;
import com.deutschflow.vocabulary.galerie.service.GalerieConceptService;
import com.deutschflow.vocabulary.galerie.service.GalerieSvgGenerationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * Admin pipeline DeutschFlow Galerie — P0 chỉ có bước concept (spec mục 22 + plan mục 18).
 * ADMIN-only (không mở cho TEACHER như batch Unsplash cũ): bước sau của pipeline đốt tiền
 * image-gen, giữ một cổng quyền ngay từ đầu.
 */
@RestController
@RequestMapping("/api/v2/admin/vocabulary/galerie")
@RequiredArgsConstructor
public class GalerieAdminController {

    private static final int OVERVIEW_MAX_LIMIT = 200;

    private final GalerieConceptService conceptService;
    private final GalerieSvgGenerationService svgGenerationService;
    private final JdbcTemplate jdbcTemplate;

    /** Sinh concept cho các từ sạch còn thiếu (ưu tiên frequency_rank). */
    @PostMapping("/concepts")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<GalerieConceptBatchResponse> generateConcepts(
            @RequestParam(defaultValue = "30") int limit,
            @RequestParam(required = false) String cefr,
            @AuthenticationPrincipal User user) {
        return ResponseEntity.ok(conceptService.generateForMissing(limit, cefr, user != null ? user.getId() : null));
    }

    /** Sinh concept cho danh sách wordIds cụ thể — dùng cho pilot 30 từ (spec mục 30). */
    @PostMapping("/concepts/by-ids")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<GalerieConceptBatchResponse> generateConceptsByIds(
            @RequestBody GalerieConceptByIdsRequest request,
            @AuthenticationPrincipal User user) {
        List<Long> wordIds = request == null ? null : request.wordIds();
        return ResponseEntity.ok(conceptService.generateForWordIds(wordIds, user != null ? user.getId() : null));
    }

    /** Grid data cho màn review collection (spec mục 30–31) — đọc thuần, phân trang đơn giản. */
    @GetMapping("/overview")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<List<Map<String, Object>>> overview(
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "60") int limit,
            @RequestParam(defaultValue = "0") int offset) {
        int effectiveLimit = Math.min(Math.max(1, limit), OVERVIEW_MAX_LIMIT);
        int effectiveOffset = Math.max(0, offset);
        // Schema thật (hotfix ERR-2): meaning ở word_translations (vi→en), gender ở nouns.
        StringBuilder sql = new StringBuilder("""
                SELECT w.id, w.base_form, n.gender, w.dtype, w.cefr_level,
                       COALESCE(t_vi.meaning, t_en.meaning) AS meaning,
                       w.image_family, w.image_concept, w.image_status, w.image_url, w.image_style
                FROM words w
                LEFT JOIN nouns n ON n.id = w.id
                LEFT JOIN word_translations t_vi ON t_vi.word_id = w.id AND t_vi.locale = 'vi'
                LEFT JOIN word_translations t_en ON t_en.word_id = w.id AND t_en.locale = 'en'
                WHERE w.image_status IS NOT NULL
                """);
        java.util.ArrayList<Object> args = new java.util.ArrayList<>();
        if (status != null && !status.isBlank()) {
            sql.append(" AND w.image_status = ?");
            args.add(status.trim().toUpperCase());
        }
        sql.append(" ORDER BY w.image_updated_at DESC NULLS LAST, w.id ASC LIMIT ? OFFSET ?");
        args.add(effectiveLimit);
        args.add(effectiveOffset);
        return ResponseEntity.ok(jdbcTemplate.queryForList(sql.toString(), args.toArray()));
    }

    /** Đếm số từ sạch còn thiếu concept — cho admin ước lượng khối lượng trước khi chạy. */
    @GetMapping("/concepts/missing-count")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, Integer>> missingCount(@RequestParam(required = false) String cefr) {
        return ResponseEntity.ok(Map.of("missing", conceptService.countMissing(cefr)));
    }

    // ── P2: sinh SVG + quyết định review (plan mục 12/16/18) ───────────────────────────────────

    /** Sinh artwork SVG cho các từ CONCEPT_READY (sync, chunk nhỏ — pilot/A1; Batch API để P4). */
    @PostMapping("/generate")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<GalerieSvgBatchResponse> generateSvg(
            @RequestParam(defaultValue = "10") int limit,
            @RequestParam(required = false) String cefr,
            @AuthenticationPrincipal User user) {
        return ResponseEntity.ok(svgGenerationService.generateForReady(limit, cefr, user));
    }

    /** Số từ CONCEPT_READY đang chờ sinh artwork. */
    @GetMapping("/generate/ready-count")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, Integer>> readyCount(@RequestParam(required = false) String cefr) {
        return ResponseEntity.ok(Map.of("ready", svgGenerationService.countReady(cefr)));
    }

    /**
     * Quyết định review per-artwork: APPROVE (QA_PENDING→APPROVED), REGENERATE (gỡ artwork,
     * về CONCEPT_READY), REJECT. 409 khi từ không ở trạng thái cho phép chuyển.
     */
    @PostMapping("/{wordId}/decision")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, Object>> decide(
            @PathVariable long wordId,
            @RequestBody GalerieDecisionRequest request) {
        GalerieSvgGenerationService.Decision decision = parseDecision(request);
        boolean changed = svgGenerationService.decide(wordId, decision);
        if (!changed) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of(
                    "wordId", wordId,
                    "decision", decision.name(),
                    "error", "Từ không ở trạng thái cho phép quyết định này"));
        }
        return ResponseEntity.ok(Map.of("wordId", wordId, "decision", decision.name()));
    }

    private static GalerieSvgGenerationService.Decision parseDecision(GalerieDecisionRequest request) {
        String raw = request == null ? null : request.decision();
        if (raw == null || raw.isBlank()) {
            throw new IllegalArgumentException("decision là bắt buộc: APPROVE | REGENERATE | REJECT");
        }
        try {
            return GalerieSvgGenerationService.Decision.valueOf(raw.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("decision không hợp lệ: " + raw);
        }
    }

    public record GalerieConceptByIdsRequest(List<Long> wordIds) {}

    public record GalerieDecisionRequest(String decision) {}
}
