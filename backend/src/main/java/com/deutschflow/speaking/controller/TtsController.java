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
    public DeferredResult<ResponseEntity<byte[]>> synthesize(
            @RequestBody Map<String, String> body,
            @AuthenticationPrincipal User user) {

        DeferredResult<ResponseEntity<byte[]>> result = new DeferredResult<>(15_000L,
                ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).<byte[]>body(null));

        String text = body.getOrDefault("text", "");
        String persona = body.getOrDefault("persona", "DEFAULT");

        if (text.isBlank()) {
            result.setResult(ResponseEntity.badRequest().build());
            return result;
        }

        if (!ttsService.isConfigured()) {
            log.debug("[TTS] ElevenLabs not configured — returning 503 for frontend fallback");
            result.setResult(ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(null));
            return result;
        }

        // Dispatch to AI executor — frees Tomcat thread immediately
        doSynthesize(text, persona, result);
        return result;
    }

    @Async("aiExecutor")
    protected void doSynthesize(String text, String persona, DeferredResult<ResponseEntity<byte[]>> result) {
        try {
            byte[] audio = ttsService.synthesize(text, persona);
            if (audio == null || audio.length == 0) {
                result.setResult(ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(null));
                return;
            }
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.parseMediaType("audio/mpeg"));
            headers.setContentLength(audio.length);
            headers.setCacheControl(CacheControl.noCache());
            result.setResult(new ResponseEntity<>(audio, headers, HttpStatus.OK));
        } catch (Exception ex) {
            log.warn("[TTS] Synthesis error: {}", ex.getMessage());
            result.setResult(ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(null));
        }
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
