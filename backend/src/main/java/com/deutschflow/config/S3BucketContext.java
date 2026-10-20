package com.deutschflow.config;

/**
 * Resolved bucket, region and S3-compatible endpoint used for API calls and canonical object URLs.
 */
public record S3BucketContext(String bucketName, String region, String endpoint) {

    public String publicObjectUrl(String s3Key) {
        return S3PublicUrlBuilder.build(endpoint, bucketName, s3Key);
    }
}
