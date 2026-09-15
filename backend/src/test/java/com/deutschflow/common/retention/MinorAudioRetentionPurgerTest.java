package com.deutschflow.common.retention;

import com.deutschflow.examspeaking.golden.ExamGoldenService;
import com.deutschflow.media.service.S3StorageService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.InjectMocks;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * Chốt HAI LỚP AN TOÀN của kho file bài nộp — phần nguy hiểm nhất của job, vì
 * {@code submission_file_url} đến NGUYÊN VĂN từ request body của học viên.
 *
 * <p>Mỗi ca ở đây tương ứng một cách mà job có thể xoá nhầm dữ liệu không lấy lại được.
 */
@ExtendWith(MockitoExtension.class)
class MinorAudioRetentionPurgerTest {

    private static final Instant CAPTURED = Instant.parse("2026-01-10T03:00:00Z");
    private static final String BUCKET_URL = "https://bucket.example.com/";

    @Mock
    ExamGoldenService examGoldenService;
    @Mock
    S3StorageService s3StorageService;
    @Mock
    JdbcTemplate jdbcTemplate;

    @InjectMocks
    MinorAudioRetentionPurger purger;

    @Nested
    @DisplayName("Chốt 1 — khoá S3 phải thuộc về đúng dòng bài nộp")
    class KeyOwnership {

        @Test
        @DisplayName("Khoá đúng khuôn assignments/<assignmentId>/<studentId>_ → đạt")
        void ownKeyPasses() {
            assertThat(MinorAudioRetentionPurger.belongsToCandidate(
                    "assignments/42/7_1736480000000.m4a", candidate(7L, 42L, "x"))).isTrue();
        }

        /**
         * Đây là cách tấn công rẻ nhất: nộp bài với {@code submissionFileUrl} trỏ vào tài liệu giảng
         * dạy hoặc tranh Galerie — cùng bucket, nên {@code objectKeyFromOwnUrl} vẫn trả khoá.
         */
        @Test
        @DisplayName("Khoá ngoài tiền tố assignments/ → chặn")
        void keyOutsideAssignmentsRootIsRejected() {
            assertThat(MinorAudioRetentionPurger.belongsToCandidate(
                    "materials/42/lesson.pdf", candidate(7L, 42L, "x"))).isFalse();
            assertThat(MinorAudioRetentionPurger.belongsToCandidate(
                    "galerie/artwork-12.png", candidate(7L, 42L, "x"))).isFalse();
        }

        @Test
        @DisplayName("Khoá của BÀI TẬP khác → chặn")
        void keyOfAnotherAssignmentIsRejected() {
            assertThat(MinorAudioRetentionPurger.belongsToCandidate(
                    "assignments/99/7_1736480000000.m4a", candidate(7L, 42L, "x"))).isFalse();
        }

        /**
         * Ca mà chốt tiền tố một mình KHÔNG bắt được: hai học viên cùng một bài tập. Không có lớp
         * kiểm tên file thì em A xoá được bản ghi âm của em B.
         */
        @Test
        @DisplayName("Khoá của HỌC VIÊN khác trong CÙNG bài tập → chặn")
        void keyOfAnotherStudentInSameAssignmentIsRejected() {
            assertThat(MinorAudioRetentionPurger.belongsToCandidate(
                    "assignments/42/8_1736480000000.m4a", candidate(7L, 42L, "x"))).isFalse();
        }

        @Test
        @DisplayName("Tiền tố id học viên phải trọn vẹn — 77_ không phải của học viên 7")
        void studentIdPrefixMustBeExact() {
            assertThat(MinorAudioRetentionPurger.belongsToCandidate(
                    "assignments/42/77_1736480000000.m4a", candidate(7L, 42L, "x"))).isFalse();
        }

        @Test
        @DisplayName("Khoá không đạt chốt → KHÔNG gọi deleteFile, đếm vào skippedUnsafeKey")
        void unsafeKeyIsNeverDeleted() {
            when(s3StorageService.objectKeyFromOwnUrl(anyString())).thenReturn("materials/42/lesson.pdf");

            MinorAudioPurgeTally tally = purger.purgeAssignmentUpload(
                    candidate(7L, 42L, BUCKET_URL + "materials/42/lesson.pdf"), false);

            assertThat(tally.skippedUnsafeKey()).isEqualTo(1);
            assertThat(tally.assignmentFiles()).isZero();
            verify(s3StorageService, never()).deleteFile(anyString());
            verifyNoInteractions(jdbcTemplate);
        }

