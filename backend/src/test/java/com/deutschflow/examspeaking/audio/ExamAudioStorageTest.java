package com.deutschflow.examspeaking.audio;

import com.deutschflow.config.AwsS3Properties;
import com.deutschflow.media.service.S3StorageService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

class ExamAudioStorageTest {

    private AwsS3Properties props(boolean configured) {
        AwsS3Properties p = new AwsS3Properties();
        if (configured) {
            p.setBucketName("bucket");
            p.setAccessKey("ak");
            p.setSecretKey("sk");
        }
        return p;
    }

    @Test
    @DisplayName("S3 chưa cấu hình → không gọi S3, trả null (lượt nói vẫn phải chạy)")
    void noopWhenS3NotConfigured() {
        S3StorageService s3 = mock(S3StorageService.class);
        ExamAudioStorage storage = new ExamAudioStorage(s3, props(false));

        assertThat(storage.isEnabled()).isFalse();
        assertThat(storage.store(1L, 0, new byte[]{1, 2, 3}, "turn.webm")).isNull();
        assertThat(storage.playbackUrl("any/key")).isNull();
        // S3 chưa cấu hình: không có object để xoá → coi như đã xoá (không key nào "thất bại" để giữ lại).
        ExamAudioStorage.PurgeOutcome outcome = storage.purge(List.of("a", "b"));
        assertThat(outcome.deleted()).containsExactly("a", "b");
        assertThat(outcome.failed()).isEmpty();
        verifyNoInteractions(s3);
    }

    @Test
    @DisplayName("S3 nổ khi upload → trả null chứ KHÔNG ném (không được giết phiên thi vì lỗi lưu trữ)")
    void uploadFailureIsSwallowed() {
        S3StorageService s3 = mock(S3StorageService.class);
        doThrow(new RuntimeException("s3 down")).when(s3).uploadBytes(any(), anyString(), anyString());
        ExamAudioStorage storage = new ExamAudioStorage(s3, props(true));

        assertThat(storage.store(7L, 2, new byte[]{9}, "turn.m4a")).isNull();
    }

    @Test
    @DisplayName("key có tiền tố riêng + đúng phiên/lượt; audio rỗng thì không gọi S3")
    void keyLayout() {
        S3StorageService s3 = mock(S3StorageService.class);
        ExamAudioStorage storage = new ExamAudioStorage(s3, props(true));

        String key = storage.store(42L, 5, new byte[]{1}, "turn.m4a");
        assertThat(key).startsWith(ExamAudioStorage.KEY_PREFIX + "/42/005-").endsWith(".m4a");
        verify(s3).uploadBytes(any(), anyString(), anyString());

        assertThat(storage.store(42L, 6, new byte[0], "turn.webm")).isNull();
        assertThat(storage.store(42L, 6, null, "turn.webm")).isNull();
        // vẫn đúng 1 lần gọi: audio rỗng/null không được chạm S3
        verify(s3, times(1)).uploadBytes(any(), anyString(), anyString());
    }

    @Test
    @DisplayName("đuôi file lạ/thiếu → webm; content-type theo đuôi")
    void extensionAndContentType() {
        assertThat(ExamAudioStorage.extension(null)).isEqualTo("webm");
        assertThat(ExamAudioStorage.extension("noext")).isEqualTo("webm");
        assertThat(ExamAudioStorage.extension("a.")).isEqualTo("webm");
        assertThat(ExamAudioStorage.extension("turn.M4A")).isEqualTo("m4a");
        assertThat(ExamAudioStorage.extension("turn.weirdlongext")).isEqualTo("webm");

        assertThat(ExamAudioStorage.contentType("m4a")).isEqualTo("audio/mp4");
        assertThat(ExamAudioStorage.contentType("ogg")).isEqualTo("audio/ogg");
        assertThat(ExamAudioStorage.contentType("webm")).isEqualTo("audio/webm");
    }
}
