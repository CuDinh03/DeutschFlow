package com.deutschflow.speaking;

import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.speaking.ai.AiChatCompletionResult;
import com.deutschflow.speaking.ai.OpenAiChatClient;
import com.deutschflow.speaking.entity.AiSpeakingMessage;
import com.deutschflow.speaking.entity.AiSpeakingSession;
import com.deutschflow.speaking.repository.AiSpeakingMessageRepository;
import com.deutschflow.speaking.repository.AiSpeakingSessionRepository;
import com.deutschflow.speaking.service.AiSpeakingService;
import com.deutschflow.teacher.entity.AssignmentStatus;
import com.deutschflow.teacher.entity.ClassAssignment;
import com.deutschflow.teacher.entity.ClassStudent;
import com.deutschflow.teacher.entity.ClassStudentId;
import com.deutschflow.teacher.entity.StudentAssignment;
import com.deutschflow.teacher.entity.TeacherClass;
import com.deutschflow.teacher.repository.ClassAssignmentRepository;
import com.deutschflow.teacher.repository.ClassStudentRepository;
import com.deutschflow.teacher.repository.StudentAssignmentRepository;
import com.deutschflow.teacher.repository.TeacherClassRepository;
import com.deutschflow.teacher.service.TeacherAiGradingService;
import com.deutschflow.testsupport.AbstractPostgresIntegrationTest;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;

import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.Mockito.when;

/**
 * Đ9 (13/09/2026) — lỗ IDOR trên đường bài giao NÓI, trên PostgreSQL thật.
 *
 * <p>{@code CreateSessionRequest.assignmentId} là {@code student_assignments.id} (khoá chính, tăng dần,
 * dễ đoán) và đi thẳng vào {@code AiSpeakingSession.assignmentId} mà không ai kiểm chủ sở hữu. Khi phiên
 * kết thúc, {@code TeacherAiGradingService} đọc lại id đó và GHI điểm AI lên đúng dòng ấy ⇒ học viên A
 * truyền id dòng của học viên B thì điểm/nhận xét của A đè lên bài của B (hoặc đẩy bài của B sang
 * {@code GRADING_FAILED} qua đường lỗi). Đây là hỏng dữ liệu học vụ, không chỉ rò đọc.
 *
 * <p>Cổng phải fail-closed và trả 404 (không phải 403) để không xác nhận id nào có thật — cùng khuôn với
 * {@code OrgService.getStudentDetail}.
 */
@SpringBootTest
@DisplayName("Đ9: phiên nói không được ghi điểm lên bài của học viên khác")
class SpeakingAssignmentOwnershipIntegrationTest extends AbstractPostgresIntegrationTest {

    @Autowired private AiSpeakingService aiSpeakingService;
    @Autowired private TeacherAiGradingService teacherAiGradingService;
    @Autowired private UserRepository userRepository;
    @Autowired private TeacherClassRepository classRepository;
    @Autowired private ClassStudentRepository classStudentRepository;
    @Autowired private ClassAssignmentRepository classAssignmentRepository;
    @Autowired private StudentAssignmentRepository studentAssignmentRepository;
    @Autowired private AiSpeakingSessionRepository sessionRepository;
    @Autowired private AiSpeakingMessageRepository messageRepository;

    /** Chấm nền gọi LLM thật — giả lập để ca chạy tất định và để chứng minh CÓ/KHÔNG ghi điểm. */
    @MockBean private OpenAiChatClient openAiChatClient;

    private Long studentA;
    private Long studentB;
    /** Dòng {@code student_assignments} của B — thứ A cố ghi đè. */
    private Long rowOfB;
    /** Dòng {@code student_assignments} của chính A — đường hợp lệ. */
    private Long rowOfA;

    @BeforeEach
    void seedClassWithTwoStudents() {
        long nonce = System.nanoTime();
        User teacher = userRepository.save(User.builder()
                .email("d9-teacher-" + nonce + "@local.test").passwordHash("$2a$10$h")
                .displayName("GV Đ9").role(User.Role.TEACHER).build());
        User a = userRepository.save(User.builder()
                .email("d9-a-" + nonce + "@local.test").passwordHash("$2a$10$h")
                .displayName("Học viên A").role(User.Role.STUDENT).build());
        User b = userRepository.save(User.builder()
                .email("d9-b-" + nonce + "@local.test").passwordHash("$2a$10$h")
                .displayName("Học viên B").role(User.Role.STUDENT).build());
        studentA = a.getId();
        studentB = b.getId();

        TeacherClass klass = classRepository.save(TeacherClass.builder()
                .name("Lớp Đ9 " + nonce).teacherId(teacher.getId())
                .inviteCode("D9" + (nonce % 100000)).build());
        classStudentRepository.save(ClassStudent.builder()
                .id(new ClassStudentId(klass.getId(), studentA)).build());
        classStudentRepository.save(ClassStudent.builder()
                .id(new ClassStudentId(klass.getId(), studentB)).build());

        ClassAssignment ca = classAssignmentRepository.save(ClassAssignment.builder()
                .classId(klass.getId()).topic("Sprechen: giới thiệu bản thân")
                .assignmentType("SPEAKING_SCENARIO").skill("SPRECHEN").build());

        rowOfA = studentAssignmentRepository.save(StudentAssignment.builder()
                .assignmentId(ca.getId()).studentId(studentA).status(AssignmentStatus.PENDING).build()).getId();
        rowOfB = studentAssignmentRepository.save(StudentAssignment.builder()
                .assignmentId(ca.getId()).studentId(studentB).status(AssignmentStatus.PENDING).build()).getId();
    }

    // ── Đường TẠO phiên: cổng sở hữu, fail-closed ───────────────────────────

