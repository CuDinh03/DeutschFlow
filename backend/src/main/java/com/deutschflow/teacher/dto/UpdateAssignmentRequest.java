package com.deutschflow.teacher.dto;

import java.time.LocalDateTime;

/**
 * Sửa một bài tập ĐÃ GIAO. Mọi trường đều tuỳ chọn — {@code null} nghĩa là "giữ nguyên", nên client
 * chỉ cần gửi phần thực sự đổi.
 *
 * <p>Cố ý KHÔNG cho sửa {@code assignmentType}: một bài {@code SPEAKING_SCENARIO} đã sinh kịch bản AI
 * và trỏ tới nó qua {@code referenceId}; đổi loại sẽ để lại một bài tập trỏ vào kịch bản của loại
 * khác, còn học viên đang làm dở thì mất đường vào. Đổi loại = tạo bài mới.
 *
 * <p>Muốn XOÁ một giá trị (bỏ hạn nộp, gỡ link, tách khỏi bài học) thì dùng cờ {@code clear*} tương
 * ứng — không thể phân biệt "không gửi" với "gửi null" chỉ bằng bản thân trường đó.
 */
public record UpdateAssignmentRequest(
        String topic,
        String description,
        LocalDateTime dueDate,
        /** HOREN | LESEN | SCHREIBEN | SPRECHEN | GENERAL */
        String skill,
        String attachmentUrl,
        Long lessonId,
        Boolean clearDueDate,
        Boolean clearAttachmentUrl,
        Boolean clearLessonId
) {}
