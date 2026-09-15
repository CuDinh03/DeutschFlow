package com.deutschflow.teacher;

import com.deutschflow.common.minor.StudentConsent;
import com.deutschflow.common.minor.StudentConsentRepository;
import com.deutschflow.organization.entity.OrgMember;
import com.deutschflow.organization.entity.OrgMemberId;
import com.deutschflow.organization.entity.Organization;
import com.deutschflow.organization.repository.OrgMemberRepository;
import com.deutschflow.organization.repository.OrganizationRepository;
import com.deutschflow.organization.service.OrgSettingsService;
import com.deutschflow.teacher.entity.AssignmentStatus;
import com.deutschflow.teacher.entity.ClassAssignment;
import com.deutschflow.teacher.entity.ClassAttendance;
import com.deutschflow.teacher.entity.ClassAttendanceId;
import com.deutschflow.teacher.entity.ClassLessonLog;
import com.deutschflow.teacher.entity.ClassStudent;
import com.deutschflow.teacher.entity.ClassStudentId;
import com.deutschflow.teacher.entity.ClassTeacher;
import com.deutschflow.teacher.entity.ClassTeacherId;
import com.deutschflow.teacher.entity.StudentAssignment;
import com.deutschflow.teacher.entity.TeacherClass;
import com.deutschflow.teacher.repository.ClassAssignmentRepository;
import com.deutschflow.teacher.repository.ClassAttendanceRepository;
import com.deutschflow.teacher.repository.ClassLessonLogRepository;
import com.deutschflow.teacher.repository.ClassStudentRepository;
import com.deutschflow.teacher.repository.ClassTeacherRepository;
import com.deutschflow.teacher.repository.StudentAssignmentRepository;
import com.deutschflow.teacher.repository.TeacherClassRepository;
import com.deutschflow.testsupport.AbstractPostgresIntegrationTest;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.assertj.core.data.Offset;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.endsWith;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Phiếu đánh giá gửi gia đình trên PostgreSQL THẬT (PR-R2, thiết kế 10/09/2026): phát hành → đóng băng →
 * thông báo → vết; phát hành lại = SUPERSEDED; RBAC (GV lớp khác 403, MANAGER thu hồi được, học viên
 * khác không thấy); cổng đồng ý theo tuổi (409 + {@code extensions.code}); trang công khai fail-closed
 * (404 đồng nhất, đếm lượt xem); PDF có dấu/ß; vết vào đúng {@code org_id}.
 *
 * <p>{@code app.security.public-rate-limit.enabled=false}: đường {@code /api/public/report-issues/} là
 * nhánh FAIL-CLOSED (R9) — máy IT/CI không có Redis thì filter trả 503 đúng như thiết kế, nên tắt để
 * kiểm nghiệp vụ; hành vi 503 được khoá riêng ở {@code PublicApiRateLimitFilterTest}.
 *
 * <p>🪤 Không {@code @Transactional} trên lớp: vết audit và outbox phải COMMIT thật. Dữ liệu dựng bằng
 * email/slug ngẫu nhiên nên các ca không giẫm nhau. Tự bỏ qua khi không có Postgres.
 */
@SpringBootTest(properties = "app.security.public-rate-limit.enabled=false")
@AutoConfigureMockMvc
@DisplayName("Phiếu đánh giá gửi gia đình — Integration (PR-R2)")
class ReportIssueIntegrationTest extends AbstractPostgresIntegrationTest {

    private static final String STUDENT_NAME = "Nguyễn Đức Ánh Đỗ";
    private static final String COMMENT = "Em đọc „Straße“ và „Übung“ đã chuẩn; cần luyện thêm nghe.";
    private static final String AI_SECRET = "AI-FEEDBACK-SECRET-9f3a";

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private OrganizationRepository organizationRepo;
    @Autowired private OrgMemberRepository memberRepo;
    @Autowired private UserRepository userRepository;
    @Autowired private TeacherClassRepository classRepo;
    @Autowired private ClassTeacherRepository classTeacherRepo;
    @Autowired private ClassStudentRepository classStudentRepo;
    @Autowired private ClassLessonLogRepository lessonLogRepo;
    @Autowired private ClassAttendanceRepository attendanceRepo;
    @Autowired private ClassAssignmentRepository assignmentRepo;
    @Autowired private StudentAssignmentRepository studentAssignmentRepo;
    @Autowired private StudentConsentRepository consentRepo;
    @Autowired private OrgSettingsService orgSettingsService;
    @Autowired private JdbcTemplate jdbcTemplate;

