package com.deutschflow.config;

import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.S3Configuration;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;

import java.net.URI;

@Slf4j
@Configuration
@EnableConfigurationProperties(S3StorageProperties.class)
@ConditionalOnProperty(prefix = "storage.s3", name = "bucket-name")
public class S3StorageConfig {

    @Bean
    public S3BucketContext s3BucketContext(S3StorageProperties props) {
        if (!props.isConfigured()) {
            throw new IllegalStateException(
                    "storage.s3.endpoint, bucket-name, access-key, and secret-key are required when media storage is enabled");
        }
        S3BucketContext ctx = new S3BucketContext(
                props.getBucketName().trim(), props.normalizedRegion(), props.normalizedEndpoint());
        log.info("S3-compatible media storage: endpoint={}, bucket={}, region={}",
                ctx.endpoint(), ctx.bucketName(), ctx.region());
        return ctx;
    }

    @Bean
    public S3Client s3Client(S3StorageProperties props, S3BucketContext bucketContext) {
        return S3Client.builder()
                .region(Region.of(bucketContext.region()))
                .endpointOverride(URI.create(bucketContext.endpoint()))
                .serviceConfiguration(pathStyle())
                .credentialsProvider(credentials(props))
                .build();
    }

    @Bean
    public S3Presigner s3Presigner(S3StorageProperties props, S3BucketContext bucketContext) {
        return S3Presigner.builder()
                .region(Region.of(bucketContext.region()))
                .endpointOverride(URI.create(bucketContext.endpoint()))
                .serviceConfiguration(pathStyle())
                .credentialsProvider(credentials(props))
                .build();
    }

    private static StaticCredentialsProvider credentials(S3StorageProperties props) {
        return StaticCredentialsProvider.create(AwsBasicCredentials.create(props.getAccessKey(), props.getSecretKey()));
    }

    /** R2 has no per-bucket subdomain, so every request and presigned URL is {@code <endpoint>/<bucket>/<key>}. */
    private static S3Configuration pathStyle() {
        return S3Configuration.builder().pathStyleAccessEnabled(true).build();
    }
}
