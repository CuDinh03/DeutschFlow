package com.deutschflow.teacher.service;

import com.deutschflow.common.exception.ConflictException;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Chặn xoá cứng một lớp còn dữ liệu vận hành, và mô tả chính xác lớp đang chứa những gì.
 *
 * <p><b>Vì sao cần:</b> {@code teacher_classes} bị 11 khoá ngoại trỏ tới — 9 cái
 * {@code ON DELETE CASCADE}, 1 cái {@code ON DELETE SET NULL} ({@code teacher_session_record}), 1
 * cái không khai {@code ON DELETE} nên là {@code NO ACTION} ({@code class_materials}). Một lệnh
 * {@code DELETE FROM teacher_classes} vì thế kéo theo điểm danh, nhật ký buổi học, lịch, tin nhắn
 * kênh lớp và bài nộp của học viên — âm thầm, không hoàn tác được. Guard này là hàng rào tạm cho
 * tới khi có cơ chế lưu trữ ({@code archived_at}, Đợt C): lớp còn dấu vết dạy học thì không xoá
 * được, chỉ lớp thật sự trống mới xoá.
 *
 * <p><b>Ranh giới "trống":</b> chặn khi tồn tại bản ghi <i>ghi lại việc dạy đã diễn ra</i> hoặc do
 * người khác tạo — buổi học, nhật ký, điểm danh, tin nhắn, tài liệu đính kèm, bài học viên đã nộp,
 * bản ghi công giáo viên. KHÔNG chặn vì lớp có học viên ghi danh, có bài tập chưa ai nộp, có lịch
 * định kỳ hay giáo án: đó là cấu hình do chính giáo viên chính tạo và dựng lại được — nhưng vẫn
 * đếm để ghi vào vết audit, vì chúng cũng biến mất theo.
 *
 * <p>Bản ghi đã xoá mềm ({@code class_channel_messages.deleted_at},
 * {@code student_assignments.is_deleted}) KHÔNG tính: tác giả của chúng đã chủ động bỏ đi rồi.
 */
@Service
@RequiredArgsConstructor
public class ClassDeletionGuard {

    private final JdbcTemplate jdbcTemplate;

    /**
     * Đếm mọi thứ treo vào lớp trong MỘT lượt truy vấn. Mỗi {@code ?} đều là {@code classId} —
     * xem {@link #countArgs}.
     */
    private static final String COUNT_SQL = """
            SELECT
              (SELECT COUNT(*) FROM class_sessions      WHERE class_id = ?) AS sessions,
              (SELECT COUNT(*) FROM class_lesson_logs   WHERE class_id = ?) AS lesson_logs,
              (SELECT COUNT(*) FROM class_attendance a
                 JOIN class_lesson_logs l ON l.id = a.lesson_log_id
                WHERE l.class_id = ?)                                       AS attendance,
              (SELECT COUNT(*) FROM class_channel_messages
                WHERE class_id = ? AND deleted_at IS NULL)                  AS channel_messages,
              (SELECT COUNT(*) FROM class_materials     WHERE class_id = ?) AS materials,
              (SELECT COUNT(*) FROM student_assignments sa
                 JOIN class_assignments ca ON ca.id = sa.assignment_id
                WHERE ca.class_id = ?
                  AND COALESCE(sa.is_deleted, FALSE) = FALSE
                  AND (sa.submitted_at IS NOT NULL OR sa.status <> 'PENDING')) AS submissions,
              (SELECT COUNT(*) FROM teacher_session_record WHERE class_id = ?) AS teaching_records,
              (SELECT COUNT(*) FROM class_students          WHERE class_id = ?) AS students,
              (SELECT COUNT(*) FROM class_assignments       WHERE class_id = ?) AS assignments,
              (SELECT COUNT(*) FROM class_schedule_patterns WHERE class_id = ?) AS patterns,
              (SELECT COUNT(*) FROM class_lessons           WHERE class_id = ?) AS lessons
            """;

    private static final int SQL_PARAM_COUNT = 11;

    /** Ném 409 nếu lớp còn dữ liệu vận hành. Trả về bản kiểm kê để call-site ghi vết audit. */
    public ClassContent assertDeletable(Long classId) {
        ClassContent content = inspect(classId);
        if (content.hasHistory()) {
            throw new ConflictException(
                    "Không xoá được lớp vì còn dữ liệu dạy học: " + content.describeHistory()
                            + ". Dữ liệu này không khôi phục được sau khi xoá — hãy xoá các mục trên"
                            + " trước, hoặc giữ lớp lại và ngừng sử dụng.");
        }
        return content;
    }

    /** Kiểm kê mọi bản ghi treo vào lớp. */
    public ClassContent inspect(Long classId) {
        Map<String, Object> row = jdbcTemplate.queryForMap(COUNT_SQL, countArgs(classId));
        return new ClassContent(
                num(row, "sessions"),
                num(row, "lesson_logs"),
                num(row, "attendance"),
                num(row, "channel_messages"),
                num(row, "materials"),
                num(row, "submissions"),
                num(row, "teaching_records"),
                num(row, "students"),
                num(row, "assignments"),
                num(row, "patterns"),
                num(row, "lessons"));
    }

    private static Object[] countArgs(Long classId) {
        Object[] args = new Object[SQL_PARAM_COUNT];
        Arrays.fill(args, classId);
        return args;
    }

    private static long num(Map<String, Object> row, String column) {
        Object v = row.get(column);
        return v instanceof Number n ? n.longValue() : 0L;
    }

    /**
     * Những gì đang treo vào một lớp. 7 trường đầu là <i>lịch sử</i> (chặn xoá), 4 trường sau là
     * cấu hình (không chặn, chỉ để ghi vết).
     */
    public record ClassContent(
            long sessions,
            long lessonLogs,
            long attendance,
            long channelMessages,
            long materials,
            long submissions,
            long teachingRecords,
            long students,
            long assignments,
            long patterns,
            long lessons
    ) {

        /** Lớp đã có dấu vết dạy học → không được xoá cứng. */
        public boolean hasHistory() {
            return sessions > 0 || lessonLogs > 0 || attendance > 0 || channelMessages > 0
                    || materials > 0 || submissions > 0 || teachingRecords > 0;
        }

        /** Liệt kê phần lịch sử cho thông điệp lỗi, ví dụ {@code "12 buổi học, 96 lượt điểm danh"}. */
        public String describeHistory() {
            List<String> parts = new ArrayList<>();
            add(parts, sessions, "buổi học");
            add(parts, lessonLogs, "nhật ký buổi học");
            add(parts, attendance, "lượt điểm danh");
            add(parts, channelMessages, "tin nhắn kênh lớp");
            add(parts, materials, "tài liệu đính kèm");
            add(parts, submissions, "bài học viên đã nộp");
            add(parts, teachingRecords, "bản ghi công giáo viên");
            return String.join(", ", parts);
        }

        /** Kiểm kê phẳng để nhét vào {@code metadata_json} của audit log. */
        public Map<String, Object> toAuditMetadata() {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("sessions", sessions);
            m.put("lessonLogs", lessonLogs);
            m.put("attendance", attendance);
            m.put("channelMessages", channelMessages);
            m.put("materials", materials);
            m.put("submissions", submissions);
            m.put("teachingRecords", teachingRecords);
            m.put("students", students);
            m.put("assignments", assignments);
            m.put("patterns", patterns);
            m.put("lessons", lessons);
            return m;
        }

        private static void add(List<String> parts, long count, String label) {
            if (count > 0) {
                parts.add(count + " " + label);
            }
        }
    }
}
