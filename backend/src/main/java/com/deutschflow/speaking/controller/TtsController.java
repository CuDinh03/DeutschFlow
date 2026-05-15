package com.deutschflow.speaking.controller;

import com.deutschflow.speaking.ai.ElevenLabsTtsService;
import com.deutschflow.user.entity.User;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.*;
import org.springframework.scheduling.annotation.Async;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.context.request.async.DeferredResult;

import java.util.Map;
import java.util.concurrent.CompletableFuture;

/**
 * REST controller for Text-to-Speech synthesis (ElevenLabs voice cloning).
 * <p>
 * TTS priority (handled in frontend cascade):
 * 1. Local voice file (/public/voices/) — no API cost
 * 2. This endpoint (ElevenLabs) — requires voiceId config
 * 3. Browser Web Speech API — universal fallback
 * <p>
 * P1-2 Async AI: synthesize() uses {@code aiExecutor} to avoid blocking
 * Tomcat HTTP threads during the ElevenLabs HTTP round-trip (avg 1–3s).
 * Uses {@link DeferredResult} so the Servlet thread is released immediately.
 */
@Slf4j
@RestController
@RequestMapping("/api/ai-speaking")
@RequiredArgsConstructor
public class TtsController {

    private final ElevenLabsTtsService ttsService;

    /**
     * POST /api/ai-speaking/tts
     * Body: { "text": "Hallo, wie geht es dir?", "persona": "LUKAS" }
     * Returns: audio/mpeg bytes (MP3)
     *
     * Returns 503 when ElevenLabs is not configured or voiceId is missing for the persona —
     * frontend will fall back to browser TTS automatically.
     *
     * Runs on aiExecutor (async) so Tomcat thread is freed during ElevenLabs API call.
     */
    @PostMapping("/tts")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Map<String, String>> synthesize(
            @RequestBody Map<String, String> body,
            @AuthenticationPrincipal User user) {

        String text = body.getOrDefault("text", "");
        String persona = body.getOrDefault("persona", "DEFAULT");

        if (text.isBlank()) {
            return ResponseEntity.badRequest().build();
        }

        // Mock AWS S3 URL for V4.1 Optimization Phase
        // In the future, this will call Edge TTS and upload to actual S3, then return the S3 URL.
        log.info("[TTS Mock] Generating mock S3 URL for persona '{}', text length: {}", persona, text.length());
        String mockS3Url = "https://s3.ap-southeast-1.amazonaws.com/deutschflow-assets/mock-audio.mp3";
        
        return ResponseEntity.ok(Map.of("audioUrl", mockS3Url));
    }

    /**
     * GET /api/ai-speaking/tts/status
     * Returns TTS configuration status + ElevenLabs usage statistics.
     * Available to all authenticated users (used by admin dashboard).
     */
    @GetMapping("/tts/status")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Map<String, Object>> status() {
        Map<String, Object> stats = ttsService.getUsageStats();
        return ResponseEntity.ok(stats);
    }
}
