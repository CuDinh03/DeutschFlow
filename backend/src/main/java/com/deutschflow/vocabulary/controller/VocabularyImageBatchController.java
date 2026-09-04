package com.deutschflow.vocabulary.controller;

import com.deutschflow.common.audit.AuditActor;
import com.deutschflow.common.audit.AuditLogService;
import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.user.entity.User;
import com.deutschflow.vocabulary.dto.VocabularyImageBatchGenerateRequest;
import com.deutschflow.vocabulary.dto.VocabularyImageBatchGenerateResponse;
import com.deutschflow.vocabulary.dto.VocabularyImageBatchPreviewResponse;
import com.deutschflow.vocabulary.service.VocabularyImageBatchService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v2/admin/vocabulary/images/batch")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class VocabularyImageBatchController {

    /**
     * Trần số từ một lượt batch (audit F-H4, 03/09/2026). Trước đây {@code limit} đi thẳng xuống
     * service không qua chặn nào, nên một lời gọi {@code limit=100000} là một lượt sinh ảnh AI
     * khổng lồ — tốn tiền nhà cung cấp và chiếm hàng đợi. Cùng ngưỡng với
     * {@code GrammarSyllabusController#generateExercises} (Math.min(count, 20)).
     */
    private static final int MAX_BATCH_LIMIT = 20;

    /** Trần số id tra một lượt — chặn truy vấn IN (…) dài vô hạn từ query string. */
    private static final int MAX_WORD_INFO_IDS = 200;

    private final VocabularyImageBatchService batchService;
    private final AuditLogService auditLogService;

    @PostMapping("/preview")
    public ResponseEntity<VocabularyImageBatchPreviewResponse> preview(@RequestParam(defaultValue = "20") int limit,
                                                                       @RequestParam(required = false) String cefr,
                                                                       @RequestParam(required = false) String dtype,
                                                                       @RequestParam(required = false) String tag,
                                                                       @RequestParam(defaultValue = "DEFAULT") String personaStyle,
                                                                       @AuthenticationPrincipal User user) {
        int safeLimit = clampLimit(limit);
        List<Long> missingWordIds = batchService.listMissingWordIds(safeLimit, cefr, dtype, tag);
        return ResponseEntity.ok(new VocabularyImageBatchPreviewResponse(
                safeLimit,
                personaStyle,
                batchService.countMissingImages(cefr, dtype, tag),
                missingWordIds
        ));
    }

    @GetMapping("/word-info")
    public ResponseEntity<List<Map<String, Object>>> wordInfo(@RequestParam List<Long> ids) {
        if (ids != null && ids.size() > MAX_WORD_INFO_IDS) {
            throw new BadRequestException("Tối đa " + MAX_WORD_INFO_IDS + " từ mỗi lượt tra.");
        }
        return ResponseEntity.ok(batchService.getWordInfoByIds(ids));
    }

    @PostMapping("/generate")
    public ResponseEntity<VocabularyImageBatchGenerateResponse> generate(@RequestBody(required = false) VocabularyImageBatchGenerateRequest request,
                                                                          @RequestParam(defaultValue = "20") int limit,
                                                                          @RequestParam(required = false) String cefr,
                                                                          @RequestParam(required = false) String dtype,
                                                                          @RequestParam(required = false) String tag,
                                                                          @RequestParam(defaultValue = "DEFAULT") String personaStyle,
                                                                          @AuthenticationPrincipal User user) {
        int effectiveLimit = clampLimit(request != null && request.limit() != null ? request.limit() : limit);
        String effectivePersonaStyle = request != null && request.personaStyle() != null ? request.personaStyle() : personaStyle;
        String effectiveCefr = request != null && request.cefr() != null ? request.cefr() : cefr;
        String effectiveDtype = request != null && request.dtype() != null ? request.dtype() : dtype;
        String effectiveTag = request != null && request.tag() != null ? request.tag() : tag;
        List<Long> approvedWordIds = request != null ? request.approvedWordIds() : null;
        int created = batchService.generateBatch(effectiveLimit, effectivePersonaStyle, effectiveCefr, effectiveDtype, effectiveTag, approvedWordIds);
        // Sinh ảnh hàng loạt tốn tiền nhà cung cấp — không có vết thì không truy được ai đã đốt.
        auditLogService.log(
                "admin.vocabulary.image.batch",
                AuditActor.of(user),
                "VOCABULARY",
                null,
                Map.of(
                        "limit", effectiveLimit,
                        "created", created,
                        "personaStyle", effectivePersonaStyle,
                        "cefr", String.valueOf(effectiveCefr),
                        "dtype", String.valueOf(effectiveDtype),
                        "tag", String.valueOf(effectiveTag),
                        "approvedWordIds", approvedWordIds == null ? 0 : approvedWordIds.size()
                )
        );
        return ResponseEntity.ok(new VocabularyImageBatchGenerateResponse(
                effectiveLimit,
                effectivePersonaStyle,
                created,
                batchService.countMissingImages(effectiveCefr, effectiveDtype, effectiveTag)
        ));
    }

    /** Kẹp về [1, {@value #MAX_BATCH_LIMIT}] — giá trị vô lý bị hạ xuống trần, không ném lỗi. */
    private static int clampLimit(int limit) {
        return Math.min(Math.max(limit, 1), MAX_BATCH_LIMIT);
    }
}
