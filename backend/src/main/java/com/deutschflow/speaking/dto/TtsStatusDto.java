package com.deutschflow.speaking.dto;

import java.util.Map;

/**
 * Status + usage stats for the self-hosted Edge TTS sidecar ({@code GET /api/ai-speaking/tts/status}).
 * Mirrors the legacy {@code EdgeTtsService#getUsageStats()} map 1:1 (keys + order) so the JSON stays
 * byte-identical. {@code edgeTtsUrl} may be empty and {@code firstRequestAt}/{@code lastRequestAt} are
 * nullable ISO-8601 strings (kept, not omitted, when null).
 */
public record TtsStatusDto(
        String provider,
        boolean configured,
        String edgeTtsUrl,
        long totalRequests,
        long totalCharsSent,
        long totalErrors,
        long totalAudioBytes,
        String firstRequestAt,
        String lastRequestAt) {

    /** Build from the raw {@code getUsageStats()} map (counters are {@code Long}, timestamps {@code String|null}). */
    public static TtsStatusDto from(Map<String, Object> stats) {
        return new TtsStatusDto(
                (String) stats.get("provider"),
                Boolean.TRUE.equals(stats.get("configured")),
                (String) stats.get("edgeTtsUrl"),
                ((Number) stats.get("totalRequests")).longValue(),
                ((Number) stats.get("totalCharsSent")).longValue(),
                ((Number) stats.get("totalErrors")).longValue(),
                ((Number) stats.get("totalAudioBytes")).longValue(),
                (String) stats.get("firstRequestAt"),
                (String) stats.get("lastRequestAt"));
    }
}
