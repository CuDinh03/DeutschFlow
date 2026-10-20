package com.deutschflow.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Kho file S3-compatible (Cloudflare R2). Nói giao thức S3 qua AWS SDK nhưng KHÔNG dùng dịch vụ AWS:
 * {@code endpoint} là bắt buộc, ví dụ {@code https://<account_id>.r2.cloudflarestorage.com}.
 */
@Getter
@Setter
@ConfigurationProperties(prefix = "storage.s3")
public class S3StorageProperties {

    private String endpoint = "";
    private String bucketName = "";
    /** R2 dùng {@code auto}. */
    private String region = "auto";
    private String accessKey = "";
    private String secretKey = "";

    public boolean isConfigured() {
        return notBlank(endpoint) && notBlank(bucketName) && notBlank(accessKey) && notBlank(secretKey);
    }

    /** Endpoint without surrounding whitespace or trailing slashes. */
    public String normalizedEndpoint() {
        return endpoint == null ? "" : endpoint.trim().replaceAll("/+$", "");
    }

    public String normalizedRegion() {
        return notBlank(region) ? region.trim() : "auto";
    }

    private static boolean notBlank(String s) {
        return s != null && !s.isBlank();
    }
}