    @Test
    @DisplayName("A tạo phiên với assignmentId của B → 404, không phiên nào mang link đó")
    void createSession_withForeignAssignmentId_isRejected() {
        assertThatThrownBy(() -> aiSpeakingService.createSession(
                studentA, "Thema", "A2", "DEFAULT", "V1", "LESSON", null, null, rowOfB))
                .isInstanceOf(NotFoundException.class);

        assertThat(sessionRepository.findAll())
                .as("không được tồn tại phiên nào của A trỏ vào dòng bài của B")
                .noneMatch(s -> studentA.equals(s.getUserId()) && rowOfB.equals(s.getAssignmentId()));
        assertUntouched(rowOfB);
    }

    @Test
    @DisplayName("A tạo phiên với assignmentId không tồn tại → 404 (fail-closed, không link câm)")
    void createSession_withUnknownAssignmentId_isRejected() {
        long ghost = rowOfB + 1_000_000L;

        assertThatThrownBy(() -> aiSpeakingService.createSession(
                studentA, "Thema", "A2", "DEFAULT", "V1", "LESSON", null, null, ghost))
                .isInstanceOf(NotFoundException.class);
    }

    // ── Đường KẾT phiên: kiểm lại trước khi ghi (bài có thể đổi chủ giữa chừng) ──

    @Test
    @DisplayName("Phiên của A mang link tới bài của B → chấm nền KHÔNG ghi gì lên bài của B")
    void autoGrade_withForeignLink_doesNotWriteToVictim() throws InterruptedException {
        stubGrader("{\"score\":97,\"feedback\":\"A tự chấm cho mình\"}");
        Long sessionId = seedEndedSession(studentA, rowOfB);

        teacherAiGradingService.autoGradeSession(sessionId);

        awaitSessionGraded(sessionId);
        assertUntouched(rowOfB);
        assertUntouched(rowOfA);
    }

    @Test
    @DisplayName("Phiên của A mang link tới bài của CHÍNH A → chấm bình thường, PENDING đi qua SUBMITTED")
    void autoGrade_withOwnLink_stillGradesAndStampsSubmittedAt() throws InterruptedException {
        stubGrader("{\"score\":72,\"feedback\":\"khá ổn\"}");
        Long sessionId = seedEndedSession(studentA, rowOfA);

        teacherAiGradingService.autoGradeSession(sessionId);

        awaitSessionGraded(sessionId);
        StudentAssignment mine = studentAssignmentRepository.findById(rowOfA).orElseThrow();
        assertThat(mine.getStatus()).isEqualTo(AssignmentStatus.AI_GRADED);
        assertThat(mine.getScore()).isEqualTo(72);
        assertThat(mine.getSubmittedAt())
                .as("phiên nói CHÍNH LÀ bài nộp — dòng PENDING phải được đóng dấu giờ nộp, "
                        + "không nhảy thẳng sang AI_GRADED với submittedAt rỗng")
                .isNotNull();
        assertUntouched(rowOfB);
    }

    // ── helpers ─────────────────────────────────────────────────────────────

    private void assertUntouched(Long rowId) {
        StudentAssignment row = studentAssignmentRepository.findById(rowId).orElseThrow();
        assertThat(row.getStatus()).as("trạng thái bài #%s", rowId).isEqualTo(AssignmentStatus.PENDING);
        assertThat(row.getScore()).as("điểm bài #%s", rowId).isNull();
        assertThat(row.getFeedback()).as("nhận xét bài #%s", rowId).isNull();
        assertThat(row.getAiScore()).as("điểm AI bài #%s", rowId).isNull();
        assertThat(row.getGradedAt()).as("giờ chấm bài #%s", rowId).isNull();
    }

    private void stubGrader(String json) {
        when(openAiChatClient.chatCompletion(any(), any(), anyDouble(), any()))
                .thenReturn(new AiChatCompletionResult(json, null, "test", "fake-model"));
    }

    /** Phiên đã kết thúc, đủ 3 lượt nói của học viên để qua ngưỡng {@code MIN_USER_TURNS_FOR_GRADE}. */
    private Long seedEndedSession(Long ownerId, Long linkedAssignmentId) {
        AiSpeakingSession session = sessionRepository.save(AiSpeakingSession.builder()
                .userId(ownerId).assignmentId(linkedAssignmentId)
                .topic("Thema").cefrLevel("A2").sessionMode("LESSON")
                .status(AiSpeakingSession.SessionStatus.ENDED)
                .endedAt(LocalDateTime.now()).messageCount(3).build());
        for (String said : List.of("Hallo", "Mir geht es gut", "Ich lerne Deutsch")) {
            messageRepository.save(AiSpeakingMessage.builder()
                    .sessionId(session.getId()).role(AiSpeakingMessage.MessageRole.USER)
                    .userText(said).build());
        }
        return session.getId();
    }

    /**
     * {@code autoGradeSession} là {@code @Async("taskExecutor")} — gọi qua bean Spring là chạy trên
     * luồng khác. Chờ có mốc ghi trên PHIÊN (ai_score hoặc ai_feedback) rồi mới soi bài tập: mốc đó
     * luôn được ghi ở cả hai nhánh, kể cả nhánh cổng sở hữu chặn ghi sang bài tập.
     */
    private void awaitSessionGraded(Long sessionId) throws InterruptedException {
        for (int i = 0; i < 50; i++) {
            AiSpeakingSession s = sessionRepository.findById(sessionId).orElseThrow();
            if (s.getAiScore() != null || s.getAiFeedback() != null) return;
            Thread.sleep(100);
        }
        throw new AssertionError("Chấm nền không kết thúc trong 5 giây cho phiên " + sessionId);
    }
}
