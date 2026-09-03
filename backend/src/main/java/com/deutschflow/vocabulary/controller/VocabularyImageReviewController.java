package com.deutschflow.vocabulary.controller;

import com.deutschflow.common.audit.AuditActor;
import com.deutschflow.common.audit.AuditLogService;
import com.deutschflow.media.entity.MediaAsset;
import com.deutschflow.user.entity.User;
import com.deutschflow.vocabulary.dto.VocabularyImageReviewDecisionRequest;
import com.deutschflow.vocabulary.dto.VocabularyImageReviewResponse;
import com.deutschflow.vocabulary.service.VocabularyImageReviewService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v2/admin/vocabulary/images/review")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class VocabularyImageReviewController {

    private final VocabularyImageReviewService reviewService;
    private final AuditLogService auditLogService;

    /** Số ứng viên ảnh tối đa một lượt review — chặn quét Unsplash bằng limit khổng lồ. */
    private static final int MAX_REVIEW_LIMIT = 30;

    @GetMapping("/{wordId}")
    public ResponseEntity<VocabularyImageReviewResponse> review(
            @PathVariable long wordId,
            @RequestParam(defaultValue = "8") int limit,
            @AuthenticationPrincipal User user) {
        int safeLimit = Math.min(Math.max(limit, 1), MAX_REVIEW_LIMIT);
        return ResponseEntity.ok(reviewService.review(wordId, safeLimit));
    }

    @PostMapping("/{wordId}/approve")
    public ResponseEntity<MediaAsset> approve(
            @PathVariable long wordId,
            @RequestBody VocabularyImageReviewDecisionRequest request,
            @AuthenticationPrincipal User user) {
        MediaAsset asset = reviewService.applyDecision(wordId, request);
        // Audit R-M4 (03/09/2026): duyệt ảnh là bước đưa ảnh minh hoạ ra người học thật — cùng loại
        // quyết định "publish content" mà grammar/moderation đã ghi vết ở B4b, nhưng nhánh ảnh từ
        // vựng bị bỏ sót.
        auditLogService.log("admin.vocabulary.image.reviewed", AuditActor.of(user),
                "VOCABULARY", String.valueOf(wordId),
                Map.of("decision", request == null || request.decision() == null ? "" : request.decision()));
        return ResponseEntity.ok(asset);
    }
}
