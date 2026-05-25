package com.deutschflow.config;

final class S3PublicUrlBuilder {

    private S3PublicUrlBuilder() {
    }

    static String build(String bucket, String region, String s3Key) {
        if (region == null || region.isBlank() || "us-east-1".equalsIgnoreCase(region)) {
            return "https://%s.s3.amazonaws.com/%s".formatted(bucket, s3Key);
        }
        return "https://%s.s3.%s.amazonaws.com/%s".formatted(bucket, region, s3Key);
    }
}
