package com.deutschflow.speaking.ai;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Text-to-Speech via a self-hosted Edge TTS sidecar (free Microsoft Neural voices).
 * <p>
 * Returns MP3 audio bytes; results are cached 24h in "ttsAudio". When no sidecar is
 * configured (or it is unreachable) {@code synthesize} returns {@code null} and the
 * frontend falls back to on-device speech.
 * <p>
 * Premium/cloud voice providers are intentionally NOT integrated here — point
 * {@code app.ai.edge-tts.url} at your own TTS service.
 */
@Slf4j
@Service
public class EdgeTtsService {

    @Value("${app.ai.edge-tts.url:}")
    private String edgeTtsUrl;

    private final RestTemplate restTemplate = new RestTemplate();

    // ─── Usage tracking (in-memory, resets on restart) ────────────────────
    private final AtomicLong totalRequests   = new AtomicLong(0);
    private final AtomicLong totalCharsSent  = new AtomicLong(0);
    private final AtomicLong totalErrors     = new AtomicLong(0);
    private final AtomicLong totalAudioBytes = new AtomicLong(0);
    private volatile Instant firstRequestAt  = null;
    private volatile Instant lastRequestAt   = null;

    /** True when an Edge TTS sidecar URL is configured. */
    public boolean isConfigured() {
        return edgeTtsUrl != null && !edgeTtsUrl.isBlank();
    }

    /**
     * Synthesize German speech for a persona. Cached 24h by (text, persona) — the same
     * text+persona always yields identical audio.
     *
     * @param text        German text to speak
     * @param personaName e.g. "LUKAS", "EMMA", "KLAUS"
     * @return MP3 audio bytes, or {@code null} when not configured / on failure
     */
    @Cacheable(value = "ttsAudio", key = "T(java.util.Objects).hash(#text, #personaName)",
               unless = "#result == null")
    public byte[] synthesize(String text, String personaName) {
        if (text == null || text.isBlank()) return null;
        if (!isConfigured()) {
            log.debug("Edge TTS URL not configured — no server TTS available");
            return null;
        }

        String safeText = text.length() > 2000 ? text.substring(0, 2000) : text;
        String persona = (personaName != null && !personaName.isBlank()) ? personaName.toUpperCase() : "DEFAULT";

        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.set("Accept", "audio/mpeg");

            Map<String, String> body = Map.of("text", safeText, "persona", persona);
            HttpEntity<Map<String, String>> request = new HttpEntity<>(body, headers);

            log.info("[Edge TTS] cache miss — calling sidecar. persona='{}' chars={}", persona, safeText.length());

            ResponseEntity<byte[]> response = restTemplate.exchange(
                edgeTtsUrl + "/tts", HttpMethod.POST, request, byte[].class);

            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                byte[] audio = response.getBody();
                recordSuccess(safeText.length(), audio.length);
                log.info("[Edge TTS] ✅ {} bytes for '{}' ({} chars)", audio.length, persona, safeText.length());
                return audio;
            }
            recordError();
            log.warn("[Edge TTS] Unexpected status {} for '{}'", response.getStatusCode(), persona);
            return null;
        } catch (Exception e) {
            recordError();
            log.warn("[Edge TTS] Synthesis failed for '{}': {}", persona, e.getMessage());
            return null;
        }
    }

    // ─── Usage tracking ───────────────────────────────────────────────────

    private void recordSuccess(int chars, long audioBytes) {
        Instant now = Instant.now();
        totalRequests.incrementAndGet();
        totalCharsSent.addAndGet(chars);
        totalAudioBytes.addAndGet(audioBytes);
        if (firstRequestAt == null) firstRequestAt = now;
        lastRequestAt = now;
    }

    private void recordError() {
        totalErrors.incrementAndGet();
        totalRequests.incrementAndGet();
    }

    /** Usage statistics for the TTS status endpoint. */
    public Map<String, Object> getUsageStats() {
        Map<String, Object> stats = new LinkedHashMap<>();
        stats.put("provider", "edge-tts");
        stats.put("configured", isConfigured());
        stats.put("edgeTtsUrl", edgeTtsUrl);
        stats.put("totalRequests", totalRequests.get());
        stats.put("totalCharsSent", totalCharsSent.get());
        stats.put("totalErrors", totalErrors.get());
        stats.put("totalAudioBytes", totalAudioBytes.get());
        stats.put("firstRequestAt", firstRequestAt != null ? firstRequestAt.toString() : null);
        stats.put("lastRequestAt", lastRequestAt != null ? lastRequestAt.toString() : null);
        return stats;
    }
}