    private Organization org;
    private User owner;
    private User manager;
    private User teacher;
    private User assistant;
    private User otherTeacher;
    private User student17;
    private User adult;
    private TeacherClass cls;

    @BeforeEach
    void fixture() {
        org = org();
        owner = member(org, "OWNER", User.Role.OWNER);
        manager = member(org, "MANAGER", User.Role.MANAGER);
        teacher = member(org, "TEACHER", User.Role.TEACHER);
        assistant = member(org, "TEACHER", User.Role.TEACHER);
        otherTeacher = member(org, "TEACHER", User.Role.TEACHER);
        student17 = student(org, STUDENT_NAME, LocalDate.now().minusYears(17).minusDays(1));
        adult = student(org, "Trần Văn Lớn", LocalDate.now().minusYears(25));
        cls = newClass(teacher, org);
        addTeacher(cls, teacher, "PRIMARY");
        addTeacher(cls, assistant, "ASSISTANT");
        enroll(cls, student17);
        enroll(cls, adult);
        consent(student17, StudentConsent.Action.GRANTED);

        // Điểm giáo viên + nhận xét (tab Đánh giá) — nguồn của phiếu.
        jdbcTemplate.update("UPDATE class_students SET skill_horen = 8.5, skill_lesen = 7.0, skill_sprechen = 9.0, "
                        + "teacher_comment = ?, evaluated_at = NOW() WHERE class_id = ? AND student_id = ?",
                COMMENT, cls.getId(), student17.getId());
        attendance(cls, student17, "PRESENT", "PRESENT", "LATE", "ABSENT");
        // Một bài GV đã chốt (điểm AI đề xuất khác điểm GV) + một bài AI_GRADED chờ chấm: ai_* KHÔNG được lộ.
        ClassAssignment a1 = assignment("Schreiben 1", "SCHREIBEN");
        ClassAssignment a2 = assignment("Hören 1", "HOREN");
        studentAssignmentRepo.save(StudentAssignment.builder().assignmentId(a1.getId()).studentId(student17.getId())
                .status(AssignmentStatus.EVALUATED).score(80).feedback("Tốt").aiScore(61).aiFeedback(AI_SECRET)
                .aiGradedAt(Instant.now()).build());
        studentAssignmentRepo.save(StudentAssignment.builder().assignmentId(a2.getId()).studentId(student17.getId())
                .status(AssignmentStatus.AI_GRADED).score(55).feedback(AI_SECRET).aiScore(55).aiFeedback(AI_SECRET)
                .aiGradedAt(Instant.now()).build());
    }

    // ── 1. Phát hành → đóng băng → thông báo → vết ──────────────────────────

    @Nested
    @DisplayName("Phát hành")
    class Issue {

