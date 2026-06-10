package com.deutschflow.phoneme.controller;

import com.deutschflow.phoneme.dto.PhonemeEvalResponse;
import com.deutschflow.phoneme.service.PhonemeService;
import com.deutschflow.user.entity.User;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

/**
 * REST API for Phoneme Coach (pronunciation evaluation).
 *
 * <h3>Endpoints:</h3>
 * <ul>
 *   <li>POST /api/phoneme/evaluate — Upload audio + target text → pronunciation score</li>
 * </ul>
 *
 * <p>Audio size limit: configured via Spring's multipart.max-file-size (default 10MB).
 * Typical WebM recording: ~30-100KB/10s — well within limits.</p>
 */
@RestController
@RequestMapping("/api/phoneme")
@RequiredArgsConstructor
@Slf4j
@PreAuthorize("isAuthenticated()")
public class PhonemeController {

    private final PhonemeService phonemeService;
    private final com.deutschflow.speaking.AiRateLimiterService aiRateLimiterService;

    @org.springframework.beans.factory.annotation.Value("${app.ai.transcribe.max-bytes:8388608}")
    private long transcribeMaxBytes;

    /**
     * POST /api/phoneme/evaluate
     * <p>
     * Form fields:
     * <ul>
     *   <li>{@code audio} — audio file (WebM, WAV, MP3)</li>
     *   <li>{@code target} — expected German text for comparison</li>
     * </ul>
     */
    @PostMapping(value = "/evaluate", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<PhonemeEvalResponse> evaluate(
            @RequestPart("audio") MultipartFile audioFile,
            @RequestParam("target") String target,
            @AuthenticationPrincipal User user) {

        if (!aiRateLimiterService.allow(com.deutschflow.speaking.AiRateLimiterService.Bucket.PHONEME, user.getId())) {
            throw new com.deutschflow.common.exception.RateLimitExceededException(
                    "Too many pronunciation checks. Please slow down.",
                    aiRateLimiterService.retryAfterSeconds(com.deutschflow.speaking.AiRateLimiterService.Bucket.PHONEME));
        }
        if (audioFile.isEmpty()) {
            return ResponseEntity.badRequest().build();
        }
        if (!com.deutschflow.speaking.util.TranscribeUploads.isAllowedAudioContentType(audioFile.getContentType())
                || audioFile.getSize() > transcribeMaxBytes) {
            return ResponseEntity.badRequest().build();
        }

        try {
            byte[] bytes = audioFile.getBytes();
            String filename = audioFile.getOriginalFilename() != null
                    ? audioFile.getOriginalFilename()
                    : "recording.webm";

            log.info("[Phoneme] user={} target='{}' audioSize={}B", user.getId(), target, bytes.length);
            PhonemeEvalResponse result = phonemeService.evaluate(bytes, filename, target, user.getId());
            return ResponseEntity.ok(result);

        } catch (Exception e) {
            log.error("[Phoneme] Evaluation failed for user {}: {}", user.getId(), e.getMessage());
            return ResponseEntity.internalServerError().build();
        }
    }
}
