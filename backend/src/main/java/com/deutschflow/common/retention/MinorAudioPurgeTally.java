package com.deutschflow.common.retention;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Số đếm của một lượt dọn, cộng dồn được. BẤT BIẾN — {@link #plus} trả bản mới, không sửa bản cũ.
 *
 * <p>Đây cũng chính là nội dung metadata của vết audit, nên ⛔ <b>tuyệt đối không có trường nào mang
 * nội dung hay định danh</b>: không transcript, không URL, không id học viên, không ngày sinh. Vết
 * tổng kết trả lời "trung tâm này đêm qua bị dọn bao nhiêu", không trả lời "của em nào".
 */
public record MinorAudioPurgeTally(
        int sessions,
        int assignmentFiles,
        int aiJobPayloads,
        int objectsDeleted,
        int objectsFailed,
        int unclassified,
        int skippedForeignUrl,
        int skippedUnsafeKey,
        int skippedNonAudio,
        int errors
) {

    public static final MinorAudioPurgeTally EMPTY =
            new MinorAudioPurgeTally(0, 0, 0, 0, 0, 0, 0, 0, 0, 0);

    public static MinorAudioPurgeTally ofSession(int objectsDeleted, int objectsFailed) {
        return new MinorAudioPurgeTally(1, 0, 0, objectsDeleted, objectsFailed, 0, 0, 0, 0, 0);
    }

    public static MinorAudioPurgeTally ofAssignmentFile() {
        return new MinorAudioPurgeTally(0, 1, 0, 1, 0, 0, 0, 0, 0, 0);
    }

    public static MinorAudioPurgeTally ofAiJobPayloads(int rows) {
        return new MinorAudioPurgeTally(0, 0, rows, 0, 0, 0, 0, 0, 0, 0);
    }

    public static MinorAudioPurgeTally ofUnclassified(int count) {
        return new MinorAudioPurgeTally(0, 0, 0, 0, 0, count, 0, 0, 0, 0);
    }

    public static MinorAudioPurgeTally ofObjectFailed() {
        return new MinorAudioPurgeTally(0, 0, 0, 0, 1, 0, 0, 0, 0, 0);
    }

    public static MinorAudioPurgeTally ofSkippedForeignUrl() {
        return new MinorAudioPurgeTally(0, 0, 0, 0, 0, 0, 1, 0, 0, 0);
    }

    public static MinorAudioPurgeTally ofSkippedUnsafeKey() {
        return new MinorAudioPurgeTally(0, 0, 0, 0, 0, 0, 0, 1, 0, 0);
    }

    public static MinorAudioPurgeTally ofSkippedNonAudio() {
        return new MinorAudioPurgeTally(0, 0, 0, 0, 0, 0, 0, 0, 1, 0);
    }

    public static MinorAudioPurgeTally ofError() {
        return new MinorAudioPurgeTally(0, 0, 0, 0, 0, 0, 0, 0, 0, 1);
    }

    public MinorAudioPurgeTally plus(MinorAudioPurgeTally o) {
        if (o == null) {
            return this;
        }
        return new MinorAudioPurgeTally(
                sessions + o.sessions,
                assignmentFiles + o.assignmentFiles,
                aiJobPayloads + o.aiJobPayloads,
                objectsDeleted + o.objectsDeleted,
                objectsFailed + o.objectsFailed,
                unclassified + o.unclassified,
                skippedForeignUrl + o.skippedForeignUrl,
                skippedUnsafeKey + o.skippedUnsafeKey,
                skippedNonAudio + o.skippedNonAudio,
                errors + o.errors);
    }

    /** Số dòng thật sự bị đụng tới ở cả ba kho. */
    public int touchedRows() {
        return sessions + assignmentFiles + aiJobPayloads;
    }

    /** Không có gì để kể thì KHÔNG ghi vết — sổ của giám đốc không phải chỗ đổ nhịp tim mỗi đêm. */
    public boolean isSilent() {
        return touchedRows() == 0 && objectsFailed == 0 && unclassified == 0
                && skippedUnsafeKey == 0 && errors == 0;
    }

    /**
     * Metadata cho vết audit. Chỉ đưa vào khoá nào khác 0 (ngoài ba khoá số lượng chính) để vết đọc
     * được bằng mắt thay vì thành một hàng số 0 dài.
     */
    public Map<String, Object> toMetadata() {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put(MinorAudioCandidate.Store.EXAM_SPEAKING_GOLDEN.metadataKey(), sessions);
        out.put(MinorAudioCandidate.Store.ASSIGNMENT_UPLOAD.metadataKey(), assignmentFiles);
        out.put(MinorAudioCandidate.Store.AI_JOB_PAYLOAD.metadataKey(), aiJobPayloads);
        out.put("objects", objectsDeleted);
        out.put("unclassified", unclassified);
        putIfNonZero(out, "objectsFailed", objectsFailed);
        putIfNonZero(out, "skippedForeignUrl", skippedForeignUrl);
        putIfNonZero(out, "skippedUnsafeKey", skippedUnsafeKey);
        putIfNonZero(out, "skippedNonAudio", skippedNonAudio);
        putIfNonZero(out, "errors", errors);
        return out;
    }

    private static void putIfNonZero(Map<String, Object> out, String key, int value) {
        if (value != 0) {
            out.put(key, value);
        }
    }
}
