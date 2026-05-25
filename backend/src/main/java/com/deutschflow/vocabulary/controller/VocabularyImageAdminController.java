package com.deutschflow.vocabulary.controller;

import com.deutschflow.user.entity.User;
import com.deutschflow.vocabulary.dto.WordImageUpdateRequest;
import com.deutschflow.vocabulary.service.VocabularyImageBatchService;
import com.deutschflow.vocabulary.service.VocabularyImageService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v2/admin/vocabulary/images")
@RequiredArgsConstructor
public class VocabularyImageAdminController {

    private final VocabularyImageService vocabularyImageService;
    private final VocabularyImageBatchService batchService;

    @PostMapping("/{wordId}/override")
    @PreAuthorize("hasRole('TEACHER') or hasRole('ADMIN')")
    public ResponseEntity<Map<String, String>> overrideImage(
            @PathVariable long wordId,
            @RequestBody WordImageUpdateRequest request,
            @AuthenticationPrincipal User user) {
        vocabularyImageService.overrideImage(wordId, request);
        return ResponseEntity.ok(Map.of("status", "ok"));
    }

    @GetMapping("/missing-count")
    @PreAuthorize("hasRole('TEACHER') or hasRole('ADMIN')")
    public ResponseEntity<Map<String, Integer>> missingCount() {
        return ResponseEntity.ok(Map.of("count", batchService.countMissingImages()));
    }
}
