package com.deutschflow.teacher.service;

import com.deutschflow.media.service.S3StorageService;
import com.deutschflow.teacher.entity.StudentAssignment;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Duration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Bucket là private (đo 22/08: mọi prefix trả 403 AccessDenied), nên URL trần lưu trong
 * {@code student_assignments.submission_file_url} không mở được. Resolver này ký lại link đó —
 * nhưng CHỈ cho object nằm trong vùng khoá mà server đã cấp cho đúng bài nộp đang đọc.
 */
@ExtendWith(MockitoExtension.class)
class SubmissionFileUrlResolverTest {

    private static final Long ASSIGNMENT_ID = 12L;
    private static final Long STUDENT_ID = 7L;
    private static final String KEY = "assignments/12/7_1756000000000.jpg";
    private static final String STORED = "https://deutschflow-media-storage.s3.amazonaws.com/" + KEY;

    @Mock
    private S3StorageService s3StorageService;

    @InjectMocks
    private SubmissionFileUrlResolver resolver;

    @Test
    @DisplayName("khoá đúng bài tập và đúng học viên → ký thành presigned GET có hạn dùng")
    void resolve_ownSubmissionKey_returnsPresigned() {
        when(s3StorageService.objectKeyFromOwnUrl(STORED)).thenReturn(KEY);
        when(s3StorageService.presignedGetUrl(eq(KEY), any(Duration.class)))
                .thenReturn(STORED + "?X-Amz-Signature=abc");

        assertThat(resolver.resolve(STORED, ASSIGNMENT_ID, STUDENT_ID)).isEqualTo(STORED + "?X-Amz-Signature=abc");
        verify(s3StorageService).presignedGetUrl(any(), eq(SubmissionFileUrlResolver.SUBMISSION_URL_TTL));
    }

    @Test
    @DisplayName("resolve(StudentAssignment) lấy bài tập và học viên từ chính dòng bài nộp")
    void resolve_fromRow_usesRowIds() {
        when(s3StorageService.objectKeyFromOwnUrl(STORED)).thenReturn(KEY);
        when(s3StorageService.presignedGetUrl(eq(KEY), any(Duration.class))).thenReturn("signed");

        StudentAssignment own = StudentAssignment.builder()
                .assignmentId(ASSIGNMENT_ID).studentId(STUDENT_ID).submissionFileUrl(STORED).build();
        StudentAssignment otherRow = StudentAssignment.builder()
                .assignmentId(ASSIGNMENT_ID).studentId(8L).submissionFileUrl(STORED).build();

        assertThat(resolver.resolve(own)).isEqualTo("signed");
        assertThat(resolver.resolve(otherRow)).isNull();
        assertThat(resolver.resolve((StudentAssignment) null)).isNull();
    }

    @Test
    @DisplayName("khoá thuộc bucket nhưng ngoài vùng khoá của bài nộp → null, không ký")
    void resolve_keyOutsideSubmissionPrefix_returnsNull() {
        for (String key : new String[] {
                "materials/abc.pdf",
                "avatar/7/photo.png",
                "assignments/13/7_1756000000000.jpg",   // bài tập khác
                "assignments/12/8_1756000000000.jpg",   // học viên khác
                "assignments/12/70_1756000000000.jpg",  // id khác có cùng chữ số đầu
                "assignments/12/7_x.jpg",               // không đúng khuôn tên file
                "assignments/12/7_1756000000000/sub/file.jpg",
                "assignments/12/",
        }) {
            String url = "https://deutschflow-media-storage.s3.amazonaws.com/" + key;
            when(s3StorageService.objectKeyFromOwnUrl(url)).thenReturn(key);

            assertThat(resolver.resolve(url, ASSIGNMENT_ID, STUDENT_ID)).as(key).isNull();
        }
        verify(s3StorageService, never()).presignedGetUrl(any(), any());
    }

