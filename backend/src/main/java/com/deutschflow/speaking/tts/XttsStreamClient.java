package com.deutschflow.speaking.tts;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Per-sentence client for the XTTS Streaming Voice Server.
 *
 * <p>{@link #synthesize} sends one completed sentence to
 * {@code POST /v1/text-to-speech/{voiceId}/stream} and returns the raw PCM bytes
 * ({@code s16le / 24000 Hz / mono}). Returns {@code null} when streaming TTS is disabled
 * (no {@code base-url}) or on any failure — the caller then simply skips the {@code audio}
 * event so the text stream is never disrupted.
 *
 * <p>Always sends {@code ngrok-skip-browser-warning} (harmless on a non-ngrok host). Per-voice
 * {@code speed}/{@code temperature}/{@code repetition_penalty} come from {@link XttsVoice}
 * (server honors them after the R1 upgrade); {@code enable_text_splitting=false} because we split
 * sentences ourselves; {@code previous_text} carries the prior sentence for prosody continuity.
 */
@Slf4j
@Service
public class XttsStreamClient {

    private static final String NGROK_HEADER = "ngrok-skip-browser-warning";

    private final XttsProperties props;
    private final RestTemplate restTemplate;

    public XttsStreamClient(XttsProperties props, @Qualifier("xttsRestTemplate") RestTemplate restTemplate) {
        this.props = props;
        this.restTemplate = restTemplate;
    }

    /** True when an XTTS base URL is configured (streaming TTS enabled). */
    public boolean isConfigured() {
        return props.isConfigured();
    }

    /**
     * Synthesize one sentence to PCM16 bytes, or {@code null} when disabled / invalid input / failure.
     *
     * @param voice        resolved persona voice (id + preset)
     * @param text         a single completed sentence
     * @param previousText prior sentence for prosody continuity (nullable)
     */
    public byte[] synthesize(XttsVoice voice, String text, String previousText) {
        if (!isConfigured() || voice == null || text == null || text.isBlank()) {
            return null;
        }
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.setAccept(List.of(MediaType.parseMediaType("audio/L16"), MediaType.APPLICATION_OCTET_STREAM));
            if (props.isNgrokSkipWarning()) {
                headers.set(NGROK_HEADER, "true");
            }

            Map<String, Object> voiceSettings = new LinkedHashMap<>();
            voiceSettings.put("speed", voice.speed());

            Map<String, Object> body = new LinkedHashMap<>();
            body.put("text", text);
            body.put("language_code", voice.language());
            body.put("seed", props.getSeed());
            body.put("temperature", voice.temperature());
            body.put("repetition_penalty", voice.repetitionPenalty());
            body.put("voice_settings", voiceSettings);
            body.put("enable_text_splitting", false);
            if (previousText != null && !previousText.isBlank()) {
                body.put("previous_text", previousText);
            }

            String url = baseUrl() + "/v1/text-to-speech/" + voice.voiceId() + "/stream";
            ResponseEntity<byte[]> response =
                    restTemplate.exchange(url, HttpMethod.POST, new HttpEntity<>(body, headers), byte[].class);

            byte[] pcm = response.getBody();
            if (response.getStatusCode().is2xxSuccessful() && pcm != null && pcm.length > 0) {
                return pcm;
            }
            log.warn("[XTTS] non-2xx/empty audio for voice '{}': {}", voice.voiceId(), response.getStatusCode());
            return null;
        } catch (Exception e) {
            log.warn("[XTTS] synthesis failed for voice '{}': {}", voice.voiceId(), e.getMessage());
            return null;
        }
    }

    private String baseUrl() {
        String b = props.getBaseUrl().trim();
        return b.endsWith("/") ? b.substring(0, b.length() - 1) : b;
    }
}
