package com.deutschflow.teacher.service;

import com.deutschflow.media.service.S3StorageService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Duration;

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
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SubmissionFileUrlResolver {

    /** Trùng TTL của tài liệu giảng dạy — đủ cho một lượt xem/chấm, không để link sống lâu. */
    static final Duration SUBMISSION_URL_TTL = Duration.ofHours(1);

    private final S3StorageService s3StorageService;

    /**
     * Presigned GET cho file bài nộp, hoặc chính giá trị đã lưu khi không ký được.
     *
     * <p>Trả nguyên giá trị cũ (thay vì null) ở mọi nhánh hỏng là cố ý: một URL không thuộc bucket
     * của mình — dữ liệu cũ, hoặc link ngoài — vẫn phải đi tiếp tới client như trước, và lỗi ký
     * không được phép làm hỏng cả màn chấm bài. Đây thuần tuý là bước làm cho link mở được.
     */
    public String resolve(String storedUrl) {
        if (storedUrl == null || storedUrl.isBlank()) {
            return storedUrl;
        }
        // objectKeyFromOwnUrl chỉ trả key khi URL thực sự trỏ vào bucket của mình (chống SSRF: giá trị
        // này đến từ request body của học viên) — null nghĩa là "không phải file của ta", để nguyên.
        String objectKey = s3StorageService.objectKeyFromOwnUrl(storedUrl);
        if (objectKey == null) {
            return storedUrl;
        }
        try {
            return s3StorageService.presignedGetUrl(objectKey, SUBMISSION_URL_TTL);
        } catch (RuntimeException e) {
            log.warn("[submission] không ký được URL cho object {}: {}", objectKey, e.getMessage());
            return storedUrl;
        }
    }
}
