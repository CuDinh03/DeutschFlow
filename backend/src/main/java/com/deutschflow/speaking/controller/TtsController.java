package com.deutschflow.speaking.controller;

import com.deutschflow.speaking.ai.EdgeTtsService;
import com.deutschflow.speaking.dto.TtsRequest;
import com.deutschflow.speaking.dto.TtsStatusDto;
import com.deutschflow.user.entity.User;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

/**
 * REST controller for Text-to-Speech synthesis (self-hosted Edge TTS sidecar).
 * <p>
 * Client cascade:
 * 1. This endpoint (Edge TTS) — requires an {@code app.ai.edge-tts.url} sidecar
 * 2. On-device / browser speech — universal fallback (when this returns 503)
 */
@Slf4j
@RestController
@RequestMapping("/api/ai-speaking")
@RequiredArgsConstructor
public class TtsController {

    private static final int TTS_MAX_TEXT_LENGTH = 500;

    private final EdgeTtsService ttsService;

    /**
     * POST /api/ai-speaking/tts
     * Body: { "text": "Hallo, wie geht es dir?", "persona": "LUKAS" }
     * Returns: audio/mpeg bytes (MP3)
     *
     * Returns 503 when no Edge TTS sidecar is configured/reachable — clients fall
     * back to on-device speech automatically.
     */
    @PostMapping("/tts")
    @PreAuthorize("isAuthenticated()")
    @ApiResponse(responseCode = "200", content = @Content(
            mediaType = "audio/mpeg",
            schema = @Schema(type = "string", format = "binary")))
    public ResponseEntity<byte[]> synthesize(
            @RequestBody TtsRequest body,
            @AuthenticationPrincipal User user) {

        String text = body.text() != null ? body.text() : "";
        String persona = body.persona() != null ? body.persona() : "DEFAULT";

        if (text.isBlank()) {
            return ResponseEntity.badRequest().build();
        }
        if (text.length() > TTS_MAX_TEXT_LENGTH) {
            log.warn("[TTS] Rejected oversized text ({} chars) from user {}", text.length(), user != null ? user.getId() : "unknown");
            return ResponseEntity.badRequest().build();
        }

        byte[] audio = ttsService.synthesize(text, persona);
        if (audio == null || audio.length == 0) {
            // Not configured (no Edge TTS sidecar / unreachable) — clients fall back
            // to on-device speech. Documented 503 contract.
            log.debug("[TTS] No audio for persona '{}' (provider not configured) — returning 503", persona);
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).build();
        }

        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType("audio/mpeg"))
                .cacheControl(CacheControl.noCache())
                .body(audio);
    }

    /**
     * GET /api/ai-speaking/tts/status
     * Returns TTS configuration status + Edge TTS usage statistics.
     * Available to all authenticated users (used by admin dashboard).
     */
    @GetMapping("/tts/status")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<TtsStatusDto> status() {
        return ResponseEntity.ok(TtsStatusDto.from(ttsService.getUsageStats()));
    }
}
