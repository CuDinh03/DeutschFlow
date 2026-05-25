package com.deutschflow.config;

import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import software.amazon.awssdk.auth.credentials.DefaultCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.bedrockruntime.BedrockRuntimeClient;

@Slf4j
@Configuration
@EnableConfigurationProperties(AwsBedrockProperties.class)
@ConditionalOnProperty(prefix = "aws.bedrock", name = "enabled", havingValue = "true")
public class AwsBedrockConfig {

    @Bean
    public BedrockRuntimeClient bedrockRuntimeClient(AwsBedrockProperties props) {
        if (!props.isConfigured()) {
            throw new IllegalStateException("aws.bedrock.enabled, region, preview-model-id, and final-model-id are required when Bedrock is enabled");
        }
        log.info("Bedrock image generation enabled: region={}, previewModelId={}, finalModelId={}",
                props.region(), props.previewModelId(), props.finalModelId());
        return BedrockRuntimeClient.builder()
                .region(Region.of(props.region().trim()))
                .credentialsProvider(DefaultCredentialsProvider.create())
                .build();
    }
}
