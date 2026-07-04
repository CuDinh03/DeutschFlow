package com.deutschflow.aiimage.service;

import com.deutschflow.aiimage.dto.AiImageGenerateRequest;
import com.deutschflow.aiimage.dto.AiImageGenerateResponse;
import com.deutschflow.config.S3BucketContext;
import com.deutschflow.media.dto.MediaAssetDto;
import com.deutschflow.media.entity.MediaAsset;
import com.deutschflow.common.quota.AiUsageLedgerService;
import com.deutschflow.media.service.MediaAssetService;
import com.deutschflow.organization.service.OrgPoolGuard;
import com.deutschflow.user.entity.User;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class AiImageGenerationService {

    /** Trần số ảnh / request — Bedrock Stable Image đắt; DTO đã @Max nhưng clamp phòng thủ thêm. */
    private static final int MAX_IMAGES_PER_REQUEST = 4;
    /** Token-tương-đương cho 1 ảnh sinh — để trừ vào pool token org như các tính năng AI đắt khác (PPTX/grade-image). */
    private static final long IMAGE_GEN_ESTIMATED_TOKENS_PER_IMAGE = 15_000L;

    private final AiImagePromptBuilder promptBuilder;
    private final ObjectProvider<ImageGenerationProvider> providerProvider;
    private final S3BucketContext bucketContext;
    private final MediaAssetService mediaAssetService;
    private final OrgPoolGuard orgPoolGuard;
    private final AiUsageLedgerService aiUsageLedgerService;

    /**
     * KHÔNG mở @Transactional quanh vòng lặp (audit S-8/P-16): mỗi {@code provider.generate()} là
     * lời gọi Bedrock chậm — giữ Hikari connection suốt vòng lặp sẽ cạn pool. {@code registerGeneratedAsset}
     * tự commit từng asset độc lập.
     */
    public AiImageGenerateResponse generate(AiImageGenerateRequest request, User user) {
        ImageGenerationProvider provider = providerProvider.getIfAvailable(() -> null);
        if (provider == null) {
            throw new IllegalStateException("AI image provider is not configured");
        }

        // Clamp số ảnh (Bedrock đắt) và gate pool token cấp-org TRƯỚC khi đốt tiền (audit P-16).
        // assertOrgPoolAvailable là no-op với giáo viên B2C / org chưa cấu hình pool.
        int count = Math.min(Math.max(1, request.count()), MAX_IMAGES_PER_REQUEST);
        orgPoolGuard.assertOrgPoolAvailable(
                user != null ? user.getId() : null,
                IMAGE_GEN_ESTIMATED_TOKENS_PER_IMAGE * count);

        String finalPrompt = promptBuilder.build(request.prompt(), request.preset(), request.style());
        List<MediaAssetDto> assets = new ArrayList<>();

        for (int i = 0; i < count; i++) {
            ImageGenerationProvider.GeneratedImage generated = provider.generate(
                    new ImageGenerationProvider.GeneratedImageRequest(finalPrompt, request.style(), request.size()));

            String s3Key = buildKey(request.preset(), request.style());
            String url = bucketContext.publicObjectUrl(s3Key);

            MediaAsset asset = mediaAssetService.registerGeneratedAsset(
                    s3Key, url,
                    "ai-generated-" + UUID.randomUUID() + ".txt",
                    generated.contentType(),
                    (long) generated.bytes().length,
                    request.preset().toUpperCase(),
                    "SYSTEM", "AI_GENERATED",
                    request.style(),
                    request.prompt(),
                    user);
            assets.add(MediaAssetDto.fromEntity(asset));
        }

        // B2B-COGS (audit H-1): tính năng gate pool TRƯỚC nhưng trước đây KHÔNG trừ pool → org
        // metered sinh ảnh Bedrock "miễn phí". Trừ token-tương-đương theo số ảnh thực sinh (best-effort).
        recordImageGenUsage(user, provider, assets.size());

        return new AiImageGenerateResponse(provider.getClass().getSimpleName(), finalPrompt, assets);
    }

    /** Ghi token-tương-đương sinh ảnh vào ledger (trừ org pool + ví). Best-effort — không ném vào luồng sinh ảnh. */
    private void recordImageGenUsage(User user, ImageGenerationProvider provider, int imageCount) {
        if (user == null || user.getId() == null || imageCount <= 0) {
            return;
        }
        int tokens = (int) (IMAGE_GEN_ESTIMATED_TOKENS_PER_IMAGE * imageCount);
        try {
            aiUsageLedgerService.record(
                    user.getId(),
                    "BEDROCK",
                    provider.getClass().getSimpleName(),
                    0, tokens, tokens,
                    "AI_IMAGE_GEN",
                    null, null);
        } catch (Exception e) {
            log.warn("[AI-Image] Could not record AI usage for image gen (non-fatal): {}", e.toString());
        }
    }

    private String buildKey(String preset, String style) {
        String folder = "ai-images/" + preset.toLowerCase() + "/" + style.toLowerCase();
        return folder + "/" + UUID.randomUUID() + ".txt";
    }
}
