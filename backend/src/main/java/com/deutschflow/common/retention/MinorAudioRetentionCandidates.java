package com.deutschflow.common.retention;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Component;

import java.sql.Date;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;

/**
 * Nạp ứng viên từ BA kho audio. Chỉ ĐỌC — không xoá gì, không quyết định gì.
 *
 * <p><b>Ba kho, không phải một.</b> Kiểm lại bằng lệnh, đừng tin trí nhớ:
 * <ul>
 *   <li>{@code git grep -n "exam-speaking/golden"} → {@code ExamAudioStorage.KEY_PREFIX};</li>
 *   <li>{@code git grep -n "assignments/%d/%d_%d"} → {@code StudentAssignmentController:124};</li>
 *   <li>{@code git grep -n audioBase64} → {@code AiJobWorker:206} đọc, {@code AiJobController} ghi cả
 *       request body vào {@code ai_jobs.payload} (JSONB, {@code V130__ai_job_queue.sql}).</li>
 * </ul>
 *
 * <p>🪤 <b>{@code jsonb_exists(payload, 'audioBase64')} chứ KHÔNG phải {@code payload ? 'audioBase64'}.</b>
 * Toán tử {@code ?} của JSONB trùng ký tự với tham số bind của JDBC: {@code JdbcTemplate} sẽ đếm nó
 * thành một placeholder và ném <em>"The column index is out of range"</em>, hoặc tệ hơn là ăn nhầm
 * tham số cutoff. Cùng họ với bẫy {@code ::} đã phải vá bằng {@code CAST()} trong native query.
 *
 * <p>🪤 <b>Trần {@code limit} áp cho TỪNG kho, không phải cho cả lượt.</b> Dùng chung một ngân sách
 * thì tồn đọng ở kho ghi âm thi (kho lớn nhất) sẽ ăn hết trần mỗi đêm và
 * {@code ai_jobs.payload->>'audioBase64'} — kho duy nhất nằm TRONG Postgres và chưa từng có ai dọn —
 * sẽ không bao giờ tới lượt.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class MinorAudioRetentionCandidates {

    /**
     * Phiên thi nói còn giữ audio trên S3. Lái theo {@code speaking_exam_turns.audio_ref} chứ không
     * theo cờ {@code speaking_exam_sessions.retain_audio}: {@code ExamGoldenService.purgeAudio} hạ cờ
     * đó CHỈ khi mọi key xoá thành công, nên một phiên có key S3 lỗi sẽ vừa còn object vừa còn cờ —
     * nhưng nếu ai đó hạ cờ bằng tay thì object vẫn nằm lại và lái theo cờ sẽ mất dấu nó vĩnh viễn.
     * Sự thật nằm ở {@code audio_ref}.
     */
    private static final String SQL_EXAM_SPEAKING = """
            SELECT s.id          AS row_id,
                   s.user_id     AS subject_user_id,
                   s.created_at  AS captured_at,
                   u.birth_date  AS birth_date,
                   s.org_id      AS org_id
            FROM   speaking_exam_sessions s
            JOIN   users u ON u.id = s.user_id
            WHERE  s.created_at < ?
              AND  EXISTS (SELECT 1
                           FROM   speaking_exam_turns t
                           WHERE  t.session_id = s.id
                             AND  t.audio_ref IS NOT NULL
                             AND  t.audio_ref <> '')
            ORDER BY s.created_at
            LIMIT  ?
            """;

    /**
     * Bài nộp còn file trên S3.
     *
     * <p>{@code org_id} lấy từ LỚP mà bài được nộp vào ({@code teacher_classes.org_id}), không lấy từ
     * {@code users.org_id} lúc job chạy: học viên chuyển trung tâm sau khi nộp bài thì vết dọn phải
     * vẫn nằm ở sổ của trung tâm ĐÃ GIỮ bản ghi âm đó, không nhảy sang trung tâm mới (và không biến
     * mất khi em ấy rời hẳn). Đây là ảnh chụp theo dòng dữ liệu — nó không trôi, nên bảng này KHÔNG
     * cần cột {@code org_id} riêng (V320 §4 giải thích cùng lý do).
     *
     * <p>{@code LEFT JOIN} cả hai bảng: lớp riêng ngoài trung tâm là hợp lệ và cho {@code org_id} NULL,
     * còn dòng {@code student_assignments} mồ côi (assignment đã xoá) vẫn phải nạp được để dọn file.
     */
    private static final String SQL_ASSIGNMENT_UPLOAD = """
            SELECT sa.id                                     AS row_id,
                   sa.student_id                             AS subject_user_id,
                   COALESCE(sa.submitted_at, sa.created_at)  AS captured_at,
                   u.birth_date                              AS birth_date,
                   sa.submission_file_url                    AS ref,
                   sa.assignment_id                          AS assignment_id,
                   tc.org_id                                 AS org_id
            FROM   student_assignments sa
            JOIN   users u ON u.id = sa.student_id
            LEFT   JOIN class_assignments ca ON ca.id = sa.assignment_id
            LEFT   JOIN teacher_classes  tc ON tc.id = ca.class_id
            WHERE  sa.submission_file_url IS NOT NULL
              AND  sa.submission_file_url <> ''
              AND  COALESCE(sa.submitted_at, sa.created_at) < ?
            ORDER BY COALESCE(sa.submitted_at, sa.created_at)
            LIMIT  ?
            """;

    /** Bản ghi âm base64 nằm TRONG Postgres — kho duy nhất không phải S3, và chưa từng có job nào dọn. */
    private static final String SQL_AI_JOB_PAYLOAD = """
            SELECT j.id          AS row_id,
                   j.user_id     AS subject_user_id,
                   j.created_at  AS captured_at,
                   u.birth_date  AS birth_date
            FROM   ai_jobs j
            JOIN   users u ON u.id = j.user_id
            WHERE  jsonb_exists(j.payload, 'audioBase64')
              AND  j.created_at < ?
            ORDER BY j.created_at
            LIMIT  ?
            """;

    private final JdbcTemplate jdbcTemplate;

    public List<MinorAudioCandidate> examSpeaking(Instant cutoff, int limit) {
        // Ảnh chụp org lấy từ `speaking_exam_sessions.org_id` (V320 §1) — cột sinh ra đúng cho tình
        // huống này: job chạy 30 ngày sau khi thu, học viên có thể đã rời trung tâm.
        return query(SQL_EXAM_SPEAKING, cutoff, limit,
                mapper(MinorAudioCandidate.Store.EXAM_SPEAKING_GOLDEN, false, true));
    }

    public List<MinorAudioCandidate> assignmentUploads(Instant cutoff, int limit) {
        return query(SQL_ASSIGNMENT_UPLOAD, cutoff, limit,
                mapper(MinorAudioCandidate.Store.ASSIGNMENT_UPLOAD, true, true));
    }

    public List<MinorAudioCandidate> aiJobPayloads(Instant cutoff, int limit) {
        // `ai_jobs` không neo vào lớp cũng không có ảnh chụp org — rơi về
        // MinorAudioOrgSnapshotResolver (sổ đồng ý / hồ sơ giám hộ).
        return query(SQL_AI_JOB_PAYLOAD, cutoff, limit,
                mapper(MinorAudioCandidate.Store.AI_JOB_PAYLOAD, false, false));
    }

    private List<MinorAudioCandidate> query(String sql, Instant cutoff, int limit, RowMapper<MinorAudioCandidate> mapper) {
        // Timestamp.from + setTimestamp: với cột TIMESTAMPTZ (speaking_exam_sessions) pgjdbc gửi đúng
        // thời điểm; với cột TIMESTAMP không zone (student_assignments, ai_jobs) nó quy về giờ tường
        // của JVM — đúng cùng zone mà `LocalDateTime.now()` đã dùng lúc GHI những dòng đó. Hai cách
        // biểu diễn khác nhau, cùng một mốc.
        return jdbcTemplate.query(sql, mapper, Timestamp.from(cutoff), limit);
    }

    private static RowMapper<MinorAudioCandidate> mapper(
            MinorAudioCandidate.Store store, boolean withFile, boolean withOrg) {
        return (rs, rowNum) -> new MinorAudioCandidate(
                store,
                rs.getLong("row_id"),
                nullableLong(rs, "subject_user_id"),
                birthDate(rs),
                capturedAt(rs),
                withFile ? rs.getString("ref") : null,
                withFile ? nullableLong(rs, "assignment_id") : null,
                withOrg ? nullableLong(rs, "org_id") : null);
    }

    private static Long nullableLong(ResultSet rs, String column) throws SQLException {
        long value = rs.getLong(column);
        return rs.wasNull() ? null : value;
    }

    private static java.time.LocalDate birthDate(ResultSet rs) throws SQLException {
        Date raw = rs.getDate("birth_date");
        return raw == null ? null : raw.toLocalDate();
    }

    private static Instant capturedAt(ResultSet rs) throws SQLException {
        Timestamp raw = rs.getTimestamp("captured_at");
        return raw == null ? null : raw.toInstant();
    }
}