    @Test
    @DisplayName("URL KHÔNG thuộc bucket của hệ thống → null, không ký và không trả lại chuỗi đã lưu")
    void resolve_foreignUrl_returnsNull() {
        String foreign = "https://elsewhere.example/assignments/12/7_1756000000000.jpg";
        when(s3StorageService.objectKeyFromOwnUrl(foreign)).thenReturn(null);

        assertThat(resolver.resolve(foreign, ASSIGNMENT_ID, STUDENT_ID)).isNull();
        verify(s3StorageService, never()).presignedGetUrl(any(), any());
    }

    @Test
    @DisplayName("null / rỗng → null — bài nộp chỉ có chữ không có file")
    void resolve_blank_returnsNull() {
        assertThat(resolver.resolve(null, ASSIGNMENT_ID, STUDENT_ID)).isNull();
        assertThat(resolver.resolve("", ASSIGNMENT_ID, STUDENT_ID)).isNull();
        verify(s3StorageService, never()).objectKeyFromOwnUrl(any());
    }

    @Test
    @DisplayName("thiếu bài tập hoặc học viên để đối chiếu → null")
    void resolve_missingIds_returnsNull() {
        when(s3StorageService.objectKeyFromOwnUrl(STORED)).thenReturn(KEY);

        assertThat(resolver.resolve(STORED, null, STUDENT_ID)).isNull();
        assertThat(resolver.resolve(STORED, ASSIGNMENT_ID, null)).isNull();
        verify(s3StorageService, never()).presignedGetUrl(any(), any());
    }

    @Test
    @DisplayName("lỗi khi ký không làm hỏng màn chấm bài — trả null, không ném lỗi")
    void resolve_signingFails_returnsNull() {
        when(s3StorageService.objectKeyFromOwnUrl(STORED)).thenReturn(KEY);
        when(s3StorageService.presignedGetUrl(any(), any())).thenThrow(new IllegalStateException("presigner down"));

        assertThat(resolver.resolve(STORED, ASSIGNMENT_ID, STUDENT_ID)).isNull();
    }

    @Test
    @DisplayName("isSubmissionFileOf: chỉ nhận URL của bucket hệ thống nằm đúng vùng khoá của bài nộp")
    void isSubmissionFileOf_checksBucketAndPrefix() {
        String foreign = "https://elsewhere.example/" + KEY;
        String otherKeyUrl = "https://deutschflow-media-storage.s3.amazonaws.com/materials/abc.pdf";
        when(s3StorageService.objectKeyFromOwnUrl(STORED)).thenReturn(KEY);
        when(s3StorageService.objectKeyFromOwnUrl(foreign)).thenReturn(null);
        when(s3StorageService.objectKeyFromOwnUrl(otherKeyUrl)).thenReturn("materials/abc.pdf");

        assertThat(resolver.isSubmissionFileOf(STORED, ASSIGNMENT_ID, STUDENT_ID)).isTrue();
        assertThat(resolver.isSubmissionFileOf(STORED, ASSIGNMENT_ID, 8L)).isFalse();
        assertThat(resolver.isSubmissionFileOf(STORED, 13L, STUDENT_ID)).isFalse();
        assertThat(resolver.isSubmissionFileOf(foreign, ASSIGNMENT_ID, STUDENT_ID)).isFalse();
        assertThat(resolver.isSubmissionFileOf(otherKeyUrl, ASSIGNMENT_ID, STUDENT_ID)).isFalse();
    }

    @Test
    @DisplayName("khoá do newSubmissionKey sinh ra luôn qua được isSubmissionKeyFor của chính nó")
    void newSubmissionKey_roundTrips() {
        for (String ext : new String[] {".jpg", ".m4a", "", ".tar gz", null}) {
            String key = SubmissionFileUrlResolver.newSubmissionKey(ASSIGNMENT_ID, STUDENT_ID, 1756000000000L, ext);

            assertThat(SubmissionFileUrlResolver.isSubmissionKeyFor(key, ASSIGNMENT_ID, STUDENT_ID)).as(key).isTrue();
            assertThat(SubmissionFileUrlResolver.isSubmissionKeyFor(key, ASSIGNMENT_ID, 8L)).as(key).isFalse();
        }
        assertThat(SubmissionFileUrlResolver.newSubmissionKey(ASSIGNMENT_ID, STUDENT_ID, 1756000000000L, ".jpg"))
                .isEqualTo(KEY);
    }
}
