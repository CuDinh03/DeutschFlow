package com.deutschflow.teacher.service;

import com.deutschflow.media.service.S3StorageService;
import com.deutschflow.teacher.entity.StudentAssignment;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.regex.Pattern;

/**
 * Turns the stored {@code student_assignments.submission_file_url} into a link the caller can
 * actually open.
 *
 * <p><b>Vì sao cần lớp này.</b> Học viên nộp file qua presigned PUT, rồi client lưu lại URL TRẦN của
 * object (bỏ query string đã ký) và mọi bề mặt đều render thẳng URL đó: web học viên
 * ({@code <a href>}), web giáo viên ({@code <img>}, {@code <audio>}, {@code <a href>}) và mobile
 * ({@code openInApp}). Bucket là private — đo ngày 22/08 mọi prefix đều trả
 * {@code 403 AccessDenied}, và cùng lý do đó mà tài liệu giảng dạy phải đi qua
 * {@link S3StorageService#presignedGetUrl} còn tranh Galerie phải serve qua một endpoint API riêng.
 * Nên tấm ảnh bài làm, bản ghi âm hay file PDF học viên nộp lên đều KHÔNG mở được: giáo viên bấm
 * "xem bài nộp" thì 403, học viên xem lại bài mình vừa nộp cũng 403. Trớ trêu là đường chấm ảnh bằng
 * AI vẫn chạy, vì nó đọc object bằng credentials của server ({@code downloadBytes}) — AI "nhìn"
 * được bài, người chấm thì không.
 *
 * <p>Cách xử lý bám đúng khuôn của tài liệu giảng dạy ({@code MaterialService#resolveUrl}): ký lại
 * mỗi lần đọc, cột trong DB giữ nguyên URL trần. Không cần đổi gì ở client — vẫn là một chuỗi URL,
 * chỉ khác là mở được, và hết hạn sau {@link #SUBMISSION_URL_TTL}.
 *
 * <p><b>Giới hạn nguồn file.</b> Lớp này chỉ ký cho object nằm đúng trong vùng khoá mà server đã
 * cấp cho bài nộp đó: {@code assignments/{assignmentId}/{studentId}_{millis}{đuôi}} (khuôn do
 * {@link #newSubmissionKey} sinh ra). Mọi giá trị khác — không thuộc bucket của hệ thống, hoặc
 * thuộc bucket nhưng ngoài vùng khoá của bài nộp — đều cho kết quả {@code null}: không ký và cũng
 * KHÔNG trả lại chuỗi đã lưu. Cùng phép kiểm này được dùng lúc nhận bài
 * ({@link #isSubmissionFileOf}) nên giá trị sai không vào được DB ngay từ đầu; kiểm lại lúc đọc là
 * lớp thứ hai. Cách làm nhất quán với kiểm tiền tố {@code avatar/} của {@code UserAvatarService}.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SubmissionFileUrlResolver {

    /** Trùng TTL của tài liệu giảng dạy — đủ cho một lượt xem/chấm, không để link sống lâu. */
    static final Duration SUBMISSION_URL_TTL = Duration.ofHours(1);

    /** Gốc khoá của mọi file bài nộp. */
    public static final String SUBMISSION_KEY_ROOT = "assignments/";

    /** Phần tên file sau {@code {studentId}_}: mốc thời gian (chữ số) rồi tới đuôi file, không có "/". */
    private static final Pattern SUBMISSION_FILENAME_TAIL = Pattern.compile("\\d+[^/]*");

    private final S3StorageService s3StorageService;

    /** Khoá do server cấp cho một lượt tải file bài nộp. Nguồn duy nhất của khuôn khoá. */
    public static String newSubmissionKey(Long assignmentId, Long studentId, long timestampMillis, String extension) {
        return String.format("assignments/%d/%d_%d%s", assignmentId, studentId, timestampMillis,
                extension == null ? "" : extension);
    }

    /**
     * {@code objectKey} có nằm đúng trong vùng khoá mà server cấp cho bài nộp của
     * {@code studentId} ở bài tập {@code assignmentId} hay không. Hàm thuần, không chạm S3.
     */
    public static boolean isSubmissionKeyFor(String objectKey, Long assignmentId, Long studentId) {
        if (objectKey == null || assignmentId == null || studentId == null) {
            return false;
        }
        String prefix = SUBMISSION_KEY_ROOT + assignmentId + "/" + studentId + "_";
        return objectKey.startsWith(prefix)
                && SUBMISSION_FILENAME_TAIL.matcher(objectKey.substring(prefix.length())).matches();
    }

    /**
     * {@code url} có trỏ vào bucket của hệ thống VÀ vào đúng vùng khoá bài nộp của học viên này ở
     * bài tập này hay không. Dùng lúc NHẬN bài: giá trị không đạt thì không được lưu.
     */
    public boolean isSubmissionFileOf(String url, Long assignmentId, Long studentId) {
        return isSubmissionKeyFor(s3StorageService.objectKeyFromOwnUrl(url), assignmentId, studentId);
    }

    /** Như {@link #resolve(String, Long, Long)}, lấy bài tập và học viên từ chính dòng bài nộp. */
    public String resolve(StudentAssignment submission) {
        if (submission == null) {
            return null;
        }
        return resolve(submission.getSubmissionFileUrl(), submission.getAssignmentId(), submission.getStudentId());
    }

    /**
     * Presigned GET cho file bài nộp, hoặc {@code null} khi không có file hợp lệ để mở.
     *
     * <p>Chỉ ký khi giá trị đã lưu trỏ vào bucket của hệ thống và khoá nằm trong vùng khoá của đúng
     * bài nộp này ({@link #isSubmissionKeyFor}). Mọi trường hợp còn lại — rỗng, không thuộc bucket,
     * ngoài vùng khoá, hoặc ký lỗi — trả {@code null}; client coi như bài nộp không kèm file. Lỗi ký
     * chỉ ghi log, không làm hỏng cả màn chấm bài.
     */
    public String resolve(String storedUrl, Long assignmentId, Long studentId) {
        if (storedUrl == null || storedUrl.isBlank()) {
            return null;
        }
        String objectKey = s3StorageService.objectKeyFromOwnUrl(storedUrl);
        if (!isSubmissionKeyFor(objectKey, assignmentId, studentId)) {
            return null;
        }
        try {
            return s3StorageService.presignedGetUrl(objectKey, SUBMISSION_URL_TTL);
        } catch (RuntimeException e) {
            log.warn("[submission] không ký được URL cho object {}: {}", objectKey, e.getMessage());
            return null;
        }
    }
}
