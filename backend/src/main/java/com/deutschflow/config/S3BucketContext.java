package com.deutschflow.config;

/**
 * Resolved S3 bucket name and AWS region used for API calls and public object URLs.
 */
public record S3BucketContext(String bucketName, String region) {

    public String publicObjectUrl(String s3Key) {
        return S3PublicUrlBuilder.build(bucketName, region, s3Key);
    }
}
