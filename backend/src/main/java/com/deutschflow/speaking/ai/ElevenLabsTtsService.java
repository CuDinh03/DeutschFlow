package com.deutschflow.speaking.ai;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.time.Instant;
import java.util.Map;
import java.util.concurrent.atomic.AtomicLong;

/**
 * ElevenLabs Text-to-Speech client with usage tracking.
 * <p>
 * Priority in TTS cascade:
 * 1. Local voice file (served from /public/voices/) — frontend handles this
 * 2. ElevenLabs API (this service) — requires voiceId in config
 * 3. Browser Web Speech API — frontend fallback
 * <p>
 * Usage tracking: counts characters sent to ElevenLabs per session.
 * ElevenLabs Free plan: 10,000 chars/month. Starter: 30,000 chars/month.
 */
@Slf4j
@Service
public class ElevenLabsTtsService {

    private static final String BASE_URL = "https://api.elevenlabs.io/v1/text-to-speech";

    @Value("${app.ai.elevenlabs.api-key:}")
    private String apiKey;

    @Value("${app.ai.elevenlabs.model-id:eleven_multilingual_v2}")
    private String modelId;

    @Value("${app.ai.elevenlabs.voices.LUKAS:}")
    private String voiceLukas;

    @Value("${app.ai.elevenlabs.voices.EMMA:}")
    private String voiceEmma;

    @Value("${app.ai.elevenlabs.voices.ANNA:}")
    private String voiceAnna;

    @Value("${app.ai.elevenlabs.voices.HANNA:}")
    private String voiceHanna;

    @Value("${app.ai.elevenlabs.voices.KLAUS:}")
    private String voiceKlaus;

    private Map<String, String> getVoiceMap() {
        Map<String, String> map = new java.util.HashMap<>();
        if (voiceLukas != null && !voiceLukas.isBlank()) map.put("LUKAS", voiceLukas);
        if (voiceEmma != null && !voiceEmma.isBlank()) map.put("EMMA", voiceEmma);
        if (voiceAnna != null && !voiceAnna.isBlank()) map.put("ANNA", voiceAnna);
        if (voiceHanna != null && !voiceHanna.isBlank()) map.put("HANNA", voiceHanna);
        if (voiceKlaus != null && !voiceKlaus.isBlank()) map.put("KLAUS", voiceKlaus);
        return map;
    }

    // ─── Usage tracking (in-memory, resets on restart) ────────────────────
    private final AtomicLong totalRequests    = new AtomicLong(0);
    private final AtomicLong totalCharsSent   = new AtomicLong(0);
    private final AtomicLong totalErrors      = new AtomicLong(0);
    private final AtomicLong totalAudioBytes  = new AtomicLong(0);
    private volatile Instant firstRequestAt   = null;
    private volatile Instant lastRequestAt    = null;

    private final RestTemplate restTemplate = new RestTemplate();

    /**
     * Returns true if ElevenLabs TTS is properly configured.
     */
    public boolean isConfigured() {
        return apiKey != null && !apiKey.isBlank() && !getVoiceMap().isEmpty();
    }

    /**
     * Returns the ElevenLabs voice ID for a given persona name.
     */
    public String resolveVoiceId(String personaName) {
        if (personaName == null) return null;
        String voiceId = getVoiceMap().get(personaName.toUpperCase());
        if (voiceId == null || voiceId.isBlank()) {
            log.debug("No ElevenLabs voice ID for persona '{}' — falling back to local/browser TTS", personaName);
            return null;
        }
        return voiceId;
    }

    /**
     * Synthesizes speech using ElevenLabs voice cloning.
     *
     * <p>Results are cached in "ttsAudio" (Caffeine, 24h, max 500 entries ≈ 30MB RAM).
     * Cache key is based on hash of text+persona — same text+persona always produces
     * identical audio bytes from ElevenLabs.
     *
     * @param text        German text to speak
     * @param personaName e.g. "LUKAS", "EMMA", "KLAUS"
     * @return MP3 audio bytes, or null on failure/not-configured
     */
    @Cacheable(value = "ttsAudio", key = "T(java.util.Objects).hash(#text, #personaName)",
               unless = "#result == null")
    public byte[] synthesize(String text, String personaName) {
        if (!isConfigured()) {
            log.debug("ElevenLabs not configured — skipping");
            return null;
        }

        String voiceId = resolveVoiceId(personaName);
        if (voiceId == null) {
            log.info("No voiceId for '{}' — local file or browser TTS will handle it", personaName);
            return null;
        }

        if (text == null || text.isBlank()) return null;

        // Truncate to avoid excessive cost (ElevenLabs charges per character)
        String safeText = text.length() > 2000 ? text.substring(0, 2000) : text;
        int charCount = safeText.length();

        String url = BASE_URL + "/" + voiceId;

        try {
            HttpHeaders headers = new HttpHeaders();
            headers.set("xi-api-key", apiKey);
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.set("Accept", "audio/mpeg");

            Map<String, Object> body = Map.of(
                "text", safeText,
                "model_id", modelId,
                "voice_settings", Map.of(
                    "stability", 0.5,
                    "similarity_boost", 0.85,
                    "style", 0.0,
                    "use_speaker_boost", true
                )
            );

            HttpEntity<Map<String, Object>> request = new HttpEntity<>(body, headers);

            log.info("[ElevenLabs TTS] cache miss — calling API. persona='{}' voiceId='{}' chars={}", personaName, voiceId, charCount);

            ResponseEntity<byte[]> response = restTemplate.exchange(
                url, HttpMethod.POST, request, byte[].class
            );

            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                byte[] audio = response.getBody();
                // Record usage
                recordSuccess(charCount, audio.length);
                log.info("[ElevenLabs TTS] ✅ {} bytes audio for '{}' ({} chars)", audio.length, personaName, charCount);
                return audio;
            } else {
                recordError();
                log.warn("[ElevenLabs TTS] Unexpected status {} for '{}'", response.getStatusCode(), personaName);
                return null;
            }
        } catch (Exception e) {
            recordError();
            log.error("[ElevenLabs TTS] Synthesis failed for '{}': {}", personaName, e.getMessage());
            return null;
        }
    }

    // ─── Usage Tracking ───────────────────────────────────────────────────

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

    /**
     * Returns usage statistics for admin dashboard / TTS status endpoint.
     */
    public Map<String, Object> getUsageStats() {
        boolean configured = isConfigured();
        Map<String, String> currentVoiceMap = getVoiceMap();

        // Count configured voices
        int configuredVoices = 0;
        for (var entry : currentVoiceMap.entrySet()) {
            if (entry.getValue() != null && !entry.getValue().isBlank()) {
                configuredVoices++;
            }
        }

        Map<String, Object> stats = new java.util.LinkedHashMap<>();
        stats.put("configured", configured);
        stats.put("modelId", modelId != null ? modelId : "eleven_multilingual_v2");
        stats.put("configuredVoices", configuredVoices);
        stats.put("totalVoiceSlots", 5);
        stats.put("totalRequests", totalRequests.get());
        stats.put("totalCharsSent", totalCharsSent.get());
        stats.put("totalErrors", totalErrors.get());
        stats.put("totalAudioBytes", totalAudioBytes.get());
        stats.put("firstRequestAt", firstRequestAt != null ? firstRequestAt.toString() : null);
        stats.put("lastRequestAt", lastRequestAt != null ? lastRequestAt.toString() : null);
        stats.put("estimatedMonthlyCharLimit", 10000);
        
        return stats;
    }
}
