package com.deutschflow.teacher.service;

import com.deutschflow.organization.entity.ClassCurriculumLink;
import com.deutschflow.organization.entity.OrgCurriculum;
import com.deutschflow.organization.entity.OrgCurriculumVersion;
import com.deutschflow.organization.repository.ClassCurriculumLinkRepository;
import com.deutschflow.organization.repository.OrgCurriculumRepository;
import com.deutschflow.organization.repository.OrgCurriculumVersionRepository;
import com.deutschflow.organization.service.OrgSettingsService;
import com.deutschflow.teacher.dto.MySkillReportDto;
import com.deutschflow.teacher.dto.StudentEvaluationDto;
import com.deutschflow.teacher.entity.ClassStudent;
import com.deutschflow.teacher.entity.ClassStudentId;
import com.deutschflow.teacher.entity.ClassTeacher;
import com.deutschflow.teacher.entity.ClassTeacherId;
import com.deutschflow.teacher.entity.StudentReportIssue;
import com.deutschflow.teacher.entity.TeacherClass;
import com.deutschflow.teacher.repository.ClassStudentRepository;
import com.deutschflow.teacher.repository.ClassTeacherRepository;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.jdbc.core.JdbcTemplate;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

/**
 * Khoá hình dạng {@code payload_json} của phiếu gửi gia đình (R4, §3.3): nguồn số liệu là đúng những
 * gì học viên đã thấy, khối chứng nhận CHỈ ở FINAL (R10), khối mục tiêu ẩn khi lớp không gắn giáo
 * trình, và — quan trọng nhất — KHÔNG có khoá nào mang email / ai_* / transcript / audio.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class ReportPayloadBuilderTest {

    private static final long CLASS_ID = 10L;
    private static final long STUDENT_ID = 20L;
    private static final long TEACHER_ID = 30L;
    private static final long ORG_ID = 5L;
    private static final Instant ISSUED_AT = Instant.parse("2026-09-10T08:00:00Z");

    @Mock StudentEvaluationService evaluationService;
    @Mock ObjectiveAssessmentService objectiveAssessmentService;
    @Mock ClassTeacherRepository classTeacherRepository;
    @Mock ClassStudentRepository classStudentRepository;
    @Mock ClassCurriculumLinkRepository curriculumLinkRepository;
    @Mock OrgCurriculumVersionRepository curriculumVersionRepository;
    @Mock OrgCurriculumRepository curriculumRepository;
    @Mock UserRepository userRepository;
    @Mock OrgSettingsService orgSettingsService;
    @Mock JdbcTemplate jdbcTemplate;

    @InjectMocks ReportPayloadBuilder builder;

    private TeacherClass cls;
    private User student;

    @BeforeEach
    void setUp() {
        cls = TeacherClass.builder().id(CLASS_ID).orgId(ORG_ID).teacherId(TEACHER_ID)
                .name("B1 tối thứ Ba").inviteCode("INV").build();
        student = User.builder().id(STUDENT_ID).email("em@test.local").passwordHash("x")
                .displayName("Nguyễn Đức Ánh").role(User.Role.STUDENT).build();

        when(evaluationService.evaluationOf(CLASS_ID, STUDENT_ID)).thenReturn(new StudentEvaluationDto(
                STUDENT_ID, "Nguyễn Đức Ánh", "em@test.local", CLASS_ID, "B1 tối thứ Ba",
                "Em tiến bộ rõ ở phần nói, cần luyện thêm ß/ü.",
                new BigDecimal("8.5"), new BigDecimal("7.0"), null, new BigDecimal("9.0"),
                78.4, 12, 10, 1, 1, true, LocalDateTime.of(2026, 9, 9, 10, 0)));
        when(evaluationService.mySkillReport(STUDENT_ID, CLASS_ID)).thenReturn(new MySkillReportDto(
                8.5, 7.0, null, 9.0, 8.1666, "Giỏi",
                "Em tiến bộ rõ ở phần nói, cần luyện thêm ß/ü.", LocalDateTime.of(2026, 9, 9, 10, 0)));
        when(evaluationService.assignmentCountsOf(CLASS_ID, STUDENT_ID))
                .thenReturn(new StudentEvaluationService.AssignmentCounts(4, 1));
        when(objectiveAssessmentService.summaryFor(CLASS_ID, STUDENT_ID)).thenReturn(Optional.of(
                new ObjectiveAssessmentService.StudentObjectiveSummary(12, 7, 3, 2,
                        List.of("Kann sich vorstellen", "Kann nach dem Weg fragen"))));
        when(classTeacherRepository.findByIdClassId(CLASS_ID)).thenReturn(List.of(
                ClassTeacher.builder().id(new ClassTeacherId(CLASS_ID, TEACHER_ID)).role("PRIMARY")
                        .joinedAt(LocalDateTime.of(2026, 8, 1, 0, 0)).build()));
        when(userRepository.findById(TEACHER_ID)).thenReturn(Optional.of(User.builder().id(TEACHER_ID)
                .email("gv@test.local").passwordHash("x").displayName("Cô Hạnh").role(User.Role.TEACHER).build()));
        when(classStudentRepository.findById(new ClassStudentId(CLASS_ID, STUDENT_ID))).thenReturn(Optional.of(
                ClassStudent.builder().id(new ClassStudentId(CLASS_ID, STUDENT_ID))
                        .joinedAt(LocalDateTime.of(2026, 8, 3, 9, 0)).build()));
        when(curriculumLinkRepository.findByClassId(CLASS_ID)).thenReturn(Optional.of(
                ClassCurriculumLink.builder().classId(CLASS_ID).versionId(77L).build()));
        when(curriculumVersionRepository.findById(77L)).thenReturn(Optional.of(
                OrgCurriculumVersion.builder().id(77L).curriculumId(66L).versionNo(1).build()));
        when(curriculumRepository.findById(66L)).thenReturn(Optional.of(
                OrgCurriculum.builder().id(66L).orgId(ORG_ID).name("B1 Alltag").cefrLevel("B1").build()));
        when(orgSettingsService.getInt(ORG_ID, OrgSettingsService.CERTIFICATE_MIN_AVG)).thenReturn(50);
        when(orgSettingsService.getInt(ORG_ID, OrgSettingsService.CERTIFICATE_MIN_ATTENDANCE_PCT)).thenReturn(80);
        // 🪤 queryForMap(String, Object...) vs (String, Object[], int[]): any(),any() trượt sang overload sau.
        when(jdbcTemplate.queryForMap(anyString(), any(Object[].class)))
                .thenReturn(Map.of("sessions", 12L, "minutes", new BigDecimal("85.4")));
        when(jdbcTemplate.queryForObject(anyString(), eq(Long.class), anyLong())).thenReturn(120L, 30L);
    }

    @Test
    @DisplayName("🔴 R4: payload không chứa khoá email / ai_* / transcript / audio / birth ở bất kỳ cấp nào")
    void payload_hasNoForbiddenKeys() {
        Map<String, Object> p = builder.build(cls, student, StudentReportIssue.Period.FINAL, "vi", ISSUED_AT, "TT Hoa Sen", null);

        String flat = flattenKeys(p, "").toLowerCase();
        for (String forbidden : List.of("email", "ai_", "aiscore", "aifeedback", "transcript", "audio", "birth")) {
            assertThat(flat).as("khoá cấm %s", forbidden).doesNotContain(forbidden);
        }
        // Giá trị cũng không được kéo email theo (StudentEvaluationDto có email — phải bị bỏ lại).
        assertThat(String.valueOf(p)).doesNotContain("em@test.local");
    }

    @Test
    @DisplayName("Nội dung R4: 4 kỹ năng mã hoá xếp loại, chuyên cần, bài tập, mục tiêu (tối đa 5 tên), tự học tổng hợp, nhận xét nguyên văn")
    void payload_shape() {
        Map<String, Object> p = builder.build(cls, student, StudentReportIssue.Period.MIDTERM, "de", ISSUED_AT, "TT Hoa Sen", "https://cdn/logo.png");

        assertThat(p).containsEntry("schemaVersion", ReportPayloadBuilder.SCHEMA_VERSION)
                .containsEntry("period", "MIDTERM").containsEntry("lang", "de")
                .containsEntry("issuedAt", ISSUED_AT.toString());
        assertThat(map(p.get("org"))).containsEntry("name", "TT Hoa Sen").containsEntry("logoUrl", "https://cdn/logo.png");
        assertThat(map(p.get("class"))).containsEntry("name", "B1 tối thứ Ba").containsEntry("level", "B1")
                .containsEntry("primaryTeacherName", "Cô Hạnh");
        assertThat(map(p.get("student"))).containsEntry("name", "Nguyễn Đức Ánh").containsEntry("joinedAt", "2026-08-03")
                .doesNotContainKey("email");

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> skills = (List<Map<String, Object>>) p.get("skills");
        assertThat(skills).extracting(s -> s.get("code")).containsExactly("HOREN", "LESEN", "SCHREIBEN", "SPRECHEN");
        assertThat(skills.get(0)).containsEntry("score", 8.5).containsEntry("grade", "GOOD");
        assertThat(skills.get(2)).containsEntry("score", null).containsEntry("grade", null);
        assertThat(skills.get(3)).containsEntry("grade", "EXCELLENT");
        assertThat(map(p.get("overall"))).containsEntry("score", 8.2).containsEntry("grade", "GOOD");

        assertThat(map(p.get("attendance"))).containsEntry("present", 10).containsEntry("absent", 1)
                .containsEntry("late", 1).containsEntry("recorded", 12).containsEntry("ratePct", 92);
        assertThat(map(p.get("assignments"))).containsEntry("avgScore", 78.4).containsEntry("confirmed", 4)
                .containsEntry("awaitingTeacher", 1);
        assertThat(map(p.get("objectives"))).containsEntry("total", 12).containsEntry("achieved", 7)
                .containsEntry("needsPractice", 3).containsEntry("notAssessed", 2);
        assertThat((List<?>) map(p.get("objectives")).get("needsPracticeItems")).hasSize(2);
        assertThat(map(p.get("selfStudy"))).containsEntry("speakingSessions", 12).containsEntry("speakingMinutes", 85)
                .containsEntry("vocabMastered", 120).containsEntry("lessonsCompleted", 30);
        assertThat(p).containsEntry("teacherComment", "Em tiến bộ rõ ở phần nói, cần luyện thêm ß/ü.");
        assertThat(p.get("certificate")).as("R10: MIDTERM không in điều kiện chứng nhận").isNull();
    }

    @Test
    @DisplayName("R10: khối chứng nhận CHỈ ở FINAL, kèm ngưỡng org_settings của trung tâm")
    void certificate_onlyOnFinal() {
        Map<String, Object> p = builder.build(cls, student, StudentReportIssue.Period.FINAL, "vi", ISSUED_AT, null, null);

        assertThat(map(p.get("certificate"))).containsEntry("eligible", true)
                .containsEntry("minAvgScore", 50).containsEntry("minAttendancePct", 80);
        assertThat(p.get("org")).as("lớp B2C: không có khối trung tâm").isNull();
    }

    @Test
    @DisplayName("Lớp chưa gắn giáo trình ⇒ objectives = null (ẩn khối); không chuyên cần ⇒ ratePct null; 0 bài chốt ⇒ avgScore null")
    void hidesBlocksWithoutEvidence() {
        when(objectiveAssessmentService.summaryFor(CLASS_ID, STUDENT_ID)).thenReturn(Optional.empty());
        when(curriculumLinkRepository.findByClassId(CLASS_ID)).thenReturn(Optional.empty());
        when(evaluationService.evaluationOf(CLASS_ID, STUDENT_ID)).thenReturn(new StudentEvaluationDto(
                STUDENT_ID, "Nguyễn Đức Ánh", "em@test.local", CLASS_ID, "B1", null,
                null, null, null, null, 0.0, 0, 0, 0, 0, false, null));
        when(evaluationService.mySkillReport(STUDENT_ID, CLASS_ID)).thenReturn(new MySkillReportDto(
                null, null, null, null, null, "—", "   ", null));
        when(evaluationService.assignmentCountsOf(CLASS_ID, STUDENT_ID))
                .thenReturn(new StudentEvaluationService.AssignmentCounts(0, 2));

        Map<String, Object> p = builder.build(cls, student, StudentReportIssue.Period.MIDTERM, "en", ISSUED_AT, "TT", null);

        assertThat(p.get("objectives")).isNull();
        assertThat(map(p.get("class"))).containsEntry("level", null);
        assertThat(map(p.get("attendance"))).containsEntry("ratePct", null).containsEntry("recorded", 0);
        assertThat(map(p.get("assignments"))).containsEntry("avgScore", null).containsEntry("awaitingTeacher", 2);
        assertThat(p).containsEntry("teacherComment", null);
        assertThat(map(p.get("overall"))).containsEntry("score", null).containsEntry("grade", null);
    }

    @Test
    @DisplayName("Lưới chặn: một khoá cấm lọt vào bất kỳ cấp nào ⇒ ném IllegalStateException (lỗi lập trình, không phải 4xx)")
    void forbiddenKeyGuard_throws() {
        Map<String, Object> bad = Map.of("student", Map.of("name", "x", "aiScore", 5));
        assertThatThrownBy(() -> ReportPayloadBuilder.assertNoForbiddenKeys(bad, ""))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("student.aiScore");
        Map<String, Object> nested = Map.of("skills", List.of(Map.of("code", "HOREN", "audioUrl", "s3://x")));
        assertThatThrownBy(() -> ReportPayloadBuilder.assertNoForbiddenKeys(nested, ""))
                .isInstanceOf(IllegalStateException.class);
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> map(Object o) {
        return (Map<String, Object>) o;
    }

    private static String flattenKeys(Object node, String path) {
        StringBuilder sb = new StringBuilder();
        if (node instanceof Map<?, ?> m) {
            for (Map.Entry<?, ?> e : m.entrySet()) {
                sb.append(path).append(e.getKey()).append('\n');
                sb.append(flattenKeys(e.getValue(), path + e.getKey() + "."));
            }
        } else if (node instanceof List<?> l) {
            for (Object item : l) {
                sb.append(flattenKeys(item, path));
            }
        }
        return sb.toString();
    }
}
