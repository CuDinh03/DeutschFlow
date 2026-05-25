package com.deutschflow.aiimage.dto;

import com.deutschflow.media.dto.MediaAssetDto;

import java.util.List;

public record AiImageGenerateResponse(
        String provider,
        String finalPrompt,
        List<MediaAssetDto> assets
) {
}
