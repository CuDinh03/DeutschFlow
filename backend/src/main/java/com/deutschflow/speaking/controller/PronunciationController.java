package com.deutschflow.speaking.controller;

import com.deutschflow.speaking.service.PronunciationScorerService;
import com.deutschflow.speaking.service.PronunciationScorerService.PronunciationScore;
import com.deutschflow.user.entity.User;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;

/**
 * POST /api/speaking/pronunciation-check
 *
 * Accepts a multipart audio file + expected text, returns per-word pronunciation scores.
 */
@RestController
@RequestMapping("/api/speaking")
@RequiredArgsConstructor
public class PronunciationController {

    private final PronunciationScorerService scorerService;
    // Audit R-B7: endpoint gọi Whisper STT y như /transcribe → phải gate như /transcribe.
    private final com.deutschflow.speaking.AiRateLimiterService aiRateLimiterService;
    private final com.deutschflow.common.quota.QuotaService quotaService;
    private final com.deutschflow.organization.service.OrgPoolGuard orgPoolGuard;

    private static final long STT_ESTIMATED_TOKENS = 200L;

    @org.springframework.beans.factory.annotation.Value("${app.ai.transcribe.max-bytes:8388608}")
    private long transcribeMaxBytes;

    @PostMapping("/pronunciation-check")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<PronunciationScore> check(
            @AuthenticationPrincipal User user,
            @RequestPart("audio") MultipartFile audio,
            @RequestPart("expectedText") @NotBlank @Size(max = 500) String expectedText) throws IOException {

        // R-B7: quota ví + pool org (endpoint tốn Whisper) + rate-limit per-user (bucket PHONEME).
        quotaService.assertAllowed(user.getId(), java.time.Instant.now(), STT_ESTIMATED_TOKENS);
        orgPoolGuard.assertOrgPoolAvailable(user.getId(), STT_ESTIMATED_TOKENS);
        if (!aiRateLimiterService.allow(com.deutschflow.speaking.AiRateLimiterService.Bucket.PHONEME, user.getId())) {
            throw new com.deutschflow.common.exception.RateLimitExceededException(
                    "Too many pronunciation checks. Please slow down.",
                    aiRateLimiterService.retryAfterSeconds(
                            com.deutschflow.speaking.AiRateLimiterService.Bucket.PHONEME, user.getId()));
        }
        // Cap size + content-type TRƯỚC getBytes() — nếu không, tối đa 25MB (trần multipart) đã vào heap.
        if (!com.deutschflow.speaking.util.TranscribeUploads.isAllowedAudioContentType(audio.getContentType())
                || audio.getSize() > transcribeMaxBytes) {
            return ResponseEntity.badRequest().build();
        }

        byte[] bytes = audio.getBytes();
        if (bytes.length == 0) {
            return ResponseEntity.badRequest().build();
        }

        PronunciationScore result = scorerService.score(bytes, expectedText, user.getId());
        return ResponseEntity.ok(result);
    }
}
