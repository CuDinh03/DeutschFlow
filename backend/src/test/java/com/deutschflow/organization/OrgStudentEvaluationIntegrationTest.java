package com.deutschflow.organization;

import com.deutschflow.organization.entity.OrgMember;
import com.deutschflow.organization.entity.OrgMemberId;
import com.deutschflow.organization.entity.Organization;
import com.deutschflow.organization.repository.OrgMemberRepository;
import com.deutschflow.organization.repository.OrganizationRepository;
import com.deutschflow.teacher.entity.ClassStudent;
import com.deutschflow.teacher.entity.ClassStudentId;
import com.deutschflow.teacher.entity.TeacherClass;
import com.deutschflow.teacher.repository.ClassStudentRepository;
import com.deutschflow.teacher.repository.TeacherClassRepository;
import com.deutschflow.testsupport.AbstractPostgresIntegrationTest;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * R12 (owner chốt 10/09/2026) trên Postgres THẬT, qua filter chain thật: "trung tâm đọc được hồ sơ
 * đánh giá của một học viên, VÀ mọi lượt đọc để lại vết trong sổ hoạt động của trung tâm".
 *
 * <p>Bốn thứ chỉ DB thật + chain thật mới chứng minh được:
 * <ol>
 *   <li><b>Biên trung tâm giữ ở hai lớp.</b> Lớp B2C của chính học viên ({@code org_id} NULL) và lớp
 *       của trung tâm khác không được lọt vào hồ sơ — đây là đời sống riêng của họ. Một câu
 *       {@code findByIdStudentId} thiếu bộ lọc org là đủ để rò, và không có triệu chứng nào.</li>
 *   <li><b>Vết rơi vào ĐÚNG trung tâm</b>, kiểm qua chính {@code GET /api/org/audit-logs} mà giám
 *       đốc dùng, chứ không phải một câu SELECT tự viết.</li>
 *   <li><b>Vết không mang ĐIỂM SỐ.</b> Quét {@code metadata_json} tìm nhận xét và điểm kỹ năng thật:
 *       sổ hoạt động là append-only và mọi OWNER/MANAGER đọc được, chép điểm vào đó là nhân bản dữ
 *       liệu sang nơi không rút lại được.</li>
 *   <li><b>Ghi danh đã kết thúc vẫn còn trong hồ sơ</b> — ca duy nhất biến mất nếu ai đó đi từ
 *       {@code findActiveByIdClassId} cho tiện.</li>
 * </ol>
 *
 * <p>🪤 Không đặt {@code @Transactional} lên lớp: vết audit ghi ở controller phải COMMIT thật thì
 * lượt đọc sổ ở bước sau mới thấy được — cùng lý do {@code OrgMinorMessageIntegrationTest}.
 *
 * <p>Tự bỏ qua khi không có Postgres — xem {@link AbstractPostgresIntegrationTest}.
 */
@SpringBootTest
@AutoConfigureMockMvc
@DisplayName("Trung tâm đọc hồ sơ đánh giá học viên Integration Tests (R12)")
class OrgStudentEvaluationIntegrationTest extends AbstractPostgresIntegrationTest {

    private static final String PATH = "/api/org/students/{studentId}/evaluations";
    private static final String AUDIT_PATH = "/api/org/audit-logs";
    private static final String READ_EVENT = "org.student.evaluation.read";
    private static final String COMMENT = "Phát âm đuôi -en đã rõ hơn hẳn";

    @Autowired private MockMvc mockMvc;
    @Autowired private OrganizationRepository organizationRepo;
    @Autowired private OrgMemberRepository memberRepo;
    @Autowired private UserRepository userRepository;
    @Autowired private TeacherClassRepository classRepository;
    @Autowired private ClassStudentRepository classStudentRepository;
    @Autowired private JdbcTemplate jdbcTemplate;
    @Autowired private ObjectMapper objectMapper;

    private Organization orgA;
    private Organization orgB;
    private User ownerA;
    private User managerA;
    private User teacherA;
    private User ownerB;
    private User student;
    private TeacherClass classLive;
    private TeacherClass classEnded;
    private TeacherClass classOfOrgB;
    private TeacherClass classB2C;

