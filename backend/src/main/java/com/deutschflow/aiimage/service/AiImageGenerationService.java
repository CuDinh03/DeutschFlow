package com.deutschflow.aiimage.service;

import com.deutschflow.aiimage.dto.AiImageGenerateRequest;
import com.deutschflow.aiimage.dto.AiImageGenerateResponse;
import com.deutschflow.config.S3BucketContext;
import com.deutschflow.media.dto.MediaAssetDto;
import com.deutschflow.media.entity.MediaAsset;
import com.deutschflow.media.repository.MediaAssetRepository;
import com.deutschflow.media.service.S3StorageService;
import com.deutschflow.user.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AiImageGenerationService {

    private final AiImagePromptBuilder promptBuilder;
    private final ObjectProvider<ImageGenerationProvider> providerProvider;
    private final S3StorageService s3StorageService;
    private final S3BucketContext bucketContext;
    private final MediaAssetRepository mediaAssetRepository;

    @Transactional
    public AiImageGenerateResponse generate(AiImageGenerateRequest request, User user) {
        ImageGenerationProvider provider = providerProvider.getIfAvailable(() -> null);
        if (provider == null) {
            throw new IllegalStateException("AI image provider is not configured");
        }

        String finalPrompt = promptBuilder.build(request.prompt(), request.preset(), request.style());
        List<MediaAssetDto> assets = new ArrayList<>();

        for (int i = 0; i < Math.max(1, request.count()); i++) {
            ImageGenerationProvider.GeneratedImage generated = provider.generate(
                    new ImageGenerationProvider.GeneratedImageRequest(finalPrompt, request.style(), request.size()));

            String s3Key = buildKey(request.preset(), request.style());
            String url = bucketContext.publicObjectUrl(s3Key);

            MediaAsset asset = MediaAsset.builder()
                    .s3Key(s3Key)
                    .url(url)
                    .originalName("ai-generated-" + UUID.randomUUID() + ".txt")
                    .contentType(generated.contentType())
                    .fileSize((long) generated.bytes().length)
                    .category(request.preset().toUpperCase())
                    .scope("SYSTEM")
                    .source("AI_GENERATED")
                    .style(request.style())
                    .tag(null)
                    .altText(request.prompt())
                    .uploadedBy(user)
                    .build();

            mediaAssetRepository.save(asset);
            assets.add(MediaAssetDto.fromEntity(asset));
        }

        return new AiImageGenerateResponse(provider.getClass().getSimpleName(), finalPrompt, assets);
    }

    private String buildKey(String preset, String style) {
        String folder = "ai-images/" + preset.toLowerCase() + "/" + style.toLowerCase();
        return folder + "/" + UUID.randomUUID() + ".txt";
    }
}
