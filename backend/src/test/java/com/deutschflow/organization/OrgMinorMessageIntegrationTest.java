package com.deutschflow.organization;

import com.deutschflow.organization.entity.OrgMember;
import com.deutschflow.organization.entity.OrgMemberId;
import com.deutschflow.organization.entity.Organization;
import com.deutschflow.organization.repository.OrgMemberRepository;
import com.deutschflow.organization.repository.OrganizationRepository;
import com.deutschflow.testsupport.AbstractPostgresIntegrationTest;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * AC-ORG-CT-10 (DEC-22 mục 18c, owner chốt 09/09/2026) trên PostgreSQL THẬT — "giám đốc đọc được
 * hội thoại riêng giữa giáo viên và học viên chưa thành niên, VÀ mỗi lượt đọc để lại vết trong sổ
 * hoạt động của trung tâm".
 *
 * <p>Bốn thứ chỉ DB thật mới chứng minh được, và cả bốn đều là loại lỗi không có triệu chứng:
 * <ol>
 *   <li><b>{@code read_at} KHÔNG đổi.</b> Assert thẳng trên cột, không qua DTO: đường đọc của người
 *       trong cuộc ({@code MessageService.getThread}) đánh dấu đã đọc như một tác dụng phụ, nên chỉ
 *       cần một lần "tái dùng cho tiện" là học viên thấy tin của mình bỗng "đã đọc" vì giám đốc mở
 *       ra xem — và bằng chứng "em ấy chưa từng mở tin này" mất vĩnh viễn.</li>
 *   <li><b>Vết rơi vào ĐÚNG trung tâm.</b> Kiểm qua chính {@code GET /api/org/audit-logs}, tức
 *       đúng cái màn hình giám đốc dùng, chứ không phải một câu SELECT tự viết.</li>
 *   <li><b>Vết không mang NỘI DUNG.</b> Quét {@code metadata_json} tìm thân tin nhắn thật.</li>
 *   <li><b>Hội thoại của giáo viên ĐÃ BỊ GỠ vẫn đọc được.</b> Ca đáng ngờ nhất cũng là ca duy nhất
 *       sẽ biến mất nếu ai đó đi từ {@code class_teachers} (gỡ giáo viên = XOÁ dòng, DEC-14).</li>
 * </ol>
 *
 * <p>🪤 Không đặt {@code @Transactional} lên lớp: vết audit ghi ở controller phải COMMIT thật thì
 * lượt đọc sổ ở bước sau mới thấy được — cùng lý do {@code OrgAuditLogIntegrationTest}.
 *
 * <p>Tự bỏ qua khi không có Postgres — xem {@link AbstractPostgresIntegrationTest}.
 */
@SpringBootTest
@AutoConfigureMockMvc
@DisplayName("Giám đốc đọc tin nhắn của học viên chưa thành niên Integration Tests (AC-ORG-CT-10)")
class OrgMinorMessageIntegrationTest extends AbstractPostgresIntegrationTest {

    private static final String LIST_PATH = "/api/org/minor-conversations";
    private static final String AUDIT_PATH = "/api/org/audit-logs";
    private static final String READ_EVENT = "org.minor.conversation.read";
    private static final String LIST_EVENT = "org.minor.conversations.read";

    @Autowired private MockMvc mockMvc;
    @Autowired private OrganizationRepository organizationRepo;
    @Autowired private OrgMemberRepository memberRepo;
    @Autowired private UserRepository userRepository;
    @Autowired private JdbcTemplate jdbcTemplate;

    // ── 1. Đường thành công + vết ───────────────────────────────────────────

