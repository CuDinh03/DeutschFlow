package com.deutschflow.teacher.dto;

import java.time.LocalDateTime;

/**
 * Một lượt trong bài nói, cho giáo viên đọc lại.
 *
 * @param role       {@code USER} (lời học viên, đã qua nhận dạng giọng) hoặc {@code ASSISTANT} (câu AI nói)
 * @param text       nội dung lượt nói
 * @param correction câu AI sửa cho lượt của học viên, nếu có
 */
public record TeacherSpeakingTranscriptLineDto(
        String role,
        String text,
        String correction,
        LocalDateTime createdAt
) {}
