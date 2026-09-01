package com.deutschflow.teacher.dto;

import java.time.LocalDate;
import java.util.List;

public record CreateLessonLogRequest(
        LocalDate sessionDate,
        Integer sessionNumber,
        String topic,
        String homework,
        String note,
        List<AttendanceInput> attendance,
        Long lessonId,
        Long sessionId,
        /** PR-7 (P07): lý do sửa hồi tố — lưu vào lịch sử; tùy chọn. */
        String editReason
) {
    /** Arity cũ (trước PR-4) — caller/test hiện có giữ nguyên; sessionId để BE tự suy theo ngày. */
    public CreateLessonLogRequest(LocalDate sessionDate, Integer sessionNumber, String topic,
                                  String homework, String note, List<AttendanceInput> attendance,
                                  Long lessonId) {
        this(sessionDate, sessionNumber, topic, homework, note, attendance, lessonId, null, null);
    }

    /** Arity PR-4 (trước PR-7). */
    public CreateLessonLogRequest(LocalDate sessionDate, Integer sessionNumber, String topic,
                                  String homework, String note, List<AttendanceInput> attendance,
                                  Long lessonId, Long sessionId) {
        this(sessionDate, sessionNumber, topic, homework, note, attendance, lessonId, sessionId, null);
    }

    /** {@code needsMakeup} null = tự suy theo trạng thái (ABSENT → cần bù riêng, AC13). */
    public record AttendanceInput(Long studentId, String status, String note, Boolean needsMakeup) {
        /** Arity cũ (trước PR-7) — caller/test hiện có giữ nguyên. */
        public AttendanceInput(Long studentId, String status, String note) {
            this(studentId, status, note, null);
        }
    }
}
