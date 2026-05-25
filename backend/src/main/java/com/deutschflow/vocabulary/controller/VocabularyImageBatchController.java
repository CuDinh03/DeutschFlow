package com.deutschflow.vocabulary.controller;

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

@RestController
@RequestMapping("/api/v2/admin/vocabulary/images/batch")
@RequiredArgsConstructor
public class VocabularyImageBatchController {

    private final VocabularyImageBatchService batchService;

    @PostMapping("/preview")
    @PreAuthorize("hasRole('TEACHER') or hasRole('ADMIN')")
    public ResponseEntity<VocabularyImageBatchPreviewResponse> preview(@RequestParam(defaultValue = "20") int limit,
                                                                       @RequestParam(required = false) String cefr,
                                                                       @RequestParam(required = false) String dtype,
                                                                       @RequestParam(required = false) String tag,
                                                                       @RequestParam(defaultValue = "DEFAULT") String personaStyle,
                                                                       @AuthenticationPrincipal User user) {
        List<Long> missingWordIds = batchService.listMissingWordIds(limit, cefr, dtype, tag);
        return ResponseEntity.ok(new VocabularyImageBatchPreviewResponse(
                limit,
                personaStyle,
                batchService.countMissingImages(cefr, dtype, tag),
                missingWordIds
        ));
    }

    @PostMapping("/generate")
    @PreAuthorize("hasRole('TEACHER') or hasRole('ADMIN')")
    public ResponseEntity<VocabularyImageBatchGenerateResponse> generate(@RequestBody(required = false) VocabularyImageBatchGenerateRequest request,
                                                                          @RequestParam(defaultValue = "20") int limit,
                                                                          @RequestParam(required = false) String cefr,
                                                                          @RequestParam(required = false) String dtype,
                                                                          @RequestParam(required = false) String tag,
                                                                          @RequestParam(defaultValue = "DEFAULT") String personaStyle,
                                                                          @AuthenticationPrincipal User user) {
        int effectiveLimit = request != null && request.limit() != null ? request.limit() : limit;
        String effectivePersonaStyle = request != null && request.personaStyle() != null ? request.personaStyle() : personaStyle;
        String effectiveCefr = request != null && request.cefr() != null ? request.cefr() : cefr;
        String effectiveDtype = request != null && request.dtype() != null ? request.dtype() : dtype;
        String effectiveTag = request != null && request.tag() != null ? request.tag() : tag;
        List<Long> approvedWordIds = request != null ? request.approvedWordIds() : null;
        int created = batchService.generateBatch(effectiveLimit, effectivePersonaStyle, effectiveCefr, effectiveDtype, effectiveTag, approvedWordIds);
        return ResponseEntity.ok(new VocabularyImageBatchGenerateResponse(
                effectiveLimit,
                effectivePersonaStyle,
                created,
                batchService.countMissingImages(effectiveCefr, effectiveDtype, effectiveTag)
        ));
    }
}
