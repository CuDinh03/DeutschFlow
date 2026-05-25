package com.deutschflow.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "aws.bedrock")
public record AwsBedrockProperties(
        boolean enabled,
        String region,
        String previewModelId,
        String finalModelId
) {
    public boolean isConfigured() {
        return enabled
                && region != null && !region.isBlank()
                && previewModelId != null && !previewModelId.isBlank()
                && finalModelId != null && !finalModelId.isBlank();
    }
}
