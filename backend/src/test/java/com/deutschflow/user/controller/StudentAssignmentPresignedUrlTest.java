package com.deutschflow.user.controller;

import com.deutschflow.common.exception.ForbiddenException;
import com.deutschflow.common.minor.ConsentState;
import com.deutschflow.common.minor.MinorAudioBlockedException;
import com.deutschflow.common.minor.MinorGate;
import com.deutschflow.common.minor.MinorLearnerService;
import com.deutschflow.common.minor.MinorPolicy;
import com.deutschflow.common.minor.StudentConsent;
import com.deutschflow.common.transaction.RunAfterCommitService;
import com.deutschflow.material.service.MaterialService;
import com.deutschflow.media.service.S3StorageService;
import com.deutschflow.notification.service.NotificationAutoAckService;
import com.deutschflow.teacher.entity.ClassAssignment;
import com.deutschflow.teacher.repository.ClassAssignmentRepository;
import com.deutschflow.teacher.repository.ClassStudentRepository;
import com.deutschflow.teacher.repository.StudentAssignmentRepository;
import com.deutschflow.teacher.service.SubmissionFileUrlResolver;
import com.deutschflow.teacher.service.TeacherService;
import com.deutschflow.user.entity.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * DEC-22 / ORG-23 — điểm cắm thứ bảy của {@link MinorGate}: URL tải lên tệp ghi âm cho bài nộp.
 *
 * <p>Sáu đường của PR-1B đều là đường PHIÊN ÂM; đường này là đường LƯU TRỮ (V320 §4 ghi nợ). Dùng
 * {@link MinorGate} THẬT với {@link MinorLearnerService} giả để ca nói đúng điều nó kiểm: một học
 * viên 17 tuổi chưa có đồng ý ghi âm — chứ không phải "một mock ném lỗi".
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
@DisplayName("Presigned URL nộp bài — cổng MinorGate cho tệp mang giọng nói (DEC-22)")
class StudentAssignmentPresignedUrlTest {

    private static final Long STUDENT_ID = 7L;
    private static final Long ASSIGNMENT_ID = 500L;
    private static final Long CLASS_ID = 100L;

    @Mock private TeacherService teacherService;
    @Mock private StudentAssignmentRepository studentAssignmentRepository;
    @Mock private ClassAssignmentRepository classAssignmentRepository;
    @Mock private ClassStudentRepository classStudentRepository;
    @Mock private S3StorageService s3StorageService;
    @Mock private MaterialService materialService;
    @Mock private NotificationAutoAckService notificationAutoAckService;
    @Mock private RunAfterCommitService runAfterCommitService;
    @Mock private SubmissionFileUrlResolver submissionFileUrlResolver;
    @Mock private MinorLearnerService learnerService;
    @Mock private JdbcTemplate jdbcTemplate;

    private StudentAssignmentController controller;
    private User student;

    @BeforeEach
    void setUp() {
        MinorGate gate = new MinorGate(learnerService, jdbcTemplate, "BLOCK_ORG_MEMBERS", "BLOCK_ORG_MEMBERS");
        controller = new StudentAssignmentController(teacherService, studentAssignmentRepository,
                classAssignmentRepository, classStudentRepository, s3StorageService, materialService,
                notificationAutoAckService, runAfterCommitService, submissionFileUrlResolver, gate);

        student = new User();
        student.setId(STUDENT_ID);
        when(classAssignmentRepository.findById(ASSIGNMENT_ID)).thenReturn(Optional.of(
                ClassAssignment.builder().id(ASSIGNMENT_ID).classId(CLASS_ID).topic("Sprechen").build()));
        when(classStudentRepository.existsByIdClassIdAndIdStudentId(CLASS_ID, STUDENT_ID)).thenReturn(true);
        when(s3StorageService.generatePresignedUrl(anyString(), anyString())).thenReturn("https://s3/put");
    }

    private void tuoi(MinorPolicy.Status status) {
        when(learnerService.statusOf(STUDENT_ID)).thenReturn(status);
    }

    private void dongYGhiAm(ConsentState state) {
        when(learnerService.consentStatus(STUDENT_ID, StudentConsent.Scope.AUDIO_RECORDING)).thenReturn(state);
    }

    @Test
    @DisplayName("17 tuổi chưa có đồng ý ghi âm + audio/m4a → 403 MINOR_AUDIO_BLOCKED, KHÔNG ký URL")
    void minor17ChuaDongY_audio_biChan() {
        tuoi(MinorPolicy.Status.MINOR_CENTER_POLICY);
        dongYGhiAm(ConsentState.NEVER_RECORDED);

        assertThatThrownBy(() -> controller.getPresignedUrl(student, ASSIGNMENT_ID, "antwort.m4a", "audio/m4a"))
                .isInstanceOf(MinorAudioBlockedException.class)
                .satisfies(ex -> assertThat(((MinorAudioBlockedException) ex).getReason())
                        .isEqualTo(MinorAudioBlockedException.Reason.GUARDIAN_CONSENT_REQUIRED));
        // Mã máy đọc được mà GlobalExceptionHandler đặt vào body 403 — mobile rẽ nhánh theo nó.
        assertThat(MinorAudioBlockedException.CODE).isEqualTo("MINOR_AUDIO_BLOCKED");
        verify(s3StorageService, never()).generatePresignedUrl(anyString(), anyString());
    }