    @BeforeEach
    void seed() {
        orgA = org();
        orgB = org();
        ownerA = member(orgA, "OWNER");
        managerA = member(orgA, "MANAGER");
        teacherA = member(orgA, "TEACHER");
        ownerB = member(orgB, "OWNER");
        student = member(orgA, "STUDENT");

        classLive = clazz(orgA.getId(), teacherA.getId(), "B1 tối");
        classEnded = clazz(orgA.getId(), teacherA.getId(), "A2 khoá xuân");
        classOfOrgB = clazz(orgB.getId(), ownerB.getId(), "Lớp của trung tâm khác");
        classB2C = clazz(null, teacherA.getId(), "Lớp tự do B2C");

        ClassStudent live = enroll(classLive, LocalDateTime.now().minusDays(20));
        live.setTeacherComment(COMMENT);
        live.setSkillSprechen(new BigDecimal("7.5"));
        live.setEvaluatedAt(LocalDateTime.now().minusDays(2));
        classStudentRepository.save(live);

        ClassStudent ended = enroll(classEnded, LocalDateTime.now().minusDays(200));
        ended.setStatus(ClassStudent.STATUS_ENDED);
        ended.setEndedAt(LocalDateTime.now().minusDays(100));
        classStudentRepository.save(ended);

        enroll(classOfOrgB, LocalDateTime.now().minusDays(10));
        enroll(classB2C, LocalDateTime.now().minusDays(5));
    }

    // ── 1. Đường thành công + vết ───────────────────────────────────────────

