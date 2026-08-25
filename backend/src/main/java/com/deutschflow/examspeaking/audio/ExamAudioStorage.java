package com.deutschflow.examspeaking.audio;

import com.deutschflow.config.AwsS3Properties;
import com.deutschflow.media.service.S3StorageService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

/**
 * Lưu audio lượt nói của phiên hiệu chuẩn lên S3 (G.2/G.3 — giám khảo cần NGHE lại, không chỉ đọc transcript).
 *
 * Kỷ luật:
 * - Chỉ được gọi khi phiên có {@code retainAudio} (người học đã đồng ý) — service này không tự quyết.
 * - Upload là BEST-EFFORT: S3 hỏng/chưa cấu hình thì lượt nói vẫn phải chạy bình thường. Mất audio là
 *   mất tiện nghi cho việc chấm; ném lỗi ở đây sẽ giết phiên thi của người học — đánh đổi sai.
 * - Key có tiền tố riêng để đặt lifecycle rule/purge độc lập với media khác.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ExamAudioStorage {

    /** Tiền tố riêng — cho phép đặt lifecycle rule và purge độc lập với media khác. */
    public static final String KEY_PREFIX = "exam-speaking/golden";

    private static final Duration PLAYBACK_TTL = Duration.ofHours(1);

    private final S3StorageService s3;
    private final AwsS3Properties s3Props;

    public boolean isEnabled() {
        return s3Props.isConfigured();
    }

    /**
     * @return S3 key đã lưu, hoặc {@code null} khi không lưu được (chưa cấu hình S3, lỗi mạng…).
     *         Caller phải coi null là bình thường và tiếp tục lượt nói.
     */
    public String store(long sessionId, int seq, byte[] audio, String filename) {
        if (!isEnabled() || audio == null || audio.length == 0) {
            return null;
        }
        String ext = extension(filename);
        String key = "%s/%d/%03d-%s.%s".formatted(KEY_PREFIX, sessionId, seq, UUID.randomUUID(), ext);
        try {
            s3.uploadBytes(audio, key, contentType(ext));
            log.info("[ExamAudio] đã lưu {} bytes cho phiên {} lượt {} → {}", audio.length, sessionId, seq, key);
            return key;
        } catch (RuntimeException e) {
            log.warn("[ExamAudio] KHÔNG lưu được audio phiên {} lượt {}: {}", sessionId, seq, e.getMessage());
            return null;
        }
    }

    /** URL nghe lại có hạn ({@value #PLAYBACK_TTL}); null nếu key rỗng hoặc S3 chưa cấu hình. */
    public String playbackUrl(String key) {
        if (key == null || key.isBlank() || !isEnabled()) {
            return null;
        }
        try {
            return s3.presignedGetUrl(key, PLAYBACK_TTL);
        } catch (RuntimeException e) {
            log.warn("[ExamAudio] không tạo được presigned URL cho {}: {}", key, e.getMessage());
            return null;
        }
    }

    /** Xoá vĩnh viễn — dùng khi người học rút lại đồng ý. Trả về số key xoá được. */
    public int purge(List<String> keys) {
        if (!isEnabled() || keys == null || keys.isEmpty()) {
            return 0;
        }
        int done = 0;
        for (String key : keys) {
            if (key == null || key.isBlank()) {
                continue;
            }
            try {
                s3.deleteFile(key);
                done++;
            } catch (RuntimeException e) {
                log.warn("[ExamAudio] xoá thất bại {}: {}", key, e.getMessage());
            }
        }
        return done;
    }

    static String extension(String filename) {
        if (filename == null) {
            return "webm";
        }
        int dot = filename.lastIndexOf('.');
        if (dot < 0 || dot == filename.length() - 1) {
            return "webm";
        }
        String ext = filename.substring(dot + 1).toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]", "");
        return ext.isBlank() || ext.length() > 5 ? "webm" : ext;
    }

    static String contentType(String ext) {
        return switch (ext) {
            case "m4a", "mp4" -> "audio/mp4";
            case "mp3" -> "audio/mpeg";
            case "ogg", "oga" -> "audio/ogg";
            case "wav" -> "audio/wav";
            default -> "audio/webm";
        };
    }
}
