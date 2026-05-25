package com.deutschflow.aiimage.service;

import com.deutschflow.config.AwsBedrockProperties;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.core.SdkBytes;
import software.amazon.awssdk.services.bedrockruntime.BedrockRuntimeClient;
import software.amazon.awssdk.services.bedrockruntime.model.InvokeModelRequest;
import software.amazon.awssdk.services.bedrockruntime.model.InvokeModelResponse;

import java.nio.charset.StandardCharsets;
import java.util.Base64;

@Service
@RequiredArgsConstructor
@ConditionalOnBean(BedrockRuntimeClient.class)
public class BedrockImageGenerationProvider implements ImageGenerationProvider {

    private static final String STABLE_IMAGE_CORE = "stable-image-core";
    private static final String STABLE_IMAGE_ULTRA = "stable-image-ultra";

    private final BedrockRuntimeClient bedrockRuntimeClient;
    private final AwsBedrockProperties props;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Override
    public GeneratedImage generate(GeneratedImageRequest request) {
        try {
            String modelId = resolveModelId(request.size());
            String body = buildPayload(request, modelId);
            InvokeModelRequest invokeRequest = InvokeModelRequest.builder()
                    .modelId(modelId)
                    .contentType("application/json")
                    .accept("application/json")
                    .body(SdkBytes.fromUtf8String(body))
                    .build();

            InvokeModelResponse response = bedrockRuntimeClient.invokeModel(invokeRequest);
            String responseBody = response.body().asUtf8String();
            JsonNode root = objectMapper.readTree(responseBody);

            String base64Image = extractBase64Image(root);
            if (base64Image == null || base64Image.isBlank()) {
                throw new IllegalStateException("Bedrock response did not contain image data");
            }

            byte[] imageBytes = Base64.getDecoder().decode(base64Image);
            return new GeneratedImage("image/png", imageBytes, request.prompt());
        } catch (Exception e) {
            byte[] fallback = ("Bedrock generation failed: " + e.getMessage()).getBytes(StandardCharsets.UTF_8);
            return new GeneratedImage("text/plain", fallback, request.prompt());
        }
    }

    private String resolveModelId(String size) {
        boolean preview = size == null || size.isBlank() || size.toLowerCase().contains("preview")
                || size.toLowerCase().contains("small")
                || size.toLowerCase().contains("1024")
                || size.toLowerCase().contains("landscape");
        return preview ? props.previewModelId() : props.finalModelId();
    }

    private String buildPayload(GeneratedImageRequest request, String modelId) throws Exception {
        if (isStableImageModel(modelId)) {
            return objectMapper.writeValueAsString(new StableImageRequest(request.prompt(), request.size()));
        }
        return objectMapper.writeValueAsString(new StableImageRequest(request.prompt(), request.size()));
    }

    private boolean isStableImageModel(String modelId) {
        String normalized = modelId == null ? "" : modelId.toLowerCase();
        return normalized.contains(STABLE_IMAGE_CORE) || normalized.contains(STABLE_IMAGE_ULTRA);
    }

    private String extractBase64Image(JsonNode root) {
        if (root.path("images").isArray() && root.path("images").size() > 0) {
            return root.path("images").get(0).asText();
        }
        if (root.hasNonNull("image")) {
            return root.path("image").asText();
        }
        if (root.hasNonNull("artifacts") && root.path("artifacts").isArray() && root.path("artifacts").size() > 0) {
            return root.path("artifacts").get(0).path("base64").asText();
        }
        return null;
    }

    private record StableImageRequest(String prompt, String size) {}
}
