package com.deutschflow.speaking.tts;

/**
 * A resolved XTTS voice for a persona: the server-side {@code voice_id} plus the per-voice synthesis
 * preset (research-tuned). Sent on each {@code /v1/text-to-speech/{voiceId}/stream} call.
 *
 * @param voiceId           XTTS server voice id (e.g. {@code de-lukas_man})
 * @param speed             speech rate (XTTS honors this on the stream endpoint)
 * @param temperature       sampling temperature (lower = steadier; honored after server R1)
 * @param repetitionPenalty anti-repeat penalty (higher for deep voices; honored after server R1)
 * @param language          XTTS {@code language_code} (e.g. {@code de})
 */
public record XttsVoice(
        String voiceId,
        double speed,
        double temperature,
        double repetitionPenalty,
        String language) {
}
