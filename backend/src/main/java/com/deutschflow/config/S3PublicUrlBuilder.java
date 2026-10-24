package com.deutschflow.config;

final class S3PublicUrlBuilder {

    private S3PublicUrlBuilder() {
    }

    /**
     * Canonical (unsigned) object URL, path-style. The bucket is private: this URL is what gets stored,
     * and readers turn it back into a key via {@code S3StorageService.objectKeyFromOwnUrl} then presign.
     */
    static String build(String endpoint, String bucket, String s3Key) {
        return "%s/%s/%s".formatted(endpoint, bucket, s3Key);
    }
}