        @Test
        @DisplayName("URL ngoài bucket của mình → bỏ qua, không xoá")
        void foreignUrlIsSkipped() {
            when(s3StorageService.objectKeyFromOwnUrl(anyString())).thenReturn(null);

            MinorAudioPurgeTally tally = purger.purgeAssignmentUpload(
                    candidate(7L, 42L, "https://drive.example.org/file"), false);

            assertThat(tally.skippedForeignUrl()).isEqualTo(1);
            verify(s3StorageService, never()).deleteFile(anyString());
        }
    }

    @Nested
    @DisplayName("Chốt 2 — chỉ bản ghi âm bị dọn, bài làm thuộc hồ sơ học tập thì giữ")
    class AudioOnly {

        @Test
        @DisplayName("Đuôi âm thanh/video → là bản ghi âm")
        void audioExtensionsRecognised() {
            assertThat(MinorAudioRetentionPurger.isAudioKey("assignments/42/7_1.m4a")).isTrue();
            assertThat(MinorAudioRetentionPurger.isAudioKey("assignments/42/7_1.WEBM")).isTrue();
            assertThat(MinorAudioRetentionPurger.isAudioKey("assignments/42/7_1.mp4")).isTrue();
        }

        @Test
        @DisplayName("Ảnh bài làm, PDF, DOCX → KHÔNG phải bản ghi âm")
        void homeworkFilesAreNotAudio() {
            assertThat(MinorAudioRetentionPurger.isAudioKey("assignments/42/7_1.jpg")).isFalse();
            assertThat(MinorAudioRetentionPurger.isAudioKey("assignments/42/7_1.pdf")).isFalse();
            assertThat(MinorAudioRetentionPurger.isAudioKey("assignments/42/7_1.docx")).isFalse();
        }

        @Test
        @DisplayName("Không có đuôi, hoặc dấu chấm nằm ở thư mục → giữ, không đoán")
        void unknownExtensionIsKept() {
            assertThat(MinorAudioRetentionPurger.isAudioKey("assignments/42/7_1736480000000")).isFalse();
            assertThat(MinorAudioRetentionPurger.isAudioKey("assignments/v1.2/7_1736480000000")).isFalse();
        }

        @Test
        @DisplayName("Ảnh bài làm của học viên vị thành niên vẫn KHÔNG bị xoá ở mốc 30 ngày")
        void homeworkImageSurvivesRetention() {
            when(s3StorageService.objectKeyFromOwnUrl(anyString())).thenReturn("assignments/42/7_1736480000000.jpg");

            MinorAudioPurgeTally tally = purger.purgeAssignmentUpload(
                    candidate(7L, 42L, BUCKET_URL + "assignments/42/7_1736480000000.jpg"), false);

            assertThat(tally.skippedNonAudio()).isEqualTo(1);
            verify(s3StorageService, never()).deleteFile(anyString());
        }
    }

    @Nested
    @DisplayName("Chế độ ĐẾM không được chạm vào dữ liệu")
    class DryRun {

        @Test
        @DisplayName("Bài nộp: đếm nhưng không xoá S3, không nhả cột")
        void assignmentDryRunTouchesNothing() {
            when(s3StorageService.objectKeyFromOwnUrl(anyString())).thenReturn("assignments/42/7_1736480000000.m4a");

            MinorAudioPurgeTally tally = purger.purgeAssignmentUpload(
                    candidate(7L, 42L, BUCKET_URL + "assignments/42/7_1736480000000.m4a"), true);

            assertThat(tally.assignmentFiles()).isEqualTo(1);
            verify(s3StorageService, never()).deleteFile(anyString());
            verifyNoInteractions(jdbcTemplate);
        }

        @Test
        @DisplayName("Phiên thi nói: chỉ ĐẾM object, không gọi purgeAudio")
        void examSpeakingDryRunOnlyCounts() {
            when(jdbcTemplate.queryForObject(anyString(), any(Class.class), any(Object.class))).thenReturn(3);

            MinorAudioPurgeTally tally = purger.purgeExamSpeakingSession(examCandidate(500L), true);

            assertThat(tally.sessions()).isEqualTo(1);
            assertThat(tally.objectsDeleted()).isEqualTo(3);
            verifyNoInteractions(examGoldenService);
        }

        @Test
        @DisplayName("ai_jobs: đếm số job, không chạy UPDATE")
        void aiJobDryRunOnlyCounts() {
            MinorAudioPurgeTally tally = purger.purgeAiJobPayloads(List.of(1L, 2L, 3L), true);

            assertThat(tally.aiJobPayloads()).isEqualTo(3);
            verifyNoInteractions(jdbcTemplate);
        }
    }

    @Nested
    @DisplayName("Xoá thật")
    class RealPurge {

