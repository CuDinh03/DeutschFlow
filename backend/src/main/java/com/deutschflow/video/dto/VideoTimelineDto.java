package com.deutschflow.video.dto;

import java.util.List;

/**
 * A complete learning-video timeline returned to the client.
 *
 * @param type    content type, e.g. "VOCAB"
 * @param persona TTS voice used for narration (e.g. "LUKAS")
 */
public record VideoTimelineDto(
        String type,
        String level,
        String persona,
        int totalScenes,
        List<VideoSceneDto> scenes
) {}