        @Test
        @DisplayName("🔴 GV phụ trách phát hành MIDTERM: 201, payload đóng băng KHÔNG email/ai_*, outbox REPORT_ISSUED, vết report.issued đúng org_id")
        void issue_freezesPayload_notifies_audits() throws Exception {
            String body = issue(teacher, student17, "MIDTERM", "vi")
                    .andExpect(status().isCreated())
                    .andExpect(jsonPath("$.issue.status").value("ACTIVE"))
                    .andExpect(jsonPath("$.issue.period").value("MIDTERM"))
                    .andExpect(jsonPath("$.issue.lang").value("vi"))
                    .andExpect(jsonPath("$.issue.studentName").value(STUDENT_NAME))
                    .andExpect(jsonPath("$.issue.className").value(cls.getName()))
                    .andExpect(jsonPath("$.issue.issuedByName").value(teacher.getDisplayName()))
                    .andExpect(jsonPath("$.issue.viewCount").value(0))
                    .andExpect(jsonPath("$.payload.skills.length()").value(4))
                    .andExpect(jsonPath("$.payload.skills[0].code").value("HOREN"))
                    .andExpect(jsonPath("$.payload.skills[0].score").value(8.5))
                    .andExpect(jsonPath("$.payload.skills[0].grade").value("GOOD"))
                    .andExpect(jsonPath("$.payload.attendance.present").value(2))
                    .andExpect(jsonPath("$.payload.attendance.late").value(1))
                    .andExpect(jsonPath("$.payload.attendance.absent").value(1))
                    .andExpect(jsonPath("$.payload.attendance.recorded").value(4))
                    .andExpect(jsonPath("$.payload.attendance.ratePct").value(75))
                    .andExpect(jsonPath("$.payload.assignments.confirmed").value(1))
                    .andExpect(jsonPath("$.payload.assignments.awaitingTeacher").value(1))
                    .andExpect(jsonPath("$.payload.assignments.avgScore").value(80.0))
                    .andExpect(jsonPath("$.payload.teacherComment").value(COMMENT))
                    .andExpect(jsonPath("$.payload.org.name").value(org.getName()))
                    .andExpect(jsonPath("$.payload.class.primaryTeacherName").value(teacher.getDisplayName()))
                    .andExpect(jsonPath("$.payload.certificate").doesNotExist())
                    .andReturn().getResponse().getContentAsString();
            JsonNode json = objectMapper.readTree(body);
            String token = json.at("/issue/token").asText();
            assertThat(token).matches("[0-9a-f]{40}");
            assertThat(json.at("/issue/publicPath").asText()).isEqualTo("/phieu/" + token + "?lang=vi");
            assertThat(json.at("/issue/verificationCode").asText()).isEqualTo(token.substring(0, 8).toUpperCase());
            assertThat(body).doesNotContain("\"email\"").doesNotContain(student17.getEmail())
                    .doesNotContain(AI_SECRET).doesNotContain("aiScore").doesNotContain("ai_score");

            long issueId = json.at("/issue/id").asLong();
            Map<String, Object> row = jdbcTemplate.queryForMap(
                    "SELECT org_id, class_id, student_id, period, lang, revoked_at, view_count, "
                            + "EXTRACT(EPOCH FROM (token_expires_at - issued_at)) AS ttl, payload_json::text AS payload "
                            + "FROM student_report_issues WHERE id = ?", issueId);
            assertThat(((Number) row.get("org_id")).longValue()).isEqualTo(org.getId());
            assertThat(row.get("revoked_at")).isNull();
            assertThat(((Number) row.get("ttl")).doubleValue()).isCloseTo(30 * 86400.0, Offset.offset(5.0));
            assertThat(String.valueOf(row.get("payload"))).doesNotContain(AI_SECRET).doesNotContain("email");

            assertThat(jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM notification_outbox WHERE notification_type = 'REPORT_ISSUED' AND recipient_id = ? "
                            + "AND payload->>'issueId' = ?", Long.class, student17.getId(), String.valueOf(issueId))).isEqualTo(1L);

            Map<String, Object> trace = jdbcTemplate.queryForMap(
                    "SELECT org_id, actor_user_id, metadata_json::text AS meta FROM audit_logs "
                            + "WHERE event_name = 'report.issued' AND target_id = ? ORDER BY id DESC LIMIT 1", String.valueOf(issueId));
            assertThat(((Number) trace.get("org_id")).longValue()).isEqualTo(org.getId());
            assertThat(((Number) trace.get("actor_user_id")).longValue()).isEqualTo(teacher.getId());
            // jsonb in lại có dấu cách sau dấu hai chấm — so sánh sau khi bỏ khoảng trắng.
            assertThat(String.valueOf(trace.get("meta")).replace(" ", "")).contains("\"period\":\"MIDTERM\"")
                    .doesNotContain(STUDENT_NAME.replace(" ", "")).doesNotContain("8.5").doesNotContain("Straße");
        }

        @Test
        @DisplayName("FINAL có khối chứng nhận theo ngưỡng org_settings của trung tâm (R10); lang lạ ⇒ 400; kỳ lạ ⇒ 400")
        void finalHasCertificate_andValidation() throws Exception {
            // Chuyên cần 3/4 = 75 %: với ngưỡng mặc định 80 % thì CHƯA đủ; trung tâm hạ xuống 70 % ⇒ đủ.
            issue(teacher, student17, "FINAL", "vi")
                    .andExpect(status().isCreated())
                    .andExpect(jsonPath("$.payload.certificate.eligible").value(false))
                    .andExpect(jsonPath("$.payload.certificate.minAvgScore").value(50))
                    .andExpect(jsonPath("$.payload.certificate.minAttendancePct").value(80));
            orgSettingsService.put(org.getId(), OrgSettingsService.CERTIFICATE_MIN_AVG, "70", owner.getId());
            orgSettingsService.put(org.getId(), OrgSettingsService.CERTIFICATE_MIN_ATTENDANCE_PCT, "70", owner.getId());
            issue(teacher, student17, "FINAL", "de")
                    .andExpect(status().isCreated())
                    .andExpect(jsonPath("$.payload.certificate.eligible").value(true))
                    .andExpect(jsonPath("$.payload.certificate.minAvgScore").value(70))
                    .andExpect(jsonPath("$.payload.certificate.minAttendancePct").value(70))
                    .andExpect(jsonPath("$.issue.publicPath").value(endsWith("?lang=de")));
            issue(teacher, student17, "MIDTERM", "fr").andExpect(status().isBadRequest());
            issue(teacher, student17, "THANG10", "vi").andExpect(status().isBadRequest());
        }

