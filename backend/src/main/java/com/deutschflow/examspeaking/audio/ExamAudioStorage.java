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

    /** Kết quả purge: key nào đã xoá thật, key nào thất bại (caller PHẢI giữ tham chiếu để xoá lại — F-12). */
    public record PurgeOutcome(List<String> deleted, List<String> failed) {
        public PurgeOutcome {
            deleted = deleted == null ? List.of() : List.copyOf(deleted);
            failed = failed == null ? List.of() : List.copyOf(failed);
        }

        public static PurgeOutcome empty() {
            return new PurgeOutcome(List.of(), List.of());
        }
    }

    /**
     * Xoá vĩnh viễn — dùng khi người học rút lại đồng ý. S3 chưa cấu hình → không có gì để xoá, coi như
     * đã xoá (không thể có object). S3 lỗi từng key → key đó nằm ở {@code failed}: caller giữ nguyên
     * {@code audio_ref} để lần purge sau thử lại thay vì để object mồ côi trên S3 (F-12).
     */
    public PurgeOutcome purge(List<String> keys) {
        if (keys == null || keys.isEmpty()) {
            return PurgeOutcome.empty();
        }
        List<String> wanted = keys.stream().filter(k -> k != null && !k.isBlank()).toList();
        if (!isEnabled()) {
            return new PurgeOutcome(wanted, List.of());
        }
        List<String> deleted = new java.util.ArrayList<>();
        List<String> failed = new java.util.ArrayList<>();
        for (String key : wanted) {
            try {
                s3.deleteFile(key);
                deleted.add(key);
            } catch (RuntimeException e) {
                log.warn("[ExamAudio] xoá thất bại {}: {}", key, e.getMessage());
                failed.add(key);
            }
        }
        return new PurgeOutcome(deleted, failed);
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
