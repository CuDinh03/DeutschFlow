package com.deutschflow.common.retention;

import java.time.Instant;
import java.time.LocalDate;

/**
 * Một bản ghi âm ỨNG VIÊN bị dọn: đủ cũ để qua hạn lưu, chưa biết chủ thể có phải trẻ vị thành niên
 * hay không. Việc phân loại nằm ở {@link MinorAudioRetentionPlanner}, việc xoá nằm ở
 * {@link MinorAudioRetentionPurger} — bản ghi này chỉ chở dữ liệu giữa hai bên.
 *
 * <p><b>Vì sao mang theo {@code birthDate} chứ không mang {@code MinorPolicy.Status}.</b> Trạng thái
 * phải tính TẠI {@link #capturedAt}, không phải tại lúc job chạy: một em thu bản ghi lúc 17 tuổi,
 * nay đã 18, vẫn phải được dọn. Đọc sẵn trạng thái ở tầng SQL là ghim nhầm mốc thời gian ngay từ
 * bước nạp dữ liệu, và không còn chỗ nào sửa lại được.
 *
 * <p>🪤 {@code birthDate} luôn nạp từ cột {@code users.birth_date} trong chính câu SELECT nạp ứng
 * viên — KHÔNG bao giờ từ {@code @AuthenticationPrincipal} (job không có principal, và principal bị
 * {@code JwtAuthFilter} cache 60 giây).
 */
public record MinorAudioCandidate(
        Store store,
        long rowId,
        Long subjectUserId,
        LocalDate birthDate,
        Instant capturedAt,
        String ref,
        Long assignmentId,
        Long orgIdSnapshot
) {

    /**
     * BA kho audio, không phải một. Mỗi kho có cơ chế xoá riêng và không kho nào thay thế được kho
     * nào — xem javadoc {@link MinorAudioRetentionPurger} để biết vì sao.
     */
    public enum Store {
        /** S3 {@code exam-speaking/golden/{sessionId}/…} — có sổ đồng ý, xoá qua {@code ExamGoldenService.purgeAudio}. */
        EXAM_SPEAKING_GOLDEN("sessions"),
        /** S3 {@code assignments/{assignmentId}/{userId}_{ts}} — không sổ đồng ý, không hạn lưu, chưa từng bị xoá. */
        ASSIGNMENT_UPLOAD("assignmentFiles"),
        /** {@code ai_jobs.payload->>'audioBase64'} — bản ghi âm base64 NẰM TRONG Postgres. */
        AI_JOB_PAYLOAD("aiJobPayloads");

        private final String metadataKey;

        Store(String metadataKey) {
            this.metadataKey = metadataKey;
        }

        /** Tên khoá dùng trong metadata của vết audit — cố định để đường đọc của giám đốc không vỡ. */
        public String metadataKey() {
            return metadataKey;
        }
    }

    /** Ứng viên chỉ dùng được khi biết chủ thể là ai và biết thu lúc nào. */
    public boolean isWellFormed() {
        return subjectUserId != null && capturedAt != null;
    }
}