        @Test
        @DisplayName("🔴 R2: phát hành lại cùng kỳ ⇒ dòng mới; dòng cũ SUPERSEDED; link cũ 404; lịch sử vẫn đọc được")
        void reissue_supersedes() throws Exception {
            String first = tokenOf(issue(teacher, student17, "MIDTERM", "vi").andExpect(status().isCreated()));
            publicGet(first).andExpect(status().isOk());

            String second = tokenOf(issue(teacher, student17, "MIDTERM", "vi").andExpect(status().isCreated()));
            assertThat(second).isNotEqualTo(first);

            publicGet(first).andExpect(status().isNotFound());
            publicGet(second).andExpect(status().isOk());

            mockMvc.perform(get(listPath(student17)).with(user(teacher)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.length()").value(2))
                    .andExpect(jsonPath("$[0].status").value("ACTIVE"))
                    .andExpect(jsonPath("$[0].token").value(second))
                    .andExpect(jsonPath("$[1].status").value("SUPERSEDED"))
                    .andExpect(jsonPath("$[1].revokeReason").value("SUPERSEDED"))
                    .andExpect(jsonPath("$[1].token").doesNotExist());
            assertThat(jdbcTemplate.queryForObject(
                    "SELECT revoked_by FROM student_report_issues WHERE token = ?", Long.class, first)).isNull();
        }

        @Test
        @DisplayName("Trung tâm bị đình chỉ ⇒ 403 ORG_READ_ONLY, không tạo dòng")
        void suspendedOrg_readOnly() throws Exception {
            jdbcTemplate.update("UPDATE organizations SET status = 'SUSPENDED', suspended_at = NOW() WHERE id = ?", org.getId());
            issue(teacher, student17, "MIDTERM", "vi")
                    .andExpect(status().isForbidden())
                    .andExpect(jsonPath("$.extensions.code").value("ORG_READ_ONLY"));
            assertThat(countIssues(student17)).isZero();
        }
    }

    // ── 2. Cổng đồng ý theo tuổi (R6) ───────────────────────────────────────

    @Nested
    @DisplayName("Cổng đồng ý GUARDIAN_REPORT_SHARING")
    class ConsentGate {

        @Test
        @DisplayName("🔴 HV 17 tuổi chưa có đồng ý ⇒ 409 GUARDIAN_REPORT_CONSENT_REQUIRED, không tạo dòng; ghi đồng ý ⇒ 201; thu hồi ⇒ 409 REVOKED")
        void minor_requiresConsent_lifecycle() throws Exception {
            User minor = student(org, "Em Chưa Có Phiếu", LocalDate.now().minusYears(17));
            enroll(cls, minor);

            issue(teacher, minor, "MIDTERM", "vi")
                    .andExpect(status().isConflict())
                    .andExpect(jsonPath("$.extensions.code").value("GUARDIAN_REPORT_CONSENT_REQUIRED"))
                    .andExpect(jsonPath("$.detail").value(containsString("chưa ghi nhận đồng ý")));
            assertThat(countIssues(minor)).isZero();

            consent(minor, StudentConsent.Action.GRANTED);
            issue(teacher, minor, "MIDTERM", "vi").andExpect(status().isCreated());

            consent(minor, StudentConsent.Action.REVOKED);
            issue(teacher, minor, "FINAL", "vi")
                    .andExpect(status().isConflict())
                    .andExpect(jsonPath("$.extensions.code").value("GUARDIAN_REPORT_CONSENT_REVOKED"));
            assertThat(countIssues(minor)).isEqualTo(1);
        }

        @Test
        @DisplayName("Chưa khai ngày sinh ⇒ 409 BIRTH_DATE_REQUIRED (fail-closed); người ≥ 18 ⇒ 201 không cần đồng ý")
        void unknownAge_blocked_adultFree() throws Exception {
            User unknown = student(org, "Em Không Ngày Sinh", null);
            enroll(cls, unknown);
            issue(teacher, unknown, "MIDTERM", "vi")
                    .andExpect(status().isConflict())
                    .andExpect(jsonPath("$.extensions.code").value("BIRTH_DATE_REQUIRED"));
            assertThat(countIssues(unknown)).isZero();

            issue(teacher, adult, "MIDTERM", "en").andExpect(status().isCreated());
            assertThat(jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM student_consents WHERE student_user_id = ?", Long.class, adult.getId())).isZero();
        }
    }

    // ── 3. RBAC ─────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("Phân quyền (R5)")
    class Rbac {

        @Test
        @DisplayName("Trợ giảng / GV không dạy lớp / MANAGER / học viên ⇒ 403 phát hành; không tạo dòng")
        void onlyPrimaryTeacherIssues() throws Exception {
            issue(assistant, student17, "MIDTERM", "vi").andExpect(status().isForbidden());
            issue(otherTeacher, student17, "MIDTERM", "vi").andExpect(status().isForbidden());
            issue(manager, student17, "MIDTERM", "vi").andExpect(status().isForbidden());
            issue(student17, student17, "MIDTERM", "vi").andExpect(status().isForbidden());
            mockMvc.perform(post(issuePath(student17)).contentType(MediaType.APPLICATION_JSON).content("{}"))
                    .andExpect(status().isUnauthorized());
            assertThat(countIssues(student17)).isZero();
        }

        @Test
        @DisplayName("Danh sách: GV lớp + trợ giảng + OWNER/MANAGER trung tâm đọc được; GV khác lớp 403; OWNER trung tâm khác 403")
        void listVisibility() throws Exception {
            issue(teacher, student17, "MIDTERM", "vi").andExpect(status().isCreated());
            Organization orgB = org();
            User ownerB = member(orgB, "OWNER", User.Role.OWNER);

            for (User viewer : List.of(teacher, assistant, owner, manager)) {
                mockMvc.perform(get(listPath(student17)).with(user(viewer)))
                        .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(1));
            }
            mockMvc.perform(get(listPath(student17)).with(user(otherTeacher))).andExpect(status().isForbidden());
            mockMvc.perform(get(listPath(student17)).with(user(ownerB))).andExpect(status().isForbidden());

            mockMvc.perform(get("/api/org/report-issues").param("studentId", String.valueOf(student17.getId())).with(user(manager)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.total").value(1))
                    .andExpect(jsonPath("$.items[0].studentId").value(student17.getId()));
            mockMvc.perform(get("/api/org/report-issues").param("studentId", String.valueOf(student17.getId())).with(user(ownerB)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.total").value(0));
            mockMvc.perform(get("/api/org/report-issues").with(user(teacher))).andExpect(status().isForbidden());
        }

        @Test
        @DisplayName("🔴 MANAGER thu hồi kèm lý do ⇒ REVOKED/MANAGER, link chết, vết report.revoked có lý do; lần hai idempotent; OWNER TT khác 404; lý do ngắn 400")
        void managerRevokes() throws Exception {
            String body = issue(teacher, student17, "MIDTERM", "vi").andReturn().getResponse().getContentAsString();
            long id = objectMapper.readTree(body).at("/issue/id").asLong();
            String token = objectMapper.readTree(body).at("/issue/token").asText();

            revoke(manager, id, "Sai điểm nghe, sẽ phát hành lại")
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("REVOKED"))
                    .andExpect(jsonPath("$.revokeReason").value("MANAGER"))
                    .andExpect(jsonPath("$.token").doesNotExist());
            publicGet(token).andExpect(status().isNotFound());
            revoke(manager, id, "Thu hồi lần hai").andExpect(status().isOk()).andExpect(jsonPath("$.status").value("REVOKED"));
            assertThat(jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM audit_logs WHERE event_name = 'report.revoked' AND target_id = ? AND org_id = ?",
                    Long.class, String.valueOf(id), org.getId())).as("idempotent: một vết").isEqualTo(1L);
            assertThat(jdbcTemplate.queryForObject(
                    "SELECT metadata_json::text FROM audit_logs WHERE event_name = 'report.revoked' AND target_id = ?",
                    String.class, String.valueOf(id)).replace(" ", "")).contains("Saiđiểmnghe").contains("\"by\":\"MANAGER\"");

            revoke(manager, id, "ngắn").andExpect(status().isBadRequest());
            Organization orgB = org();
            User ownerB = member(orgB, "OWNER", User.Role.OWNER);
            revoke(ownerB, id, "Không phải phiếu của tôi").andExpect(status().isNotFound());
            revoke(teacher, id, "Giáo viên không thu hồi ở đường org").andExpect(status().isForbidden());
        }

        @Test
        @DisplayName("Học viên xem đúng bản đã gửi của MÌNH (payload đóng băng); học viên khác thấy rỗng; giáo viên 403")
        void studentSeesOwnOnly() throws Exception {
            issue(teacher, student17, "MIDTERM", "vi").andExpect(status().isCreated());

            mockMvc.perform(get("/api/student/report-issues").with(user(student17)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.length()").value(1))
                    .andExpect(jsonPath("$[0].issue.status").value("ACTIVE"))
                    .andExpect(jsonPath("$[0].payload.teacherComment").value(COMMENT))
                    .andExpect(jsonPath("$[0].payload.skills[3].score").value(9.0));
            mockMvc.perform(get("/api/student/report-issues").with(user(adult)))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(0));
            mockMvc.perform(get("/api/student/report-issues").with(user(teacher))).andExpect(status().isForbidden());
        }
    }

    // ── 4. Trang công khai fail-closed ──────────────────────────────────────

    @Nested
    @DisplayName("Trang công khai (R1/R9)")
    class PublicPage {

        @Test
        @DisplayName("🔴 Sai / sai hình dạng / hết hạn / thu hồi ⇒ 404 CÙNG thông điệp; đúng ⇒ 200 không token, lượt xem tăng, vết report.viewed đúng org")
        void failClosed_andViewCount() throws Exception {
            String body = issue(teacher, student17, "FINAL", "vi").andReturn().getResponse().getContentAsString();
            String token = objectMapper.readTree(body).at("/issue/token").asText();
            long id = objectMapper.readTree(body).at("/issue/id").asLong();

            String wrong = publicGet("0".repeat(40)).andExpect(status().isNotFound())
                    .andReturn().getResponse().getContentAsString();
            String malformed = publicGet("abc").andExpect(status().isNotFound())
                    .andReturn().getResponse().getContentAsString();
            String detail = objectMapper.readTree(wrong).get("detail").asText();
            assertThat(objectMapper.readTree(malformed).get("detail").asText()).isEqualTo(detail);

            String ok = publicGet(token).andExpect(status().isOk())
                    .andExpect(header().string("Cache-Control", containsString("no-store")))
                    .andExpect(header().string("X-Robots-Tag", containsString("noindex")))
                    .andExpect(jsonPath("$.studentName").value(STUDENT_NAME))
                    .andExpect(jsonPath("$.orgName").value(org.getName()))
                    .andExpect(jsonPath("$.period").value("FINAL"))
                    .andExpect(jsonPath("$.payload.certificate.eligible").isBoolean())
                    .andExpect(jsonPath("$.payload.teacherComment").value(COMMENT))
                    .andReturn().getResponse().getContentAsString();
            assertThat(ok).doesNotContain(token).doesNotContain("\"email\"").doesNotContain(AI_SECRET)
                    .doesNotContain("\"id\"").doesNotContain("viewCount");
            publicGet(token).andExpect(status().isOk());
            assertThat(jdbcTemplate.queryForObject(
                    "SELECT view_count FROM student_report_issues WHERE id = ?", Integer.class, id)).isEqualTo(2);
            assertThat(jdbcTemplate.queryForObject(
                    "SELECT last_viewed_at FROM student_report_issues WHERE id = ?", java.sql.Timestamp.class, id)).isNotNull();
            List<Map<String, Object>> views = jdbcTemplate.queryForList(
                    "SELECT org_id, actor_user_id, metadata_json::text AS meta FROM audit_logs "
                            + "WHERE event_name = 'report.viewed' AND target_id = ?", String.valueOf(id));
            assertThat(views).hasSize(2);
            assertThat(((Number) views.get(0).get("org_id")).longValue()).isEqualTo(org.getId());
            assertThat(views.get(0).get("actor_user_id")).isNull();
            assertThat(String.valueOf(views.get(0).get("meta"))).doesNotContain("ip").doesNotContain(STUDENT_NAME);

            jdbcTemplate.update("UPDATE student_report_issues SET token_expires_at = NOW() - INTERVAL '1 day' WHERE id = ?", id);
            String expired = publicGet(token).andExpect(status().isNotFound()).andReturn().getResponse().getContentAsString();
            assertThat(objectMapper.readTree(expired).get("detail").asText()).isEqualTo(detail);
            jdbcTemplate.update("UPDATE student_report_issues SET token_expires_at = NOW() + INTERVAL '10 day' WHERE id = ?", id);
            publicGet(token).andExpect(status().isOk());

            revoke(owner, id, "Thu hồi để kiểm 404").andExpect(status().isOk());
            String revoked = publicGet(token).andExpect(status().isNotFound()).andReturn().getResponse().getContentAsString();
            assertThat(objectMapper.readTree(revoked).get("detail").asText()).isEqualTo(detail);
            assertThat(jdbcTemplate.queryForObject(
                    "SELECT view_count FROM student_report_issues WHERE id = ?", Integer.class, id))
                    .as("404 không đếm lượt xem").isEqualTo(3);
        }
    }

    // ── 5. PDF ──────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("PDF (chỉ GV/trung tâm tải — §5)")
    class Pdf {

        @Test
        @DisplayName("GV lớp và MANAGER tải được PDF A4 có tên dấu tiếng Việt + ß; GV khác lớp 403; vết report.pdf_exported đúng org; không có endpoint PDF công khai")
        void pdfForStaffOnly() throws Exception {
            String body = issue(teacher, student17, "FINAL", "vi").andReturn().getResponse().getContentAsString();
            long id = objectMapper.readTree(body).at("/issue/id").asLong();
            String token = objectMapper.readTree(body).at("/issue/token").asText();

            byte[] pdf = mockMvc.perform(get("/api/teacher/report-issues/" + id + "/pdf").with(user(teacher)))
                    .andExpect(status().isOk())
                    .andExpect(header().string("Content-Type", containsString(MediaType.APPLICATION_PDF_VALUE)))
                    .andExpect(header().string("Cache-Control", containsString("no-store")))
                    .andExpect(header().string("Content-Disposition", containsString("attachment")))
                    .andReturn().getResponse().getContentAsByteArray();
            assertThat(new String(pdf, 0, 4, java.nio.charset.StandardCharsets.US_ASCII)).isEqualTo("%PDF");
            try (PDDocument doc = Loader.loadPDF(pdf)) {
                assertThat(doc.getPage(0).getMediaBox().getHeight()).isGreaterThan(doc.getPage(0).getMediaBox().getWidth());
                String text = new PDFTextStripper().getText(doc);
                assertThat(text).contains(STUDENT_NAME).contains("Straße").contains("Übung")
                        .contains(org.getName()).contains("Mã phiếu: " + token.substring(0, 8).toUpperCase())
                        .contains("mydeutschflow.com").doesNotContain(AI_SECRET);
            }
            mockMvc.perform(get("/api/teacher/report-issues/" + id + "/pdf").with(user(manager))).andExpect(status().isOk());
            mockMvc.perform(get("/api/teacher/report-issues/" + id + "/pdf").with(user(otherTeacher))).andExpect(status().isForbidden());
            mockMvc.perform(get("/api/teacher/report-issues/" + id + "/pdf").with(user(student17))).andExpect(status().isForbidden());
            mockMvc.perform(get("/api/public/report-issues/" + token + "/pdf")).andExpect(status().isNotFound());

            List<Map<String, Object>> traces = jdbcTemplate.queryForList(
                    "SELECT org_id, actor_user_id, metadata_json::text AS meta FROM audit_logs "
                            + "WHERE event_name = 'report.pdf_exported' AND target_id = ? ORDER BY id", String.valueOf(id));
            assertThat(traces).hasSize(2);
            assertThat(((Number) traces.get(0).get("org_id")).longValue()).isEqualTo(org.getId());
            assertThat(((Number) traces.get(0).get("actor_user_id")).longValue()).isEqualTo(teacher.getId());
            assertThat(String.valueOf(traces.get(0).get("meta"))).contains("\"bytes\":").doesNotContain(STUDENT_NAME);
        }
    }

    // ── helpers ─────────────────────────────────────────────────────────────

    private String issuePath(User student) {
        return "/api/teacher/classes/" + cls.getId() + "/students/" + student.getId() + "/report-issues";
    }

    private String listPath(User student) {
        return issuePath(student);
    }

    private ResultActions issue(User actor, User student, String period, String lang) throws Exception {
        return mockMvc.perform(post(issuePath(student)).with(user(actor))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of("period", period, "lang", lang))));
    }

    private ResultActions revoke(User actor, long issueId, String reason) throws Exception {
        return mockMvc.perform(post("/api/org/report-issues/" + issueId + "/revoke").with(user(actor))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of("reason", reason))));
    }

