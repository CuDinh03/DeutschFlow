package com.deutschflow.teacher.service;

import com.deutschflow.media.service.S3StorageService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Duration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Bucket là private (đo 22/08: mọi prefix trả 403 AccessDenied), nên URL trần lưu trong
 * {@code student_assignments.submission_file_url} không mở được. Resolver này ký lại link đó.
 */
@ExtendWith(MockitoExtension.class)
class SubmissionFileUrlResolverTest {

    private static final String STORED =
            "https://deutschflow-media-storage.s3.amazonaws.com/assignments/12/7_1756000000000.jpg";

    @Mock
    private S3StorageService s3StorageService;

    @InjectMocks
    private SubmissionFileUrlResolver resolver;

    @Test
    @DisplayName("ký lại URL của bucket mình thành presigned GET có hạn dùng")
    void resolve_ownUrl_returnsPresigned() {
        when(s3StorageService.objectKeyFromOwnUrl(STORED)).thenReturn("assignments/12/7_1756000000000.jpg");
        when(s3StorageService.presignedGetUrl(eq("assignments/12/7_1756000000000.jpg"), any(Duration.class)))
                .thenReturn(STORED + "?X-Amz-Signature=abc");

        assertThat(resolver.resolve(STORED)).isEqualTo(STORED + "?X-Amz-Signature=abc");
        verify(s3StorageService).presignedGetUrl(any(), eq(SubmissionFileUrlResolver.SUBMISSION_URL_TTL));
    }

    @Test
    @DisplayName("URL KHÔNG thuộc bucket mình thì giữ nguyên, không ký (chống SSRF)")
    void resolve_foreignUrl_passesThrough() {
        String foreign = "http://169.254.169.254/latest/meta-data/";
        when(s3StorageService.objectKeyFromOwnUrl(foreign)).thenReturn(null);

        assertThat(resolver.resolve(foreign)).isEqualTo(foreign);
        verify(s3StorageService, never()).presignedGetUrl(any(), any());
    }

    @Test
    @DisplayName("null / rỗng đi qua nguyên vẹn — bài nộp chỉ có chữ không có file")
    void resolve_blank_passesThrough() {
        assertThat(resolver.resolve(null)).isNull();
        assertThat(resolver.resolve("")).isEmpty();
        verify(s3StorageService, never()).objectKeyFromOwnUrl(any());
    }

    @Test
    @DisplayName("lỗi khi ký không được phép làm hỏng màn chấm bài — trả lại URL đã lưu")
    void resolve_signingFails_fallsBackToStored() {
        when(s3StorageService.objectKeyFromOwnUrl(STORED)).thenReturn("assignments/12/7_1756000000000.jpg");
        when(s3StorageService.presignedGetUrl(any(), any())).thenThrow(new IllegalStateException("presigner down"));

        assertThat(resolver.resolve(STORED)).isEqualTo(STORED);
    }
}