    @Test
    @DisplayName("🔴 OWNER đọc được hồ sơ: đủ lớp của trung tâm mình (kể cả lớp đã kết thúc), KHÔNG có lớp B2C/trung tâm khác")
    void ownerReadsRecord_scopedToOwnCenter() throws Exception {
        mockMvc.perform(get(PATH, student.getId()).with(user(ownerA)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                // lớp đang học xếp trước lớp đã kết thúc
                .andExpect(jsonPath("$[0].classId").value(classLive.getId()))
                .andExpect(jsonPath("$[0].enrollmentStatus").value(ClassStudent.STATUS_ACTIVE))
                .andExpect(jsonPath("$[0].teacherComment").value(COMMENT))
                .andExpect(jsonPath("$[0].skillSprechen").value(7.5))
                .andExpect(jsonPath("$[1].classId").value(classEnded.getId()))
                .andExpect(jsonPath("$[1].enrollmentStatus").value(ClassStudent.STATUS_ENDED))
                .andExpect(jsonPath("$[1].endedAt").exists())
                // ⛔ danh tính học viên KHÔNG lặp lại ở endpoint này
                .andExpect(jsonPath("$[0].email").doesNotExist())
                .andExpect(jsonPath("$[0].name").doesNotExist());

        // (2) Vết rơi vào ĐÚNG trung tâm — kiểm qua chính màn hình sổ hoạt động của giám đốc.
        mockMvc.perform(get(AUDIT_PATH).with(user(ownerA)).param("q", READ_EVENT))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.total").value(1))
                .andExpect(jsonPath("$.items[0].eventName").value(READ_EVENT))
                .andExpect(jsonPath("$.items[0].targetId").value(String.valueOf(student.getId())))
                .andExpect(jsonPath("$.items[0].actorEmail").value(ownerA.getEmail()))
                .andExpect(jsonPath("$.items[0].orgId").value(orgA.getId()));

        // (3) Vết mang ĐỊNH DANH + SỐ LƯỢNG, tuyệt đối không mang ĐIỂM SỐ hay nhận xét.
        List<Map<String, Object>> traces = traces();
        assertThat(traces).hasSize(1);
        String metadata = String.valueOf(traces.get(0).get("metadata_json"));
        assertThat(metadataOf(metadata))
                .containsEntry("classCount", 2)
                .containsEntry("studentUserId", student.getId().intValue());
        assertThat(metadata).doesNotContain(COMMENT);
        assertThat(metadata).doesNotContain("7.5");
    }

    @Test
    @DisplayName("Mỗi lượt đọc là một dòng riêng — hai lần mở ⇒ hai vết")
    void everyReadLeavesItsOwnTrace() throws Exception {
        mockMvc.perform(get(PATH, student.getId()).with(user(ownerA))).andExpect(status().isOk());
        mockMvc.perform(get(PATH, student.getId()).with(user(managerA))).andExpect(status().isOk());

        assertThat(traces()).hasSize(2);
    }

    @Test
    @DisplayName("Học viên chưa vào lớp nào ⇒ 200 danh sách rỗng, vết vẫn ghi với classCount = 0")
    void memberWithoutClasses_isEmptyButStillTraced() throws Exception {
        User fresh = member(orgA, "STUDENT");

        mockMvc.perform(get(PATH, fresh.getId()).with(user(ownerA)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));

        List<Map<String, Object>> traces = jdbcTemplate.queryForList(
                "SELECT metadata_json FROM audit_logs WHERE event_name = ? AND target_id = ?",
                READ_EVENT, String.valueOf(fresh.getId()));
        assertThat(traces).hasSize(1);
        assertThat(metadataOf(String.valueOf(traces.get(0).get("metadata_json"))))
                .containsEntry("classCount", 0);
    }

    // ── 2. Biên quyền ───────────────────────────────────────────────────────

    @Nested
    @DisplayName("Ai KHÔNG được đọc")
    class Forbidden {

        @Test
        @DisplayName("MANAGER của trung tâm ⇒ 200 (nhân sự cũng giám sát học tập)")
        void managerReadsToo() throws Exception {
            mockMvc.perform(get(PATH, student.getId()).with(user(managerA)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.length()").value(2));
        }

        @Test
        @DisplayName("🔴 TEACHER — kể cả giáo viên ĐANG dạy chính lớp đó ⇒ 403 (đường của họ là /api/v2/teacher)")
        void teacherForbidden() throws Exception {
            mockMvc.perform(get(PATH, student.getId()).with(user(teacherA)))
                    .andExpect(status().isForbidden());

            assertThat(traces()).isEmpty();
        }

        @Test
        @DisplayName("🔴 Giám đốc trung tâm KHÁC ⇒ 404, và vết không rơi vào sổ của trung tâm mình")
        void otherOrgIsNotFound() throws Exception {
            mockMvc.perform(get(PATH, student.getId()).with(user(ownerB)))
                    .andExpect(status().isNotFound());

            mockMvc.perform(get(AUDIT_PATH).with(user(ownerB)).param("q", READ_EVENT))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.total").value(0));
        }

        @Test
        @DisplayName("Học viên tự gọi ⇒ 403 (không phải quản trị trung tâm)")
        void studentForbidden() throws Exception {
            mockMvc.perform(get(PATH, student.getId()).with(user(student)))
                    .andExpect(status().isForbidden());
        }

        @Test
        @DisplayName("Ẩn danh ⇒ 401")
        void anonymousRejected() throws Exception {
            mockMvc.perform(get(PATH, student.getId())).andExpect(status().isUnauthorized());
        }
    }

    // ── dựng dữ liệu ────────────────────────────────────────────────────────

    /** {@code metadata_json} là jsonb: Postgres tự chuẩn hoá khoảng trắng và thứ tự khoá, nên so
     *  chuỗi thô là bẫy — đọc thành Map rồi so theo khoá. */
    private Map<String, Object> metadataOf(String json) throws Exception {
        return objectMapper.readValue(json, new TypeReference<Map<String, Object>>() {});
    }

    private List<Map<String, Object>> traces() {
        return jdbcTemplate.queryForList(
                "SELECT actor_user_id, org_id, metadata_json FROM audit_logs "
                        + "WHERE event_name = ? AND target_id = ?",
                READ_EVENT, String.valueOf(student.getId()));
    }

    private Organization org() {
        return organizationRepo.save(Organization.builder()
                .name("TT eval " + UUID.randomUUID().toString().substring(0, 8))
                .slug("eval-it-" + UUID.randomUUID())
                .seatLimit(50)
                .status("ACTIVE")
                .build());
    }

    private User member(Organization org, String orgRole) {
        User u = userRepository.save(User.builder()
                .email("eval-it-" + UUID.randomUUID() + "@test.local")
                .passwordHash("x")
                .displayName("Eval IT " + orgRole)
                .role("STUDENT".equals(orgRole) ? User.Role.STUDENT : User.Role.TEACHER)
                .orgId(org.getId())
                .build());
        memberRepo.save(OrgMember.builder()
                .id(new OrgMemberId(org.getId(), u.getId()))
                .role(orgRole)
                .status("ACTIVE")
                .joinedAt(Instant.now())
                .build());
        return u;
    }

    private TeacherClass clazz(Long orgId, Long teacherId, String name) {
        return classRepository.save(TeacherClass.builder()
                .teacherId(teacherId)
                .orgId(orgId)
                .name(name + " " + UUID.randomUUID().toString().substring(0, 6))
                .inviteCode("eval-" + UUID.randomUUID().toString().substring(0, 12))
                .build());
    }

    private ClassStudent enroll(TeacherClass cls, LocalDateTime joinedAt) {
        return classStudentRepository.save(ClassStudent.builder()
                .id(new ClassStudentId(cls.getId(), student.getId()))
                .joinedAt(joinedAt)
                .status(ClassStudent.STATUS_ACTIVE)
                .build());
    }
}
