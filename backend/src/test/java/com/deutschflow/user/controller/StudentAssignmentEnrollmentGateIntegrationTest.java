package com.deutschflow.user.controller;

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
import com.deutschflow.testsupport.AbstractPostgresIntegrationTest;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * AC-ORG-CT-07 (DEC-17) qua chuỗi thật (filter chain → controller → JPA → Postgres):
 * học viên có {@code class_students.status = ENDED} gọi thẳng API nộp lại bài cũ thì bị chặn, dòng cũ
 * đứng yên; nhưng vẫn đọc được bài và điểm của chính mình.
 *
 * <p>Vì sao cần DB thật bên cạnh unit: biên quyền nằm trong JPQL của
 * {@code ClassStudentRepository.existsByIdClassIdAndIdStudentId} ({@code status IN ('ACTIVE','RESERVED')})
 * — unit test chỉ mock được câu trả lời của nó, còn việc ENDED THẬT SỰ rơi ra ngoài tập đó thì chỉ
 * Postgres chứng minh. Tự skip khi không có Postgres — xem {@link AbstractPostgresIntegrationTest}.
 */
@SpringBootTest
@AutoConfigureMockMvc
@DisplayName("AC-ORG-CT-07: học viên đã rời lớp không nộp đè được bài cũ (DEC-17)")
class StudentAssignmentEnrollmentGateIntegrationTest extends AbstractPostgresIntegrationTest {

    private static final String SUBMIT = "/api/v2/students/assignments/{id}/submit";
    private static final String OLD_CONTENT = "bản cũ — nộp lúc còn học";

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private UserRepository userRepository;
    @Autowired private TeacherClassRepository classRepository;
    @Autowired private ClassAssignmentRepository classAssignmentRepository;
    @Autowired private ClassStudentRepository classStudentRepository;
    @Autowired private StudentAssignmentRepository studentAssignmentRepository;

    private ClassAssignment assignment;

    @BeforeEach
    void seedClassWithOneAssignment() {
        User teacher = userRepository.save(User.builder()
                .email("gate-teacher-" + UUID.randomUUID() + "@local.test").passwordHash("x")
                .displayName("Gate Teacher").role(User.Role.TEACHER).build());
        TeacherClass klass = classRepository.save(TeacherClass.builder()
                .teacherId(teacher.getId()).name("Gate A1")
                .inviteCode("GATE-" + System.nanoTime()).build());
        assignment = classAssignmentRepository.save(ClassAssignment.builder()
                .classId(klass.getId()).topic("Sprechen: Tagesablauf").assignmentType("GENERAL").build());
    }

    @Test
    @DisplayName("ENDED + còn dòng SUBMITTED cũ → POST submit 403, nội dung cũ không đổi")
    void ended_resubmit_isForbidden_rowUntouched() throws Exception {
        User ended = enrolled(ClassStudent.STATUS_ENDED);
        submittedRow(ended);

        mockMvc.perform(submit(ended, "nộp đè sau khi bị gỡ")).andExpect(status().isForbidden());

        StudentAssignment row = rowOf(ended);
        assertThat(row.getStatus()).isEqualTo(AssignmentStatus.SUBMITTED);
        assertThat(row.getSubmissionContent()).isEqualTo(OLD_CONTENT);
    }

    @Test
    @DisplayName("ENDED + chưa có dòng → 403 và KHÔNG tạo dòng PENDING")
    void ended_firstSubmit_isForbidden_noRowCreated() throws Exception {
        User ended = enrolled(ClassStudent.STATUS_ENDED);

        mockMvc.perform(submit(ended, "bài làm muộn")).andExpect(status().isForbidden());

        assertThat(studentAssignmentRepository.findByStudentIdAndAssignmentId(ended.getId(), assignment.getId()))
                .isEmpty();
    }

    @Test
    @DisplayName("ENDED → không cấp được URL tải tệp lên (đường ghi thứ hai)")
    void ended_presignedUrl_isForbidden() throws Exception {
        User ended = enrolled(ClassStudent.STATUS_ENDED);

        mockMvc.perform(get("/api/v2/students/assignments/presigned-url")
                        .param("assignmentId", String.valueOf(assignment.getId()))
                        .param("filename", "aufsatz.pdf")
                        .param("contentType", "application/pdf")
                        .with(user(ended)))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("ENDED vẫn ĐỌC được bài và điểm của chính mình (DEC-17 — nửa còn lại của AC-ORG-CT-07)")
    void ended_stillReadsOwnWork() throws Exception {
        User ended = enrolled(ClassStudent.STATUS_ENDED);
        StudentAssignment row = submittedRow(ended);
        row.setStatus(AssignmentStatus.EVALUATED);
        row.setScore(88);
        row.setFeedback("Gut gemacht");
        studentAssignmentRepository.save(row);

        String body = mockMvc.perform(get("/api/v2/students/assignments").with(user(ended)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);

        JsonNode rows = objectMapper.readTree(body);
        assertThat(rows.size()).as("phải thấy đúng bài của mình: " + body).isEqualTo(1);
        assertThat(rows.get(0).path("assignmentId").asLong()).isEqualTo(assignment.getId());
        assertThat(rows.get(0).path("status").asText()).isEqualTo(AssignmentStatus.EVALUATED);
        assertThat(rows.get(0).path("teacherScore").intValue()).isEqualTo(88);
    }

    @Test
    @DisplayName("ACTIVE + còn dòng SUBMITTED cũ → nộp lại 200, nội dung đổi (đối chứng dương)")
    void active_resubmit_stillWorks() throws Exception {
        User active = enrolled(ClassStudent.STATUS_ACTIVE);
        submittedRow(active);

        mockMvc.perform(submit(active, "bản sửa")).andExpect(status().isOk());

        assertThat(rowOf(active).getSubmissionContent()).isEqualTo("bản sửa");
    }

    // ── helpers ─────────────────────────────────────────────────────────────────────────────

    private User enrolled(String status) {
        User student = userRepository.save(User.builder()
                .email("gate-student-" + UUID.randomUUID() + "@local.test").passwordHash("x")
                .displayName("Gate Student " + status).role(User.Role.STUDENT).build());
        boolean left = ClassStudent.STATUS_ENDED.equals(status);
        classStudentRepository.save(ClassStudent.builder()
                .id(ClassStudentId.builder().classId(assignment.getClassId()).studentId(student.getId()).build())
                .status(status)
                .endedAt(left ? LocalDateTime.now() : null)
                .endReason(left ? ClassStudent.END_REASON_BY_TEACHER : null)
                .build());
        return student;
    }

    private StudentAssignment submittedRow(User student) {
        return studentAssignmentRepository.save(StudentAssignment.builder()
                .assignmentId(assignment.getId()).studentId(student.getId())
                .status(AssignmentStatus.SUBMITTED).submissionContent(OLD_CONTENT)
                .submittedAt(LocalDateTime.now().minusDays(3)).build());
    }

    private StudentAssignment rowOf(User student) {
        return studentAssignmentRepository.findByStudentIdAndAssignmentId(student.getId(), assignment.getId())
                .orElseThrow();
    }

    private org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder submit(User student, String content) {
        return post(SUBMIT, assignment.getId())
                .with(user(student))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"submissionContent\":\"" + content + "\"}");
    }
}
