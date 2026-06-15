package com.deutschflow.speaking.tts;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Connection config for the self-hosted XTTS Streaming Voice Server (per-sentence streaming TTS).
 *
 * <p>{@code base-url} empty → streaming TTS is disabled and the speaking stream simply omits
 * {@code audio} events (clients keep their existing on-device / edge-tts fallback). Persona→voice
 * mapping and per-voice presets live in {@link XttsPersonaVoiceResolver} (code, enum-parity tested),
 * not here.
 */
@Getter
@Setter
@ConfigurationProperties(prefix = "app.ai.xtts")
public class XttsProperties {

    /** Base URL of the XTTS server (dev: ngrok; prod: fixed host). Empty disables streaming TTS. */
    private String baseUrl = "";

    /** Connect timeout (ms). Streaming TTS is on the speaking hot path — fail fast. */
    private int connectTimeoutMs = 3000;

    /** Read timeout (ms) for a single-sentence synthesis. */
    private int readTimeoutMs = 15000;

    /** Send the {@code ngrok-skip-browser-warning} header (harmless on a non-ngrok host). */
    private boolean ngrokSkipWarning = true;

    /** Fixed XTTS seed for stable, reproducible voice output. */
    private int seed = 420;

    /** True when a base URL is configured (streaming TTS enabled). */
    public boolean isConfigured() {
        return baseUrl != null && !baseUrl.isBlank();
    }
}
