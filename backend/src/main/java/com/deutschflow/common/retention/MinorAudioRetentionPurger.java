package com.deutschflow.common.retention;

import com.deutschflow.examspeaking.dto.GoldenView;
import com.deutschflow.examspeaking.golden.ExamGoldenService;
import com.deutschflow.media.service.S3StorageService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * PHẦN XOÁ — nơi duy nhất trong job này chạm vào dữ liệu thật, và là tệp cần soi kỹ nhất khi review.
 * Không quyết định ai bị dọn ({@link MinorAudioRetentionPlanner} làm việc đó), chỉ thi hành.
 *
 * <p><b>Ba kho, ba cơ chế, không kho nào thay được kho nào:</b>
 * <ol>
 *   <li><b>Ghi âm thi nói</b> — TÁI DÙNG {@code ExamGoldenService.purgeAudio}. Không viết lại phần
 *       S3: hàm đó đã xử đúng ca S3 hỏng (F-12) — chỉ nhả {@code audio_ref} của key ĐÃ xoá thật, key
 *       thất bại giữ nguyên tham chiếu để lần sau thử lại. Viết lại là tự tạo lại object mồ côi.</li>
 *   <li><b>File bài nộp</b> — chưa từng có điểm gọi {@code deleteFile} nào chạm tới, nên phải tự
 *       xoá. Xem hai chốt an toàn bên dưới.</li>
 *   <li><b>{@code ai_jobs.payload}</b> — không xoá dòng, chỉ bóc khoá {@code audioBase64} ra khỏi
 *       JSONB bằng MỘT câu {@code payload - 'audioBase64'}. Dòng job vẫn còn để tra cứu lịch sử; chỉ
 *       bản ghi âm biến mất. Đây là kho audio DUY NHẤT nằm trong Postgres.</li>
 * </ol>
 *
 * <h2>🔴 Hai chốt an toàn của kho bài nộp</h2>
 *
 * <p><b>Chốt 1 — khoá S3 phải THUỘC VỀ đúng dòng đang dọn.</b> {@code submission_file_url} được tin
 * NGUYÊN VĂN từ request body của học viên ({@code StudentAssignmentController.SubmitRequest}), và
 * {@code SubmissionFileUrlResolver} sẵn sàng ký presigned cho BẤT KỲ khoá nào nằm trong bucket. Xoá
 * theo giá trị đó mà không kiểm là trao cho học viên một nút "xoá file bất kỳ của người khác": chỉ
 * cần nộp bài với {@code submissionFileUrl} trỏ vào khoá của bạn cùng lớp (hoặc vào tài liệu giảng
 * dạy, tranh Galerie, ảnh hồ sơ…) rồi đợi 30 ngày. Vì vậy kiểm BA lớp:
 * <ul>
 *   <li>{@code objectKeyFromOwnUrl} — phải là object trong bucket của mình (chống SSRF, đã có sẵn);</li>
 *   <li>tiền tố {@code assignments/{assignmentId}/} — cùng chốt mà {@code GradingController:190} đã
 *       dùng cho đường đọc;</li>
 *   <li>tên file bắt đầu bằng {@code {studentId}_} — đúng khuôn khoá do
 *       {@code StudentAssignmentController:124} sinh ra. Không có lớp này thì hai học viên CÙNG một
 *       bài tập vẫn xoá được file của nhau.</li>
 * </ul>
 * Không đạt ⇒ KHÔNG xoá, {@code log.warn}, và đếm riêng vào {@code skippedUnsafeKey} — một con số
 * khác 0 ở đó nghĩa là có dòng dữ liệu bất thường, không phải nhiễu.
 *
 * <p><b>Chốt 2 — chỉ xoá FILE ÂM THANH/HÌNH ĐỘNG.</b> Owner chốt giữ BẢN GHI ÂM 30 ngày, còn bản
 * chuyển chữ và điểm giữ lâu dài theo hồ sơ học tập. Nhưng cùng một cột {@code submission_file_url}
 * cũng chở ảnh chụp bài làm, PDF, DOCX và text ({@code ALLOWED_UPLOAD_TYPES},
 * {@code StudentAssignmentController:37}). Xoá cả cụm ở mốc 30 ngày là xoá luôn bài làm của học
 * viên — vượt xa quyết định của owner và không lấy lại được. Lọc theo đuôi file; đuôi lạ hoặc không
 * có đuôi thì GIỮ và đếm vào {@code skippedNonAudio}.
 *
 * <p>🪤 Thứ tự bắt buộc: <b>xoá object TRƯỚC, nhả cột SAU</b>. Nhả cột trước rồi S3 lỗi là mất dấu
 * object vĩnh viễn — đúng lỗi mà F-12 đã phải vá ở kho ghi âm thi.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class MinorAudioRetentionPurger {

    /** Tiền tố chung của kho bài nộp — chốt tối thiểu, xem "Chốt 1" ở javadoc lớp. */
    static final String ASSIGNMENT_KEY_ROOT = "assignments/";

    /**
     * Đuôi file được coi là BẢN GHI ÂM (kể cả video: video của một đứa trẻ mang cả giọng nói lẫn
     * khuôn mặt, không có lý do gì giữ lâu hơn). Lấy đúng theo {@code ALLOWED_UPLOAD_TYPES} — mọi
     * đuôi khác trong tập đó (jpg/png/gif/webp/pdf/docx/txt) là BÀI LÀM, thuộc hồ sơ học tập.
     */
    static final Set<String> AUDIO_EXTENSIONS = Set.of(
            "mp3", "mpeg", "mpga", "wav", "ogg", "oga", "webm", "m4a", "mp4", "aac");

    /** Đếm object còn sống của một phiên — dùng cho CHẾ ĐỘ ĐẾM, để bản xem trước nói đúng số lượng. */
    private static final String SQL_COUNT_SESSION_AUDIO = """
            SELECT count(*)
            FROM   speaking_exam_turns
            WHERE  session_id = ? AND audio_ref IS NOT NULL AND audio_ref <> ''
            """;

    /** Nhả cột CHỈ khi giá trị chưa đổi — học viên nộp đè giữa lúc job chạy thì bản mới phải đứng yên. */
    private static final String SQL_RELEASE_SUBMISSION_URL =
            "UPDATE student_assignments SET submission_file_url = NULL WHERE id = ? AND submission_file_url = ?";

    /** Lý do dọn, theo {@code chk_speaking_sessions_purge_reason} (V320 §2). */
    static final String PURGE_REASON_MINOR_RETENTION = "MINOR_RETENTION_30D";

    /**
     * Đóng dấu "đã dọn xong hẳn" lên phiên. Hai cột đi thành CẶP —
     * {@code chk_speaking_sessions_purge_pair} từ chối ghi nửa vời.
     *
     * <p>{@code audio_purged_at IS NULL} giữ dấu ĐẦU TIÊN: một phiên đã dọn không được ghi đè mốc
     * bởi một lượt chạy sau (dù lượt sau cũng không nạp lại được nó, vì {@code audio_ref} đã NULL).
     */
    private static final String SQL_STAMP_SESSION_PURGED = """
            UPDATE speaking_exam_sessions
            SET    audio_purged_at = NOW(), audio_purge_reason = ?
            WHERE  id = ? AND audio_purged_at IS NULL
            """;

    private final ExamGoldenService examGoldenService;
    private final S3StorageService s3StorageService;
    private final JdbcTemplate jdbcTemplate;

    // ─────────────────────────────────────────────────────────────────────────
    // Kho 1 — ghi âm thi nói (S3 exam-speaking/golden/…)
    // ─────────────────────────────────────────────────────────────────────────

    public MinorAudioPurgeTally purgeExamSpeakingSession(MinorAudioCandidate candidate, boolean dryRun) {
        if (dryRun) {
            Integer objects = jdbcTemplate.queryForObject(SQL_COUNT_SESSION_AUDIO, Integer.class, candidate.rowId());
            return MinorAudioPurgeTally.ofSession(objects == null ? 0 : objects, 0);
        }
        try {
            GoldenView.PurgeResult result = examGoldenService.purgeAudio(candidate.rowId());
            stampIfFullyPurged(candidate.rowId(), result);
            return MinorAudioPurgeTally.ofSession(result.deleted(), result.failed());
        } catch (RuntimeException e) {
            // Dọn dẹp là việc tốt-nhất-có-thể: một phiên hỏng không được giết cả lượt chạy, và lần
            // sau vẫn nạp lại được vì audio_ref chưa bị nhả.
            log.warn("[MinorAudioRetention] không dọn được phiên thi nói {}: {}", candidate.rowId(), e.getMessage());
            return MinorAudioPurgeTally.ofError();
        }
    }

    /**
     * Đóng dấu {@code audio_purged_at} + {@code audio_purge_reason} (V320 §2) — CHỈ khi mọi key S3
     * đã xoá thật.
     *
     * <p><b>Vì sao cần dấu này khi đã có {@code audio_ref}.</b> Một phiên CHƯA TỪNG ghi âm và một
     * phiên ĐÃ BỊ XOÁ audio trông y hệt nhau qua {@code audio_ref} — cùng NULL. Khi người giám hộ
     * hỏi "bản ghi âm của cháu còn không, ai xoá, lúc nào" thì đó là hai câu trả lời khác nhau.
     *
     * <p>🪤 {@code failed} phải RỖNG. Đóng dấu khi còn key thất bại là nói dối về một việc chưa xong:
     * tệp vẫn sống trên S3 mà sổ ghi là đã xoá. {@code deleted > 0} chặn nốt ca "không có gì để xoá".
     *
     * <p>⚠️ <b>Sai lệch có ý thức so với luật ghi trong V320.</b> V320 dặn đóng dấu TRONG CÙNG giao
     * dịch với chỗ hạ {@code retain_audio = false} ({@code ExamGoldenService:551}). Làm đúng thế đòi
     * sửa {@code ExamGoldenService}, mà tệp đó nằm ngoài phạm vi đợt này (và còn hai đường xoá khác —
     * {@code removeParticipant}, dọn tay của admin — cũng cần đóng dấu, cùng một lần sửa). Ở đây đóng
     * dấu ngay sau khi {@code purgeAudio} trả về thành công, trong cùng lượt gọi. Cửa sổ hở còn lại:
     * tiến trình chết ĐÚNG giữa hai câu lệnh ⇒ audio đã xoá mà phiên không có dấu, và lượt sau không
     * nạp lại được (vì {@code audio_ref} đã NULL) nên dấu đó mất vĩnh viễn. Hậu quả giới hạn ở việc
     * mất một câu trả lời tra cứu, KHÔNG mất dữ liệu và KHÔNG để lại object mồ côi. Chuyển vào trong
     * {@code ExamGoldenService} cho cả ba đường xoá là hạng mục riêng.
     */
    private void stampIfFullyPurged(long sessionId, GoldenView.PurgeResult result) {
        if (result.failed() != 0 || result.deleted() == 0) {
            return;
        }
        try {
            jdbcTemplate.update(SQL_STAMP_SESSION_PURGED, PURGE_REASON_MINOR_RETENTION, sessionId);
        } catch (RuntimeException e) {
            // Audio ĐÃ xoá xong; mất dấu là mất một câu trả lời tra cứu, không được phép làm hỏng
            // kết quả của lượt dọn đã thành công.
            log.warn("[MinorAudioRetention] không đóng dấu được audio_purged_at cho phiên {}: {}",
                    sessionId, e.getMessage());
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Kho 2 — file bài nộp (S3 assignments/…)
    // ─────────────────────────────────────────────────────────────────────────

    public MinorAudioPurgeTally purgeAssignmentUpload(MinorAudioCandidate candidate, boolean dryRun) {
        String storedUrl = candidate.ref();
        String key = s3StorageService.objectKeyFromOwnUrl(storedUrl);
        if (key == null) {
            // URL ngoài bucket của mình (dữ liệu cũ, link ngoài). Không phải file của ta để mà xoá.
            return MinorAudioPurgeTally.ofSkippedForeignUrl();
        }
        if (!belongsToCandidate(key, candidate)) {
            log.warn("[MinorAudioRetention] BỎ QUA khoá không thuộc dòng bài nộp {} (bài tập {}, học viên {}) — "
                            + "khoá không khớp khuôn assignments/<assignmentId>/<studentId>_…",
                    candidate.rowId(), candidate.assignmentId(), candidate.subjectUserId());
            return MinorAudioPurgeTally.ofSkippedUnsafeKey();
        }
        if (!isAudioKey(key)) {
            return MinorAudioPurgeTally.ofSkippedNonAudio();
        }
        if (dryRun) {
            return MinorAudioPurgeTally.ofAssignmentFile();
        }
        try {
            s3StorageService.deleteFile(key);
        } catch (RuntimeException e) {
            log.warn("[MinorAudioRetention] xoá S3 thất bại cho bài nộp {}: {}", candidate.rowId(), e.getMessage());
            return MinorAudioPurgeTally.ofObjectFailed();
        }
        int released = jdbcTemplate.update(SQL_RELEASE_SUBMISSION_URL, candidate.rowId(), storedUrl);
        if (released == 0) {
            // Học viên nộp đè giữa lúc job chạy: cột đã trỏ sang object MỚI. Object cũ vừa xoá đúng
            // là bản ghi âm quá hạn, nên đây là kết cục ĐÚNG — chỉ ghi lại để không ai tưởng là lỗi.
            log.info("[MinorAudioRetention] bài nộp {} đã đổi file giữa chừng — object cũ đã xoá, cột giữ nguyên bản mới",
                    candidate.rowId());
        }
        return MinorAudioPurgeTally.ofAssignmentFile();
    }

    /** Chốt 1 — xem javadoc lớp. */
    static boolean belongsToCandidate(String key, MinorAudioCandidate candidate) {
        if (key == null || !key.startsWith(ASSIGNMENT_KEY_ROOT) || candidate.subjectUserId() == null) {
            return false;
        }
        if (candidate.assignmentId() != null
                && !key.startsWith(ASSIGNMENT_KEY_ROOT + candidate.assignmentId() + "/")) {
            return false;
        }
        String filename = key.substring(key.lastIndexOf('/') + 1);
        return filename.startsWith(candidate.subjectUserId() + "_");
    }

    /** Chốt 2 — xem javadoc lớp. */
    static boolean isAudioKey(String key) {
        int dot = key.lastIndexOf('.');
        int slash = key.lastIndexOf('/');
        if (dot < 0 || dot < slash || dot == key.length() - 1) {
            return false;
        }
        return AUDIO_EXTENSIONS.contains(key.substring(dot + 1).toLowerCase(Locale.ROOT));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Kho 3 — ai_jobs.payload->>'audioBase64' (TRONG Postgres)
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Bóc {@code audioBase64} khỏi payload của một nhóm job bằng MỘT câu.
     *
     * <p>🪤 {@code jsonb_exists(...)} chứ không {@code payload ? 'audioBase64'} — toán tử {@code ?}
     * trùng ký tự placeholder của JDBC. Mệnh đề đó cũng làm câu lệnh IDEMPOTENT: chạy lại không đếm
     * nhầm những dòng đã bóc từ lượt trước.
     */
    public MinorAudioPurgeTally purgeAiJobPayloads(List<Long> jobIds, boolean dryRun) {
        if (jobIds == null || jobIds.isEmpty()) {
            return MinorAudioPurgeTally.EMPTY;
        }
        if (dryRun) {
            return MinorAudioPurgeTally.ofAiJobPayloads(jobIds.size());
        }
        String placeholders = jobIds.stream().map(id -> "?").collect(Collectors.joining(", "));
        String sql = "UPDATE ai_jobs SET payload = payload - 'audioBase64', updated_at = NOW() "
                + "WHERE id IN (" + placeholders + ") AND jsonb_exists(payload, 'audioBase64')";
        try {
            return MinorAudioPurgeTally.ofAiJobPayloads(jdbcTemplate.update(sql, jobIds.toArray()));
        } catch (RuntimeException e) {
            log.warn("[MinorAudioRetention] không bóc được audioBase64 khỏi {} job: {}", jobIds.size(), e.getMessage());
            return MinorAudioPurgeTally.ofError();
        }
    }
}
