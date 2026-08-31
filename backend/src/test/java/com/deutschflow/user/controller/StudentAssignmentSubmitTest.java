package com.deutschflow.user.controller;

import com.deutschflow.common.exception.ConflictException;
import com.deutschflow.common.transaction.RunAfterCommitService;
import com.deutschflow.material.service.MaterialService;
import com.deutschflow.media.service.S3StorageService;
import com.deutschflow.notification.service.NotificationAutoAckService;
import com.deutschflow.teacher.entity.AssignmentStatus;
import com.deutschflow.teacher.entity.ClassAssignment;
import com.deutschflow.teacher.entity.StudentAssignment;
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
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Nộp lại bài.
 *
 * <p>Điều kiện cũ là {@code !PENDING → 409}: nộp xong là hết đường quay lại — chọn nhầm ảnh, bấm nộp
 * khi bài còn dở, thu âm hỏng đều thành vĩnh viễn, và giáo viên chấm đúng cái file sai đó. Nay chốt
 * duy nhất là ĐIỂM ĐÃ CHỐT ({@code EVALUATED}/{@code GRADED}); mọi trạng thái chưa-ai-chấm-xong đều
 * nộp lại được.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class StudentAssignmentSubmitTest {

    private static final Long STUDENT_ID = 7L;
    private static final Long ASSIGNMENT_ID = 500L;

    @Mock private TeacherService teacherService;
    @Mock private StudentAssignmentRepository studentAssignmentRepository;
    @Mock private ClassAssignmentRepository classAssignmentRepository;
    @Mock private ClassStudentRepository classStudentRepository;
    @Mock private S3StorageService s3StorageService;
    @Mock private MaterialService materialService;
    @Mock private NotificationAutoAckService notificationAutoAckService;
    @Mock private RunAfterCommitService runAfterCommitService;
    @Mock private SubmissionFileUrlResolver submissionFileUrlResolver;

    @InjectMocks private StudentAssignmentController controller;

    private User student;

    @BeforeEach
    void setUp() {
        student = new User();
        student.setId(STUDENT_ID);
        student.setDisplayName("Nguyễn An");
        when(studentAssignmentRepository.save(any(StudentAssignment.class))).thenAnswer(i -> i.getArgument(0));
        when(classAssignmentRepository.findById(ASSIGNMENT_ID)).thenReturn(Optional.of(
                ClassAssignment.builder().id(ASSIGNMENT_ID).classId(100L).topic("Hörübung").build()));
        when(submissionFileUrlResolver.resolve(anyString())).thenAnswer(i -> i.getArgument(0));
    }

    @Test
    @DisplayName("nộp lại khi bài mới chỉ ở trạng thái đã nộp — thay được nội dung và file")
    void resubmit_whenSubmitted_replacesContent() {
        StudentAssignment row = row(AssignmentStatus.SUBMITTED);
        row.setSubmissionFileUrl("https://s3/assignments/500/7_old.jpg");
        stubExisting(row);

        controller.submitAssignment(student, ASSIGNMENT_ID, submitRequest("bản sửa", "https://s3/assignments/500/7_new.jpg"));

        assertThat(row.getStatus()).isEqualTo(AssignmentStatus.SUBMITTED);
        assertThat(row.getSubmissionContent()).isEqualTo("bản sửa");
        assertThat(row.getSubmissionFileUrl()).isEqualTo("https://s3/assignments/500/7_new.jpg");
    }

    @Test
    @DisplayName("nộp lại xoá điểm AI đã đề xuất cho bản CŨ — không để bản mới đội điểm bản cũ")
    void resubmit_whenAiGraded_clearsProposedGrade() {
        StudentAssignment row = row(AssignmentStatus.AI_GRADED);
        row.setScore(72);
        row.setFeedback("Nhận xét của AI cho bản cũ");
        row.setAiConfidence(80);
        row.setCriteria(new LinkedHashMap<>(Map.of("grammar", 70)));
        row.setGradedAt(java.time.LocalDateTime.now());
        stubExisting(row);

        controller.submitAssignment(student, ASSIGNMENT_ID, submitRequest("bản viết lại", null));

        assertThat(row.getStatus()).isEqualTo(AssignmentStatus.SUBMITTED);
        assertThat(row.getScore()).isNull();
        assertThat(row.getFeedback()).isNull();
        assertThat(row.getAiConfidence()).isNull();
        assertThat(row.getCriteria()).isNull();
        assertThat(row.getGradedAt()).isNull();
    }

    @Test
    @DisplayName("bài chấm AI lỗi vẫn nộp lại được (đó là lý do chính để nộp lại)")
    void resubmit_whenGradingFailed_isAllowed() {
        StudentAssignment row = row(AssignmentStatus.GRADING_FAILED);
        row.setFeedback("Chưa chấm tự động được, giáo viên sẽ chấm lại.");
        stubExisting(row);

        controller.submitAssignment(student, ASSIGNMENT_ID, submitRequest("thử lại", null));

        assertThat(row.getStatus()).isEqualTo(AssignmentStatus.SUBMITTED);
        assertThat(row.getFeedback()).isNull();
    }

    @Test
    @DisplayName("giáo viên đã chốt điểm thì KHÔNG nộp đè — điểm đã công bố phải có căn cứ đứng yên")
    void resubmit_whenEvaluated_isRejected() {
        StudentAssignment row = row(AssignmentStatus.EVALUATED);
        row.setScore(85);
        row.setFeedback("Nhận xét của cô");
        stubExisting(row);

        assertThatThrownBy(() -> controller.submitAssignment(student, ASSIGNMENT_ID, submitRequest("nộp đè", null)))
                .isInstanceOf(ConflictException.class);
        assertThat(row.getScore()).isEqualTo(85);
        assertThat(row.getFeedback()).isEqualTo("Nhận xét của cô");
        verify(teacherService, never()).notifyTeachersOfSubmission(anyLong(), anyLong(), anyString());
    }

    @Test
    @DisplayName("GRADED của dữ liệu cũ cũng là điểm đã công bố — chặn như EVALUATED")
    void resubmit_whenLegacyGraded_isRejected() {
        stubExisting(row(AssignmentStatus.GRADED));

        assertThatThrownBy(() -> controller.submitAssignment(student, ASSIGNMENT_ID, submitRequest("nộp đè", null)))
                .isInstanceOf(ConflictException.class);
    }

    @Test
    @DisplayName("mỗi lần nộp lại đều báo cho giáo viên — bài đã đổi thì hàng đợi chấm phải biết")
    void resubmit_notifiesTeachersAgain() {
        stubExisting(row(AssignmentStatus.SUBMITTED));

        controller.submitAssignment(student, ASSIGNMENT_ID, submitRequest("bản 2", null));

        verify(teacherService).notifyTeachersOfSubmission(ASSIGNMENT_ID, STUDENT_ID, "Nguyễn An");
    }

    @Test
    @DisplayName("nộp lần đầu vẫn chạy như cũ")
    void firstSubmit_stillWorks() {
        StudentAssignment row = row(AssignmentStatus.PENDING);
        stubExisting(row);

        controller.submitAssignment(student, ASSIGNMENT_ID, submitRequest("bài làm", null));

        assertThat(row.getStatus()).isEqualTo(AssignmentStatus.SUBMITTED);
        assertThat(row.getSubmittedAt()).isNotNull();
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    private StudentAssignment row(String status) {
        return StudentAssignment.builder()
                .id(1L).assignmentId(ASSIGNMENT_ID).studentId(STUDENT_ID).status(status).build();
    }

    private void stubExisting(StudentAssignment row) {
        when(studentAssignmentRepository.findByStudentIdAndAssignmentId(STUDENT_ID, ASSIGNMENT_ID))
                .thenReturn(Optional.of(row));
    }

    private StudentAssignmentController.SubmitRequest submitRequest(String content, String fileUrl) {
        StudentAssignmentController.SubmitRequest req = new StudentAssignmentController.SubmitRequest();
        req.setSubmissionContent(content);
        req.setSubmissionFileUrl(fileUrl);
        return req;
    }
}
