package com.deutschflow.teacher.dto;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Phiên nói của học viên, nhìn từ phía giáo viên.
 *
 * <p>{@code transcript} chỉ có ở màn chi tiết ({@code GET /v2/teacher/speaking-sessions/{id}}) và chỉ với
 * phiên gắn bài do lớp của giáo viên giao; danh sách và phiên luyện tự do luôn để {@code null}.
 * {@code sessionMode = "INTERVIEW"} là phiên phỏng vấn — có báo cáo chấm riêng, giáo viên không chấm đè.
 */
public record TeacherSpeakingSessionDto(
        Long id,
        Long userId,
        String topic,
        String cefrLevel,
        String status,
        Integer messageCount,
        Integer aiScore,
        String aiFeedback,
        Integer teacherScore,
        String teacherFeedback,
        LocalDateTime startedAt,
        LocalDateTime endedAt,
        LocalDateTime reviewedAt,
        String sessionMode,
        Long assignmentId,
        List<TeacherSpeakingTranscriptLineDto> transcript
) {}
