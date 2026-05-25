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
import software.amazon.awssdk.services.s3.model.GetBucketLocationRequest;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;

@Slf4j
@Configuration
@EnableConfigurationProperties(AwsS3Properties.class)
@ConditionalOnProperty(prefix = "aws.s3", name = "bucket-name")
public class AwsS3Config {

    @Bean
    public S3BucketContext s3BucketContext(AwsS3Properties props) {
        if (!props.isConfigured()) {
            throw new IllegalStateException(
                    "aws.s3.bucket-name, access-key, and secret-key are required when media storage is enabled");
        }
        String region = resolveBucketRegion(props);
        log.info("S3 media storage: bucket={}, resolvedRegion={}", props.getBucketName(), region);
        return new S3BucketContext(props.getBucketName().trim(), region);
    }

    @Bean
    public S3Client s3Client(AwsS3Properties props, S3BucketContext bucketContext) {
        return buildClient(props, Region.of(bucketContext.region()));
    }

    @Bean
    public S3Presigner s3Presigner(AwsS3Properties props, S3BucketContext bucketContext) {
        AwsBasicCredentials credentials = AwsBasicCredentials.create(props.getAccessKey(), props.getSecretKey());
        return S3Presigner.builder()
                .region(Region.of(bucketContext.region()))
                .credentialsProvider(StaticCredentialsProvider.create(credentials))
                .build();
    }

    private static S3Client buildClient(AwsS3Properties props, Region region) {
        AwsBasicCredentials credentials = AwsBasicCredentials.create(props.getAccessKey(), props.getSecretKey());
        return S3Client.builder()
                .region(region)
                .credentialsProvider(StaticCredentialsProvider.create(credentials))
                .crossRegionAccessEnabled(true)
                .build();
    }

    /**
     * Discover the bucket's actual region (avoids 301 on PutObject when AWS_S3_REGION is wrong).
     */
    static String resolveBucketRegion(AwsS3Properties props) {
        String configured = props.getRegion() != null ? props.getRegion().trim() : "ap-southeast-1";
        if (!props.isConfigured()) {
            return configured;
        }

        AwsBasicCredentials credentials = AwsBasicCredentials.create(props.getAccessKey(), props.getSecretKey());
        try (S3Client probe = S3Client.builder()
                .region(Region.US_EAST_1)
                .credentialsProvider(StaticCredentialsProvider.create(credentials))
                .crossRegionAccessEnabled(true)
                .build()) {

            String location = probe.getBucketLocation(GetBucketLocationRequest.builder()
                            .bucket(props.getBucketName().trim())
                            .build())
                    .locationConstraintAsString();

            String resolved = normalizeBucketLocation(location);
            if (!resolved.equalsIgnoreCase(configured)) {
                log.warn("AWS_S3_REGION={} does not match bucket location ({}). Using {} for S3 client.",
                        configured, location, resolved);
            }
            return resolved;
        } catch (Exception e) {
            log.warn("Could not resolve S3 bucket region via GetBucketLocation; using AWS_S3_REGION={}: {}",
                    configured, e.getMessage());
            return configured;
        }
    }

    static String normalizeBucketLocation(String locationConstraint) {
        if (locationConstraint == null || locationConstraint.isBlank()) {
            return "us-east-1";
        }
        if ("EU".equalsIgnoreCase(locationConstraint)) {
            return "eu-west-1";
        }
        return locationConstraint;
    }
}