    @Test
    @DisplayName("🔴 OWNER đọc được hội thoại, vết vào sổ của ĐÚNG trung tâm, read_at KHÔNG đổi")
    void owner_readsThread_leavesTrace_andDoesNotMarkRead() throws Exception {
        Organization org = org();
        User owner = member(org, "OWNER", User.Role.OWNER);
        User teacher = member(org, "TEACHER", User.Role.TEACHER);
        User student = minorStudent(org, 15);

        Long m1 = send(teacher, student, "Em nhớ nộp bài trước thứ Sáu nhé.");
        Long m2 = send(student, teacher, "Dạ em nộp rồi ạ.");
        assertThat(readAt(m1)).as("cảnh đã dựng đúng: học viên CHƯA đọc tin của giáo viên").isNull();

        mockMvc.perform(get(threadPath(student, teacher)).with(user(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.studentUserId").value(student.getId()))
                .andExpect(jsonPath("$.counterpartUserId").value(teacher.getId()))
                .andExpect(jsonPath("$.minorStatus").value("MINOR_LEGAL"))
                .andExpect(jsonPath("$.messages.length()").value(2))
                .andExpect(jsonPath("$.messages[0].body").value("Em nhớ nộp bài trước thứ Sáu nhé."))
                .andExpect(jsonPath("$.messages[1].body").value("Dạ em nộp rồi ạ."));

        // (1) Đọc KHÔNG được đánh dấu đã đọc — assert thẳng trên cột, không qua DTO.
        assertThat(readAt(m1)).as("giám đốc mở xem KHÔNG được biến tin thành 'đã đọc'").isNull();
        assertThat(readAt(m2)).isNull();

        // (2) Vết hiện trong sổ của trung tâm, qua chính màn hình của giám đốc.
        // Lọc theo TÊN SỰ KIỆN chứ không theo id: q là ILIKE '%…%', nên một id ngắn sẽ khớp nhầm
        // id dài hơn của ca khác trong cùng lần chạy. Bản thân sổ đã ép org_id = trung tâm người
        // gọi, mà trung tâm này vừa dựng ⇒ đúng một dòng là của lượt đọc vừa rồi.
        mockMvc.perform(get(AUDIT_PATH).with(user(owner)).param("q", READ_EVENT))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.total").value(1))
                .andExpect(jsonPath("$.items[0].eventName").value(READ_EVENT))
                .andExpect(jsonPath("$.items[0].targetId").value(String.valueOf(student.getId())))
                .andExpect(jsonPath("$.items[0].actorEmail").value(owner.getEmail()))
                .andExpect(jsonPath("$.items[0].orgId").value(org.getId()));

        // (3) Vết mang ĐỊNH DANH + SỐ LƯỢNG, tuyệt đối không mang NỘI DUNG.
        String metadata = metadataOf(READ_EVENT, student.getId());
        assertThat(compact(metadata)).contains("\"counterpartUserId\":" + teacher.getId());
        assertThat(compact(metadata)).contains("\"messageCount\":2");
        assertThat(metadata).contains("MINOR_LEGAL");
        assertThat(metadata)
                .as("thân tin nhắn KHÔNG được chép vào sổ hoạt động")
                .doesNotContain("nộp bài").doesNotContain("Dạ em").doesNotContain("thứ Sáu");
        assertThat(metadata).as("ngày sinh thô không vào vết").doesNotContain("birthDate");
    }

    @Test
    @DisplayName("Mỗi LƯỢT đọc một vết — đọc hai lần thì sổ có hai dòng")
    void everyReadLeavesItsOwnTrace() throws Exception {
        Organization org = org();
        User owner = member(org, "OWNER", User.Role.OWNER);
        User teacher = member(org, "TEACHER", User.Role.TEACHER);
        User student = minorStudent(org, 15);
        send(teacher, student, "Chào em.");

        mockMvc.perform(get(threadPath(student, teacher)).with(user(owner))).andExpect(status().isOk());
        mockMvc.perform(get(threadPath(student, teacher)).with(user(owner))).andExpect(status().isOk());

        assertThat(countTraces(READ_EVENT, student.getId()))
                .as("AC-ORG-CT-10 nói MỖI LƯỢT đọc, không phải mỗi hội thoại")
                .isEqualTo(2L);
    }

    // ── 2. Phân quyền ───────────────────────────────────────────────────────

    @Nested
    @DisplayName("Phân quyền — chỉ OWNER của chính trung tâm đó")
    class Rbac {

        @Test
        @DisplayName("MANAGER của chính trung tâm ⇒ 403")
        void managerForbidden() throws Exception {
            Organization org = org();
            User teacher = member(org, "TEACHER", User.Role.TEACHER);
            User student = minorStudent(org, 15);
            send(teacher, student, "x");

            mockMvc.perform(get(threadPath(student, teacher))
                            .with(user(member(org, "MANAGER", User.Role.MANAGER))))
                    .andExpect(status().isForbidden());
            mockMvc.perform(get(LIST_PATH).with(user(member(org, "MANAGER", User.Role.MANAGER))))
                    .andExpect(status().isForbidden());
        }

        @Test
        @DisplayName("TEACHER — kể cả chính giáo viên trong hội thoại ⇒ 403 ở đường này")
        void teacherForbidden() throws Exception {
            Organization org = org();
            User teacher = member(org, "TEACHER", User.Role.TEACHER);
            User student = minorStudent(org, 15);
            send(teacher, student, "x");

            mockMvc.perform(get(threadPath(student, teacher)).with(user(teacher)))
                    .andExpect(status().isForbidden());
        }

        @Test
        @DisplayName("🔴 OWNER của trung tâm KHÁC ⇒ 403, và không có vết nào rơi vào sổ của họ")
        void ownerOfAnotherOrgForbidden() throws Exception {
            Organization orgA = org();
            Organization orgB = org();
            User teacherA = member(orgA, "TEACHER", User.Role.TEACHER);
            User studentA = minorStudent(orgA, 15);
            User ownerB = member(orgB, "OWNER", User.Role.OWNER);
            send(teacherA, studentA, "Tin riêng của trung tâm A.");

            mockMvc.perform(get(threadPath(studentA, teacherA)).with(user(ownerB)))
                    .andExpect(status().isForbidden());

            // Không có vết = không có gì để rò; sổ của B trống, sổ của A cũng không ghi lượt hỏng.
            assertThat(countTraces(READ_EVENT, studentA.getId())).isZero();
            mockMvc.perform(get(AUDIT_PATH).with(user(ownerB)).param("q", READ_EVENT))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.total").value(0));
        }

        @Test
        @DisplayName("Ẩn danh ⇒ 401")
        void anonymousRejected() throws Exception {
            mockMvc.perform(get(LIST_PATH)).andExpect(status().isUnauthorized());
        }
    }

    // ── 3. Phạm vi chủ thể ──────────────────────────────────────────────────

    @Nested
    @DisplayName("Phạm vi chủ thể — chỉ học viên CHƯA THÀNH NIÊN")
    class SubjectScope {

        @Test
        @DisplayName("Học viên đã thành niên ⇒ 403 (quyền riêng tư đầy đủ)")
        void adultStudentForbidden() throws Exception {
            Organization org = org();
            User owner = member(org, "OWNER", User.Role.OWNER);
            User teacher = member(org, "TEACHER", User.Role.TEACHER);
            User adult = student(org, LocalDate.now().minusYears(25));
            send(teacher, adult, "x");

            mockMvc.perform(get(threadPath(adult, teacher)).with(user(owner)))
                    .andExpect(status().isForbidden());
        }

        @Test
        @DisplayName("🔴 Chưa khai ngày sinh ⇒ 403 — chưa có căn cứ thì không mở quyền đọc")
        void unknownBirthDateForbidden() throws Exception {
            Organization org = org();
            User owner = member(org, "OWNER", User.Role.OWNER);
            User teacher = member(org, "TEACHER", User.Role.TEACHER);
            User unknown = student(org, null);
            send(teacher, unknown, "x");

            mockMvc.perform(get(threadPath(unknown, teacher)).with(user(owner)))
                    .andExpect(status().isForbidden());
            assertThat(countTraces(READ_EVENT, unknown.getId())).isZero();
        }

        @Test
        @DisplayName("Không có hội thoại nào giữa hai id ⇒ 404, không trả danh tính")
        void noConversationIsNotFound() throws Exception {
            Organization org = org();
            User owner = member(org, "OWNER", User.Role.OWNER);
            User teacher = member(org, "TEACHER", User.Role.TEACHER);
            User student = minorStudent(org, 15);

            mockMvc.perform(get(threadPath(student, teacher)).with(user(owner)))
                    .andExpect(status().isNotFound());
        }
    }

    // ── 4. Danh mục ─────────────────────────────────────────────────────────

    @Nested
    @DisplayName("Danh mục hội thoại")
    class Listing {

        @Test
        @DisplayName("🔴 Liệt kê học viên chưa thành niên, BỎ học viên đã thành niên, và vẫn hiện giáo viên ĐÃ BỊ GỠ")
        void listsMinorsIncludingRemovedTeachers() throws Exception {
            Organization org = org();
            User owner = member(org, "OWNER", User.Role.OWNER);
            User teacher = member(org, "TEACHER", User.Role.TEACHER);
            User removedTeacher = member(org, "TEACHER", User.Role.TEACHER);
            User minor = minorStudent(org, 15);
            User adult = student(org, LocalDate.now().minusYears(30));

            send(teacher, minor, "a");
            send(removedTeacher, minor, "b");
            send(teacher, adult, "c");
            // Gỡ hẳn khỏi trung tâm — đúng thứ làm hội thoại biến mất nếu đi từ class_teachers.
            jdbcTemplate.update("UPDATE org_members SET status = 'REMOVED' WHERE org_id = ? AND user_id = ?",
                    org.getId(), removedTeacher.getId());

            String body = mockMvc.perform(get(LIST_PATH).with(user(owner)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.length()").value(2))
                    .andReturn().getResponse().getContentAsString();

            assertThat(body).contains(String.valueOf(minor.getId()));
            assertThat(body).as("học viên đã thành niên không được lọt vào danh mục")
                    .doesNotContain("\"studentUserId\":" + adult.getId());
            assertThat(body).as("giáo viên đã bị gỡ vẫn phải hiện — đây là ca đáng ngờ nhất")
                    .contains("\"counterpartUserId\":" + removedTeacher.getId());
            assertThat(body).as("danh mục KHÔNG kèm nội dung tin nhắn").doesNotContain("\"body\"");

            // Lượt liệt kê cũng để lại vết, mang SỐ LƯỢNG chứ không mang định danh nội dung.
            assertThat(compact(metadataOf(LIST_EVENT, org.getId())))
                    .contains("\"conversationCount\":2").contains("\"studentCount\":1");
        }
    }

    // ── helpers ─────────────────────────────────────────────────────────────

    private String threadPath(User student, User counterpart) {
        return LIST_PATH + "/" + student.getId() + "/with/" + counterpart.getId();
    }

    private Organization org() {
        return organizationRepo.save(Organization.builder()
                .name("TT " + UUID.randomUUID().toString().substring(0, 8))
                .slug("minor-msg-" + UUID.randomUUID())
                .seatLimit(50)
                .status("ACTIVE")
                .build());
    }

    private User account(User.Role role) {
        return userRepository.save(User.builder()
                .email("minor-msg-" + UUID.randomUUID() + "@test.local")
                .passwordHash("x")
                .displayName("MSG " + role.name())
                .role(role)
                .build());
    }

    /** Thành viên ACTIVE với vai org đã cho; {@code users.org_id} dán theo để controller có ngữ cảnh. */
    private User member(Organization org, String orgRole, User.Role platformRole) {
        User u = account(platformRole);
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

    /** Học viên với ngày sinh cho trước ({@code null} = chưa khai). */
    private User student(Organization org, LocalDate birthDate) {
        User u = member(org, "STUDENT", User.Role.STUDENT);
        if (birthDate != null) {
            // 🪤 users.birth_date là updatable=false ở entity (V319 cho ghi MỘT LẦN qua
            // MinorLearnerService), nên dựng cảnh phải đi thẳng SQL. Ca "chưa khai" thì không đụng
            // tới cột — cột vốn đã NULL, và truyền null không kiểu vào PostgreSQL là chuốc rắc rối.
            jdbcTemplate.update("UPDATE users SET birth_date = ? WHERE id = ?", birthDate, u.getId());
        }
        return u;
    }

    private User minorStudent(Organization org, int ageYears) {
        return student(org, LocalDate.now().minusYears(ageYears).minusDays(1));
    }

    private Long send(User from, User to, String body) {
        // Chèn thẳng: MessageService.send đòi hai người chung lớp, mà quan hệ lớp KHÔNG phải thứ
        // đang được kiểm ở đây — và ca "giáo viên đã bị gỡ" đúng là ca không dựng được qua service.
        jdbcTemplate.update(
                "INSERT INTO messages (sender_id, recipient_id, body, created_at) VALUES (?, ?, ?, ?)",
                from.getId(), to.getId(), body, Timestamp.from(Instant.now()));
        return jdbcTemplate.queryForObject(
                "SELECT id FROM messages WHERE sender_id = ? AND recipient_id = ? ORDER BY id DESC LIMIT 1",
                Long.class, from.getId(), to.getId());
    }

    private Instant readAt(Long messageId) {
        Timestamp ts = jdbcTemplate.queryForObject(
                "SELECT read_at FROM messages WHERE id = ?", Timestamp.class, messageId);
        return ts == null ? null : ts.toInstant();
    }

    private long countTraces(String eventName, Long targetId) {
        Long n = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM audit_logs WHERE event_name = ? AND target_id = ?",
                Long.class, eventName, String.valueOf(targetId));
        return n == null ? 0L : n;
    }

    /**
     * Bỏ khoảng trắng để so cấu trúc: cột {@code metadata_json} là {@code jsonb}, mà PostgreSQL
     * DỰNG LẠI chuỗi khi lưu ({@code {"a": 1}} chứ không phải {@code {"a":1}}) và không giữ thứ tự
     * khoá đã gửi. So trên dạng nén thì ca không vỡ vì cách in của DB. Các assert PHỦ ĐỊNH về nội
     * dung vẫn chạy trên chuỗi GỐC — nén trước rồi tìm "nộp bài" sẽ không bao giờ khớp, tức là một
     * ca luôn xanh.
     */
    private static String compact(String json) {
        return json.replace(" ", "");
    }

    private String metadataOf(String eventName, Long targetId) {
        List<Map<String, Object>> rows = jdbcTemplate.queryForList(
                "SELECT metadata_json FROM audit_logs WHERE event_name = ? AND target_id = ? "
                        + "ORDER BY id DESC LIMIT 1", eventName, String.valueOf(targetId));
        assertThat(rows).as("phải có vết cho %s / %s", eventName, targetId).isNotEmpty();
        return String.valueOf(rows.get(0).get("metadata_json"));
    }
}