    private ResultActions publicGet(String token) throws Exception {
        return mockMvc.perform(get("/api/public/report-issues/" + token));
    }

    private String tokenOf(ResultActions created) throws Exception {
        return objectMapper.readTree(created.andReturn().getResponse().getContentAsString()).at("/issue/token").asText();
    }

    private long countIssues(User student) {
        Long n = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM student_report_issues WHERE student_id = ?",
                Long.class, student.getId());
        return n == null ? 0 : n;
    }

    private Organization org() {
        return organizationRepo.save(Organization.builder()
                .name("TT Phiếu " + UUID.randomUUID().toString().substring(0, 8))
                .slug("report-" + UUID.randomUUID())
                .seatLimit(50)
                .status("ACTIVE")
                .build());
    }

    private User account(User.Role role, String name) {
        return userRepository.save(User.builder()
                .email("report-" + UUID.randomUUID() + "@test.local")
                .passwordHash("x")
                .displayName(name)
                .role(role)
                .build());
    }

    private User member(Organization org, String orgRole, User.Role platformRole) {
        return member(org, orgRole, platformRole, "Report " + orgRole + " " + UUID.randomUUID().toString().substring(0, 4));
    }

    private User member(Organization org, String orgRole, User.Role platformRole, String name) {
        User u = account(platformRole, name);
        u.setOrgId(org.getId());
        u = userRepository.save(u);
        OrgMember m = new OrgMember();
        m.setId(new OrgMemberId(org.getId(), u.getId()));
        m.setRole(orgRole);
        m.setStatus("ACTIVE");
        m.setJoinedAt(Instant.now());
        memberRepo.save(m);
        return u;
    }

    /** Học viên của trung tâm với ngày sinh ({@code null} = chưa khai); birth_date là updatable=false nên ghi thẳng SQL. */
    private User student(Organization org, String name, LocalDate birthDate) {
        User u = member(org, "STUDENT", User.Role.STUDENT, name);
        if (birthDate != null) {
            jdbcTemplate.update("UPDATE users SET birth_date = ? WHERE id = ?", birthDate, u.getId());
        }
        return u;
    }

    private TeacherClass newClass(User teacher, Organization org) {
        return classRepo.save(TeacherClass.builder()
                .teacherId(teacher.getId())
                .orgId(org.getId())
                .name("B1 tối — " + UUID.randomUUID().toString().substring(0, 6))
                .inviteCode("INV-" + UUID.randomUUID())
                .createdAt(LocalDateTime.now())
                .build());
    }

    private void addTeacher(TeacherClass cls, User teacher, String role) {
        classTeacherRepo.save(ClassTeacher.builder()
                .id(new ClassTeacherId(cls.getId(), teacher.getId()))
                .role(role)
                .joinedAt(LocalDateTime.now())
                .build());
    }

    private void enroll(TeacherClass cls, User student) {
        classStudentRepo.save(ClassStudent.builder()
                .id(new ClassStudentId(cls.getId(), student.getId()))
                .joinedAt(LocalDateTime.now().minusDays(30))
                .build());
    }

    private void consent(User student, StudentConsent.Action action) {
        consentRepo.save(StudentConsent.builder()
                .studentUserId(student.getId())
                .orgId(org.getId())
                .scope(StudentConsent.Scope.GUARDIAN_REPORT_SHARING)
                .action(action)
                .method(StudentConsent.Method.PAPER)
                .termsVersion("2026-09")
                .effectiveAt(Instant.now().minusSeconds(action == StudentConsent.Action.GRANTED ? 120 : 1))
                .recordedByUserId(owner.getId())
                .build());
    }

    private void attendance(TeacherClass cls, User student, String... statuses) {
        int n = 1;
        for (String st : statuses) {
            ClassLessonLog log = lessonLogRepo.save(ClassLessonLog.builder()
                    .classId(cls.getId())
                    .sessionDate(LocalDate.now().minusDays(20 - n))
                    .sessionNumber(n++)
                    .topic("Buổi " + n)
                    .createdBy(teacher.getId())
                    .build());
            attendanceRepo.save(ClassAttendance.builder()
                    .id(new ClassAttendanceId(log.getId(), student.getId()))
                    .status(st)
                    .build());
        }
    }

    private ClassAssignment assignment(String topic, String skill) {
        return assignmentRepo.save(ClassAssignment.builder()
                .classId(cls.getId())
                .topic(topic)
                .skill(skill)
                .assignmentType("GENERAL")
                .build());
    }
}