    @Test
    @DisplayName("cùng học viên đó nộp application/pdf → không hỏi cổng, ký URL bình thường")
    void minor17_pdf_khongQuaCong() {
        tuoi(MinorPolicy.Status.MINOR_CENTER_POLICY);
        dongYGhiAm(ConsentState.NEVER_RECORDED);

        var out = controller.getPresignedUrl(student, ASSIGNMENT_ID, "aufsatz.pdf", "application/pdf");

        assertThat(out.getBody()).isNotNull();
        assertThat(out.getBody().getUrl()).isEqualTo("https://s3/put");
        assertThat(out.getBody().getObjectKey()).startsWith("assignments/500/7_").endsWith(".pdf");
        verifyNoInteractions(learnerService);
    }

    @Test
    @DisplayName("người đủ tuổi + audio/m4a → cổng được hỏi, đi qua, ký URL")
    void adult_audio_diQua() {
        tuoi(MinorPolicy.Status.ADULT);

        var out = controller.getPresignedUrl(student, ASSIGNMENT_ID, "antwort.m4a", "audio/m4a; codecs=mp4a.40.2");

        assertThat(out.getBody()).isNotNull();
        assertThat(out.getBody().getObjectKey()).endsWith(".m4a");
        verify(learnerService).statusOf(STUDENT_ID);
        verify(s3StorageService).generatePresignedUrl(anyString(), anyString());
    }

    @Test
    @DisplayName("video/mp4 cũng mang giọng nói → chặn như audio")
    void minor_video_biChan() {
        tuoi(MinorPolicy.Status.MINOR_LEGAL);
        dongYGhiAm(ConsentState.REVOKED);

        assertThatThrownBy(() -> controller.getPresignedUrl(student, ASSIGNMENT_ID, "vortrag.mp4", "video/mp4"))
                .isInstanceOf(MinorAudioBlockedException.class)
                .satisfies(ex -> assertThat(((MinorAudioBlockedException) ex).getReason())
                        .isEqualTo(MinorAudioBlockedException.Reason.GUARDIAN_CONSENT_REVOKED));
        verify(s3StorageService, never()).generatePresignedUrl(anyString(), anyString());
    }

    @Test
    @DisplayName("không còn thuộc lớp → 403 quyền lớp TRƯỚC, cổng tuổi không bị hỏi")
    void khongThuocLop_403TruocCong() {
        when(classStudentRepository.existsByIdClassIdAndIdStudentId(CLASS_ID, STUDENT_ID)).thenReturn(false);

        assertThatThrownBy(() -> controller.getPresignedUrl(student, ASSIGNMENT_ID, "antwort.m4a", "audio/m4a"))
                .isInstanceOf(ForbiddenException.class);
        verifyNoInteractions(learnerService);
        verify(s3StorageService, never()).generatePresignedUrl(anyString(), anyString());
    }

    @Test
    @DisplayName("isAudioBearing: audio/* và video/* là có, còn lại là không")
    void isAudioBearing() {
        assertThat(StudentAssignmentController.isAudioBearing("audio/m4a")).isTrue();
        assertThat(StudentAssignmentController.isAudioBearing("audio/mpeg")).isTrue();
        assertThat(StudentAssignmentController.isAudioBearing("video/mp4")).isTrue();
        assertThat(StudentAssignmentController.isAudioBearing("image/jpeg")).isFalse();
        assertThat(StudentAssignmentController.isAudioBearing("application/pdf")).isFalse();
        assertThat(StudentAssignmentController.isAudioBearing("text/plain")).isFalse();
        assertThat(StudentAssignmentController.isAudioBearing("")).isFalse();
    }

    /** Lưới an toàn: hằng bị đổi mà quên kiểm lại cổng — mọi MIME audio/video trong danh sách đều phải qua cổng. */
    @Test
    @DisplayName("mọi MIME được phép mà mang giọng nói đều rơi vào isAudioBearing")
    void danhSachMimeKhongCoLoHong() {
        tuoi(MinorPolicy.Status.MINOR_LEGAL);
        dongYGhiAm(ConsentState.NEVER_RECORDED);
        for (String mime : new String[] {"audio/mpeg", "audio/mp3", "audio/wav", "audio/ogg", "audio/webm",
                "audio/mp4", "audio/m4a", "audio/x-m4a", "audio/aac", "video/mp4"}) {
            assertThatThrownBy(() -> controller.getPresignedUrl(student, ASSIGNMENT_ID, "f", mime))
                    .as("MIME %s phải bị cổng chặn", mime)
                    .isInstanceOf(MinorAudioBlockedException.class);
        }
        verify(s3StorageService, never()).generatePresignedUrl(anyString(), anyString());
    }
}
