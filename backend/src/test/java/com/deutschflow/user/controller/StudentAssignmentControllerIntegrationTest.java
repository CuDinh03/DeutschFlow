package com.deutschflow.user.controller;

import com.deutschflow.teacher.entity.AssignmentStatus;
import com.deutschflow.teacher.entity.ClassAssignment;
import com.deutschflow.teacher.entity.StudentAssignment;
import com.deutschflow.teacher.entity.TeacherClass;
import com.deutschflow.teacher.repository.ClassAssignmentRepository;
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
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Hợp đồng tầng controller cho việc che điểm nháp khỏi học viên (F01 — A1/#421).
 *
 * <p>{@code GET /api/v2/students/assignments} chạy qua đúng chuỗi thật (Spring Security filter
 * chain → controller → {@code StudentAssignmentDto.forStudent} → Jackson), nên test này khoá hợp
 * đồng ở đúng bề mặt học viên nhìn thấy — bổ sung cho unit test mapper
 * {@code StudentAssignmentDtoTest}:
 *
 * <ul>
 *   <li>Bài chưa final ({@code SUBMITTED}/{@code AI_GRADED}/{@code GRADING_FAILED}): JSON trả
 *       {@code teacherScore}/{@code teacherFeedback} không có giá trị, dù hàng DB CÓ điểm nháp —
 *       kể cả note lỗi vận hành của lượt chấm AI hỏng cũng không được lộ ra.</li>
 *   <li>Bài final ({@code EVALUATED}/{@code GRADED}): giữ nguyên giá trị.</li>
 *   <li>Che chỉ ở tầng trình bày — hàng DB vẫn giữ điểm nháp cho giáo viên duyệt.</li>
 *   <li>Gate {@code hasRole('STUDENT')}: TEACHER → 403, anonymous → 401 (filter chain thật).</li>
 * </ul>
 *
 * Self-skips khi không có Postgres — xem {@link AbstractPostgresIntegrationTest}.
 */
@SpringBootTest
@AutoConfigureMockMvc
@DisplayName("F01: hợp đồng che điểm nháp ở GET /api/v2/students/assignments")
class StudentAssignmentControllerIntegrationTest extends AbstractPostgresIntegrationTest {

    private static final String STUDENT_EMAIL = "assignment-masking-student@local.test";
    private static final String TEACHER_EMAIL = "assignment-masking-teacher@local.test";

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private UserRepository userRepository;
    @Autowired private TeacherClassRepository classRepository;
    @Autowired private ClassAssignmentRepository classAssignmentRepository;
    @Autowired private StudentAssignmentRepository studentAssignmentRepository;

    private User student;
    /** assignmentId theo status — để đối chiếu từng hàng JSON và reload hàng DB. */
    private final Map<String, Long> assignmentIdByStatus = new HashMap<>();

    private record Seed(String status, Integer score, String feedback) {}

    private static final List<Seed> SEEDS = List.of(
            // Chưa final: DB vẫn CÓ score/feedback (đề xuất AI, note lỗi ops) — hợp đồng là không lộ.
            new Seed(AssignmentStatus.SUBMITTED, 61, "AI note sớm — chưa ai xác nhận"),
            new Seed(AssignmentStatus.AI_GRADED, 62, "AI: Gut, aber Artikel prüfen"),
            new Seed(AssignmentStatus.GRADING_FAILED, 63, "AI lỗi: model timeout — cần chấm tay"),
            // Final: đã công bố cho học viên.
            new Seed(AssignmentStatus.EVALUATED, 87, "Sehr gut! Weiter so."),
            new Seed(AssignmentStatus.GRADED, 90, "Điểm legacy đã công bố"));

    @BeforeEach
    void seedStudentWithOneRowPerStatus() {
        student = userRepository.findByEmail(STUDENT_EMAIL).orElseGet(() -> userRepository.save(User.builder()
                .email(STUDENT_EMAIL).passwordHash("x").displayName("Masking Student")
                .role(User.Role.STUDENT).build()));
        User teacher = userRepository.findByEmail(TEACHER_EMAIL).orElseGet(() -> userRepository.save(User.builder()
                .email(TEACHER_EMAIL).passwordHash("x").displayName("Masking Teacher")
                .role(User.Role.TEACHER).build()));

        // Làm sạch hàng của học viên này trước mỗi test để GET trả về đúng 5 hàng của lượt seed.
        studentAssignmentRepository.deleteAll(
                studentAssignmentRepository.findByStudentIdOrderByCreatedAtDesc(student.getId()));
        assignmentIdByStatus.clear();

        TeacherClass klass = classRepository.save(TeacherClass.builder()
                .teacherId(teacher.getId()).name("Masking A1")
                .inviteCode("MASK-" + System.nanoTime()).build());

        for (Seed s : SEEDS) {
            ClassAssignment ca = classAssignmentRepository.save(ClassAssignment.builder()
                    .classId(klass.getId()).topic("Thema " + s.status()).assignmentType("GENERAL").build());
            studentAssignmentRepository.save(StudentAssignment.builder()
                    .assignmentId(ca.getId()).studentId(student.getId()).status(s.status())
                    .score(s.score()).feedback(s.feedback())
                    .submittedAt(LocalDateTime.now()).build());
            assignmentIdByStatus.put(s.status(), ca.getId());
        }
    }

    @Test
    @DisplayName("chưa final → teacherScore/teacherFeedback bị che; final → giữ nguyên giá trị")
    void draftGradesAreMaskedUntilFinal() throws Exception {
        String body = mockMvc.perform(get("/api/v2/students/assignments").with(user(student)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);

        JsonNode rows = objectMapper.readTree(body);
        assertEquals(SEEDS.size(), rows.size(), "GET phải trả về đúng các hàng của học viên: " + body);

        Map<String, JsonNode> byStatus = new HashMap<>();
        rows.forEach(r -> byStatus.put(r.path("status").asText(), r));

        for (Seed s : SEEDS) {
            JsonNode row = byStatus.get(s.status());
            assertNotNull(row, "thiếu hàng status=" + s.status() + " trong " + body);
            assertEquals(assignmentIdByStatus.get(s.status()).longValue(), row.path("assignmentId").asLong());
            if (AssignmentStatus.isFinal(s.status())) {
                assertEquals(s.score().intValue(), row.path("teacherScore").intValue(),
                        "final phải giữ điểm — hàng: " + row);
                assertEquals(s.feedback(), row.path("teacherFeedback").asText(),
                        "final phải giữ feedback — hàng: " + row);
            } else {
                assertHidden(row, "teacherScore");
                assertHidden(row, "teacherFeedback");
            }
        }
    }

    @Test
    @DisplayName("che chỉ ở tầng trình bày — hàng DB vẫn giữ điểm nháp cho giáo viên duyệt")
    void maskingIsViewOnly_dbRowKeepsDraftValues() throws Exception {
        mockMvc.perform(get("/api/v2/students/assignments").with(user(student)))
                .andExpect(status().isOk());

        StudentAssignment aiGraded = studentAssignmentRepository
                .findByStudentIdAndAssignmentId(student.getId(), assignmentIdByStatus.get(AssignmentStatus.AI_GRADED))
                .orElseThrow();
        assertEquals(62, aiGraded.getScore());
        assertEquals("AI: Gut, aber Artikel prüfen", aiGraded.getFeedback());
    }

    @Test
    @WithMockUser(roles = "TEACHER")
    @DisplayName("TEACHER bị 403 trên GET /api/v2/students/assignments")
    void teacherForbidden() throws Exception {
        mockMvc.perform(get("/api/v2/students/assignments")).andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("anonymous bị 401 trên GET /api/v2/students/assignments")
    void anonymousUnauthorized() throws Exception {
        mockMvc.perform(get("/api/v2/students/assignments")).andExpect(status().isUnauthorized());
    }

    /** Chấp nhận cả null lẫn vắng khoá — hợp đồng là "không có giá trị", không phụ thuộc cấu hình serialize null. */
    private static void assertHidden(JsonNode row, String field) {
        JsonNode v = row.path(field);
        assertTrue(v.isMissingNode() || v.isNull(),
                field + " phải bị che ở hàng chưa final, nhận: " + v + " — hàng: " + row);
    }
}