        @Test
        @DisplayName("Xoá object TRƯỚC rồi mới nhả cột — S3 lỗi thì cột giữ nguyên để lượt sau thử lại")
        void s3FailureKeepsTheColumn() {
            when(s3StorageService.objectKeyFromOwnUrl(anyString())).thenReturn("assignments/42/7_1736480000000.m4a");
            org.mockito.Mockito.doThrow(new IllegalStateException("S3 down"))
                    .when(s3StorageService).deleteFile(anyString());

            MinorAudioPurgeTally tally = purger.purgeAssignmentUpload(
                    candidate(7L, 42L, BUCKET_URL + "assignments/42/7_1736480000000.m4a"), false);

            assertThat(tally.objectsFailed()).isEqualTo(1);
            assertThat(tally.assignmentFiles()).isZero();
            // Cột chưa bị nhả ⇒ không có object mồ côi, lượt sau nạp lại được (F-12).
            verify(jdbcTemplate, never()).update(anyString(), any(), any());
        }

        @Test
        @DisplayName("Phiên dọn trọn vẹn → đóng dấu audio_purged_at + lý do MINOR_RETENTION_30D")
        void fullyPurgedSessionIsStamped() {
            when(examGoldenService.purgeAudio(500L))
                    .thenReturn(new com.deutschflow.examspeaking.dto.GoldenView.PurgeResult(500L, 2, 0));

            purger.purgeExamSpeakingSession(examCandidate(500L), false);

            ArgumentCaptor<String> sql = ArgumentCaptor.forClass(String.class);
            verify(jdbcTemplate).update(sql.capture(), eq("MINOR_RETENTION_30D"), eq(500L));
            assertThat(sql.getValue())
                    .contains("audio_purged_at")
                    .contains("audio_purge_reason")
                    // Giữ dấu ĐẦU TIÊN — một lượt sau không được ghi đè mốc.
                    .contains("audio_purged_at IS NULL");
        }

        /**
         * 🪤 Đóng dấu khi còn key S3 thất bại là nói dối: tệp vẫn sống mà sổ ghi là đã xoá. Đúng cùng
         * chiều với F-12 — key thất bại giữ nguyên {@code audio_ref} để lượt sau thử lại.
         */
        @Test
        @DisplayName("Còn key S3 thất bại → KHÔNG đóng dấu")
        void partiallyPurgedSessionIsNotStamped() {
            when(examGoldenService.purgeAudio(500L))
                    .thenReturn(new com.deutschflow.examspeaking.dto.GoldenView.PurgeResult(500L, 1, 1));

            MinorAudioPurgeTally tally = purger.purgeExamSpeakingSession(examCandidate(500L), false);

            assertThat(tally.objectsFailed()).isEqualTo(1);
            verifyNoInteractions(jdbcTemplate);
        }

        @Test
        @DisplayName("Không có object nào để xoá → KHÔNG đóng dấu (dấu phải nói về một việc đã làm)")
        void nothingDeletedIsNotStamped() {
            when(examGoldenService.purgeAudio(500L))
                    .thenReturn(new com.deutschflow.examspeaking.dto.GoldenView.PurgeResult(500L, 0, 0));

            purger.purgeExamSpeakingSession(examCandidate(500L), false);

            verifyNoInteractions(jdbcTemplate);
        }

        @Test
        @DisplayName("ai_jobs: một câu UPDATE cho cả nhóm, có mệnh đề jsonb_exists để chạy lại không đếm nhầm")
        void aiJobPurgeUsesOneIdempotentStatement() {
            when(jdbcTemplate.update(anyString(), any(Object[].class))).thenReturn(2);

            MinorAudioPurgeTally tally = purger.purgeAiJobPayloads(List.of(1L, 2L), false);

            assertThat(tally.aiJobPayloads()).isEqualTo(2);
            org.mockito.ArgumentCaptor<String> sql = org.mockito.ArgumentCaptor.forClass(String.class);
            verify(jdbcTemplate).update(sql.capture(), any(Object[].class));
            assertThat(sql.getValue())
                    .contains("payload - 'audioBase64'")
                    .contains("jsonb_exists(payload, 'audioBase64')")
                    // 🪤 Toán tử `?` của JSONB trùng placeholder JDBC — chỉ được có đúng 2 dấu ? của IN.
                    .doesNotContain("payload ?");
        }
    }

    private static MinorAudioCandidate candidate(long studentId, Long assignmentId, String storedUrl) {
        return new MinorAudioCandidate(
                MinorAudioCandidate.Store.ASSIGNMENT_UPLOAD, 1_000L, studentId,
                LocalDate.of(2012, 1, 1), CAPTURED, storedUrl, assignmentId, 5L);
    }

    private static MinorAudioCandidate examCandidate(long sessionId) {
        return new MinorAudioCandidate(
                MinorAudioCandidate.Store.EXAM_SPEAKING_GOLDEN, sessionId, 7L,
                LocalDate.of(2012, 1, 1), CAPTURED, null, null, null);
    }
}
