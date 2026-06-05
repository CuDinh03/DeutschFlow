package com.deutschflow.vocabulary.controller;

import com.deutschflow.aiimage.service.UnsplashImageService;
import com.deutschflow.media.entity.MediaAsset;
import com.deutschflow.user.entity.User;
import com.deutschflow.vocabulary.dto.UnsplashAttachRequest;
import com.deutschflow.vocabulary.dto.WordImageUpdateRequest;
import com.deutschflow.vocabulary.service.VocabularyImageBatchService;
import com.deutschflow.vocabulary.service.VocabularyImageGeneratorService;
import com.deutschflow.vocabulary.service.VocabularyImageService;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.net.URI;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v2/admin/vocabulary/images")
@RequiredArgsConstructor
public class VocabularyImageAdminController {

    private final VocabularyImageService vocabularyImageService;
    private final VocabularyImageBatchService batchService;
    private final VocabularyImageGeneratorService imageGeneratorService;
    /** Optional: the Unsplash bean only exists when {@code unsplash.enabled=true}. */
    private final ObjectProvider<UnsplashImageService> unsplashProvider;

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

    /** Interactive Unsplash search so an admin can pick an image for a word manually. */
    @GetMapping("/unsplash/search")
    @PreAuthorize("hasRole('TEACHER') or hasRole('ADMIN')")
    public ResponseEntity<List<UnsplashImageService.UnsplashImageResult>> searchUnsplash(
            @RequestParam String q,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "12") int perPage) {
        UnsplashImageService unsplash = unsplashProvider.getIfAvailable();
        if (unsplash == null) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Unsplash is not configured");
        }
        if (q == null || q.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Query 'q' is required");
        }
        int safePerPage = Math.min(Math.max(perPage, 1), 30);
        return ResponseEntity.ok(unsplash.search(q.trim(), Math.max(page, 1), safePerPage));
    }

    /** Download the chosen Unsplash image to S3 and set it as the word's image. */
    @PostMapping("/{wordId}/unsplash")
    @PreAuthorize("hasRole('TEACHER') or hasRole('ADMIN')")
    public ResponseEntity<Map<String, String>> attachUnsplash(
            @PathVariable long wordId,
            @RequestBody UnsplashAttachRequest request) {
        if (request == null || request.imageUrl() == null || request.imageUrl().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "imageUrl is required");
        }
        requireUnsplashHost(request.imageUrl());
        String baseForm = (request.baseForm() != null && !request.baseForm().isBlank())
                ? request.baseForm()
                : "word-" + wordId;
        MediaAsset asset = imageGeneratorService.generateFromUrl(
                wordId, baseForm, request.imageUrl(), "manual-unsplash", "Manual Unsplash selection");
        return ResponseEntity.ok(Map.of("imageUrl", asset.getUrl()));
    }

    /** SSRF guard: only allow downloads from Unsplash hosts (the chosen URL comes from our search). */
    private void requireUnsplashHost(String url) {
        String host;
        try {
            host = URI.create(url).getHost();
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid image URL");
        }
        if (host == null || !(host.equals("unsplash.com") || host.endsWith(".unsplash.com"))) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Only Unsplash image URLs are allowed");
        }
    }
}
