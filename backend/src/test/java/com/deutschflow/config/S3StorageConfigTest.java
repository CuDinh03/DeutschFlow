package com.deutschflow.config;

import com.deutschflow.media.service.S3StorageService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;

import java.time.Duration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;

/**
 * Kho file là Cloudflare R2 (không dùng AWS): R2 không có subdomain theo bucket nên mọi URL phải là
 * path-style {@code <endpoint>/<bucket>/<key>}.
 */
class S3StorageConfigTest {

    private static final String ENDPOINT = "https://acct123.r2.cloudflarestorage.com";
    private static final String BUCKET = "deutschflow-media";

    private static S3StorageProperties r2Props() {
        S3StorageProperties props = new S3StorageProperties();
        props.setEndpoint(ENDPOINT + "/");
        props.setBucketName(BUCKET);
        props.setAccessKey("test-access-key");
        props.setSecretKey("test-secret-key");
        return props;
    }

    @Test
    @DisplayName("endpoint là bắt buộc — thiếu thì không coi là đã cấu hình")
    void isConfigured_requiresEndpoint() {
        S3StorageProperties props = r2Props();
        assertThat(props.isConfigured()).isTrue();

        props.setEndpoint(" ");
        assertThat(props.isConfigured()).isFalse();
        assertThatThrownBy(() -> new S3StorageConfig().s3BucketContext(props))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("endpoint");
    }

    @Test
    @DisplayName("endpoint bỏ khoảng trắng + dấu / cuối; region trống → auto")
    void bucketContext_normalizes() {
        S3StorageProperties props = r2Props();
        props.setEndpoint("  " + ENDPOINT + "//  ");
        props.setRegion("");

        S3BucketContext ctx = new S3StorageConfig().s3BucketContext(props);

        assertThat(ctx.endpoint()).isEqualTo(ENDPOINT);
        assertThat(ctx.region()).isEqualTo("auto");
        assertThat(ctx.bucketName()).isEqualTo(BUCKET);
    }

    @Test
    @DisplayName("URL định danh của object là path-style trên endpoint R2")
    void publicObjectUrl_isPathStyle() {
        assertThat(new S3BucketContext(BUCKET, "auto", ENDPOINT).publicObjectUrl("avatars/a.png"))
                .isEqualTo(ENDPOINT + "/" + BUCKET + "/avatars/a.png");
    }

    @Test
    @DisplayName("presigned GET/PUT trỏ về endpoint R2 theo path-style")
    void presigner_isPathStyle() {
        S3StorageProperties props = r2Props();
        S3BucketContext ctx = new S3StorageConfig().s3BucketContext(props);

        try (S3Presigner presigner = new S3StorageConfig().s3Presigner(props, ctx)) {
            S3StorageService storage = new S3StorageService(mock(S3Client.class), presigner, ctx);

            String get = storage.presignedGetUrl("materials/x.pdf", Duration.ofMinutes(5));
            String put = storage.generatePresignedUrl("materials/y.pdf", "application/pdf");

            assertThat(get).startsWith(ENDPOINT + "/" + BUCKET + "/materials/x.pdf?");
            assertThat(put).startsWith(ENDPOINT + "/" + BUCKET + "/materials/y.pdf?");
            assertThat(get).contains("X-Amz-Signature=");
        }
    }

    @Test
    @DisplayName("tách key từ URL của chính bucket mình; bucket khác cùng host, URL lạ, leo thư mục → null")
    void objectKeyFromOwnUrl() {
        S3BucketContext ctx = new S3BucketContext(BUCKET, "auto", ENDPOINT);
        S3StorageService storage = new S3StorageService(mock(S3Client.class), mock(S3Presigner.class), ctx);

        assertThat(storage.objectKeyFromOwnUrl(ENDPOINT + "/" + BUCKET + "/assignments/12/7.jpg"))
                .isEqualTo("assignments/12/7.jpg");
        // R2 dùng chung một host cho mọi bucket của tài khoản — bucket backup không phải của app.
        assertThat(storage.objectKeyFromOwnUrl(ENDPOINT + "/deutschflow-backup/db.dump.age")).isNull();
        assertThat(storage.objectKeyFromOwnUrl(ENDPOINT + "/" + BUCKET + "-old/x.jpg")).isNull();
        assertThat(storage.objectKeyFromOwnUrl(ENDPOINT + "/" + BUCKET + "/")).isNull();
        assertThat(storage.objectKeyFromOwnUrl(ENDPOINT + "/" + BUCKET + "/../deutschflow-backup/x")).isNull();
        assertThat(storage.objectKeyFromOwnUrl("https://deutschflow-media.s3.amazonaws.com/x.jpg")).isNull();
        assertThat(storage.objectKeyFromOwnUrl("http://169.254.169.254/latest/meta-data/")).isNull();
    }
}
