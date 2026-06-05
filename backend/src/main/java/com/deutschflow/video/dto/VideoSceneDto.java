package com.deutschflow.video.dto;

/**
 * One scene of a learning-video timeline: an image shown while a line of German
 * narration plays, with bilingual captions. Shared by the in-app player (Phase A)
 * and the future .mp4 render (Phase B), so it carries everything both need.
 *
 * @param narrationAudioUrl S3 URL of the synthesized German narration, or {@code null}
 *                          when TTS is unavailable (player then paces by durationMs).
 */
public record VideoSceneDto(
        int seq,
        Long wordId,
        String germanWord,
        String translation,
        String exampleDe,
        String imageUrl,
        String narrationAudioUrl,
        String captionDe,
        String captionVi,
        long durationMs,
        String transition
) {}
