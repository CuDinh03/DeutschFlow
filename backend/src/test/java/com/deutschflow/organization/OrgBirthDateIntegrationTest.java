package com.deutschflow.organization;

import com.deutschflow.common.minor.MinorAudioBlockedException;
import com.deutschflow.common.minor.MinorGate;
import com.deutschflow.notification.NotificationType;
import com.deutschflow.notification.entity.NotificationOutbox;
import com.deutschflow.notification.repository.NotificationOutboxRepository;
import com.deutschflow.organization.entity.OrgMember;
import com.deutschflow.organization.entity.OrgMemberId;
import com.deutschflow.organization.entity.Organization;
import com.deutschflow.organization.repository.OrgMemberRepository;
import com.deutschflow.organization.repository.OrganizationRepository;
import com.deutschflow.testsupport.AbstractPostgresIntegrationTest;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
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
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Đường TRUNG TÂM SỬA NGÀY SINH trên PostgreSQL thật (Q-02/Q-05/Q-07, owner chốt 14/09/2026).
 *
 * <p><b>Lỗ mà bản này vá.</b> Trước 14/09 ngày sinh chỉ ghi được MỘT lần, qua đúng một đường (cột
 * CSV roster), và không ai sửa được: trung tâm không có ô, học viên không có ô, admin nền tảng cũng
 * không. Gõ nhầm một số ở cột ngày sinh là khoá nhầm phần luyện nói của một em cho tới hết khoá.
 *
 * <p><b>Ca chốt</b> ({@link Correction#typoLocksSpeaking_untilCenterFixesTheDate}) đi trọn vòng đời
 * mà trung tâm sẽ gặp thật: nhập nhầm 2011 (em thành 14 tuổi) ⇒ phần nói khoá; trung tâm sửa lại
 * 2007 ⇒ mở ngay. Chỉ DB thật mới chứng minh được, vì {@code MinorGate} đọc thẳng cột bằng SQL chứ
 * không qua persistence context — một test mock sẽ xanh cả khi cột không hề đổi.
 *
 * <p>Tách khỏi {@code OrgGuardianConsentControllerIntegrationTest} dù cùng controller: tệp đó đang
 * bị PR #646 sửa, và hai PR cùng chèn vào một tệp test là một conflict không đáng có.
 *
 * <p>🪤 Không {@code @Transactional} trên lớp: vết audit và dòng outbox phải COMMIT thật thì bước
 * kiểm sau mới thấy. Tự bỏ qua khi không có Postgres — xem {@link AbstractPostgresIntegrationTest}.
 */
@SpringBootTest
@AutoConfigureMockMvc
@DisplayName("Trung tâm sửa ngày sinh học viên — Integration (Q-02/Q-05/Q-07)")
class OrgBirthDateIntegrationTest extends AbstractPostgresIntegrationTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private OrganizationRepository organizationRepo;
    @Autowired private OrgMemberRepository memberRepo;
    @Autowired private UserRepository userRepository;
    @Autowired private JdbcTemplate jdbcTemplate;
    @Autowired private NotificationOutboxRepository outboxRepo;
    @Autowired private MinorGate minorGate;

    // ── 1. Ca chốt: gõ nhầm khoá phần nói, sửa lại thì mở ────────────────────

    @Nested
    @DisplayName("Sửa một ngày sinh gõ nhầm")
    class Correction {

        @Test
        @DisplayName("🔴 Nhập nhầm thành 14 tuổi ⇒ phần nói khoá; trung tâm sửa lại đúng tuổi ⇒ mở ngay")
        void typoLocksSpeaking_untilCenterFixesTheDate() throws Exception {
            Organization org = org();
            User owner = member(org, "OWNER", User.Role.OWNER);
            User student = student(org, LocalDate.now().minusYears(14).minusDays(1));

            assertThatThrownBy(() -> minorGate.assertAudioAllowed(student.getId()))
                    .as("14 tuổi chưa có phiếu đồng ý ⇒ giọng nói không đi đâu cả")
                    .isInstanceOf(MinorAudioBlockedException.class);

            LocalDate corrected = LocalDate.now().minusYears(20).minusDays(1);
            putBirthDate(owner, student, corrected.toString())
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.birthDate").value(corrected.toString()))
                    .andExpect(jsonPath("$.minorStatus").value("ADULT"));

            assertThat(birthDateOf(student.getId())).isEqualTo(corrected);
            assertThatCode(() -> minorGate.assertAudioAllowed(student.getId()))
                    .as("đã là người lớn ⇒ không cần đồng ý của ai")
                    .doesNotThrowAnyException();
        }

        @Test
        @DisplayName("Cột đang NULL ⇒ PUT ghi được lần đầu, vết là student_birth_date_recorded")
        void firstWriteUsesRecordedEvent() throws Exception {
            Organization org = org();
            User owner = member(org, "OWNER", User.Role.OWNER);
            User student = student(org, null);

            LocalDate dob = LocalDate.now().minusYears(17).minusDays(1);
            putBirthDate(owner, student, dob.toString()).andExpect(status().isOk());

            assertThat(auditActions(student.getId())).containsExactly("student_birth_date_recorded");
        }

        @Test
        @DisplayName("Sửa giá trị đã có ⇒ vết student_birth_date_updated, KHÔNG mang ngày sinh thô")
        void overwriteLeavesAuditWithoutRawValue() throws Exception {
            Organization org = org();
            User owner = member(org, "OWNER", User.Role.OWNER);
            LocalDate wrong = LocalDate.now().minusYears(14).minusDays(1);
            User student = student(org, wrong);

            LocalDate corrected = LocalDate.now().minusYears(17).minusDays(1);
            putBirthDate(owner, student, corrected.toString()).andExpect(status().isOk());

            assertThat(auditActions(student.getId())).containsExactly("student_birth_date_updated");
            String meta = jdbcTemplate.queryForObject(
                    "SELECT metadata_json::text FROM audit_logs "
                            + "WHERE target_id = ? AND event_name = 'student_birth_date_updated'",
                    String.class, String.valueOf(student.getId()));
            assertThat(meta)
                    .as("⛔ sổ vết là nơi cả admin nền tảng lẫn quản trị trung tâm đọc — không chép ngày sinh của trẻ vào đó")
                    .doesNotContain(corrected.toString())
                    .doesNotContain(wrong.toString());
            assertThat(meta).contains("MINOR_LEGAL").contains("MINOR_CENTER_POLICY");
        }

        @Test
        @DisplayName("Gõ lại đúng ngày đang có ⇒ 200 nhưng KHÔNG vết, KHÔNG thông báo")
        void sameValueWritesNothing() throws Exception {
            Organization org = org();
            User owner = member(org, "OWNER", User.Role.OWNER);
            LocalDate dob = LocalDate.now().minusYears(17).minusDays(1);
            User student = student(org, dob);

            putBirthDate(owner, student, dob.toString())
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.birthDate").value(dob.toString()));

            assertThat(auditActions(student.getId())).isEmpty();
            assertThat(birthDateNotices(student.getId())).isEmpty();
        }
    }

    // ── 2. Học viên phải biết mình bị sửa (Q-05) ─────────────────────────────

    @Nested
    @DisplayName("Minh bạch hai chiều")
    class Notice {

        @Test
        @DisplayName("Mỗi lượt sửa xếp một thông báo cho CHÍNH học viên, payload không rỗng")
        void queuesNoticeToTheStudent() throws Exception {
            Organization org = org();
            User owner = member(org, "OWNER", User.Role.OWNER);
            User student = student(org, LocalDate.now().minusYears(14).minusDays(1));

            LocalDate corrected = LocalDate.now().minusYears(17).minusDays(1);
            putBirthDate(owner, student, corrected.toString()).andExpect(status().isOk());

            List<NotificationOutbox> notices = birthDateNotices(student.getId());
            assertThat(notices).hasSize(1);
            NotificationOutbox n = notices.get(0);
            assertThat(n.getRecipientId())
                    .as("người bị sửa là người phải biết — không phải giáo viên, không phải trung tâm")
                    .isEqualTo(student.getId());
            assertThat(n.getPayload())
                    .containsEntry("birthDate", corrected.toString())
                    .containsEntry("firstRecord", false)
                    .containsEntry("minorStatus", "MINOR_CENTER_POLICY")
                    .containsEntry("orgId", org.getId().intValue());
        }

        @Test
        @DisplayName("Hai lượt sửa liên tiếp ⇒ hai thông báo (dedup_key không nuốt lượt sau)")
        void twoCorrectionsProduceTwoNotices() throws Exception {
            Organization org = org();
            User owner = member(org, "OWNER", User.Role.OWNER);
            User student = student(org, LocalDate.now().minusYears(14).minusDays(1));

            putBirthDate(owner, student, LocalDate.now().minusYears(15).minusDays(1).toString())
                    .andExpect(status().isOk());
            putBirthDate(owner, student, LocalDate.now().minusYears(17).minusDays(1).toString())
                    .andExpect(status().isOk());

            assertThat(birthDateNotices(student.getId())).hasSize(2);
        }
    }

    // ── 3. Cổng quyền ────────────────────────────────────────────────────────

    @Nested
    @DisplayName("Ai sửa được")
    class Authz {

        @Test
        @DisplayName("🔴 Trung tâm KHÁC ⇒ 404 (không phải 403 — endpoint không được thành máy dò học viên)")
        void otherOrgGetsNotFound() throws Exception {
            Organization mine = org();
            Organization theirs = org();
            User owner = member(mine, "OWNER", User.Role.OWNER);
            User outsider = student(theirs, LocalDate.now().minusYears(17).minusDays(1));

            putBirthDate(owner, outsider, LocalDate.now().minusYears(20).toString())
                    .andExpect(status().isNotFound());
            mockMvc.perform(get(path(outsider)).with(user(owner)))
                    .andExpect(status().isNotFound());
        }

        @Test
        @DisplayName("Giáo viên của chính trung tâm ⇒ 403: ngày sinh là việc của OWNER/MANAGER")
        void teacherCannotWrite() throws Exception {
            Organization org = org();
            User teacher = member(org, "TEACHER", User.Role.TEACHER);
            User student = student(org, LocalDate.now().minusYears(17).minusDays(1));

            putBirthDate(teacher, student, LocalDate.now().minusYears(20).toString())
                    .andExpect(status().isForbidden());
        }

        @Test
        @DisplayName("Học viên đã RỜI trung tâm ⇒ 404: trung tâm hết là bên có quyền trên hồ sơ đó")
        void leftMemberGetsNotFound() throws Exception {
            Organization org = org();
            User owner = member(org, "OWNER", User.Role.OWNER);
            User student = student(org, LocalDate.now().minusYears(17).minusDays(1));
            memberRepo.findByIdOrgIdAndIdUserId(org.getId(), student.getId()).ifPresent(m -> {
                m.setStatus("LEFT");
                memberRepo.save(m);
            });

            putBirthDate(owner, student, LocalDate.now().minusYears(20).toString())
                    .andExpect(status().isNotFound());
        }
    }

    // ── 4. Đầu vào ───────────────────────────────────────────────────────────

    @Nested
    @DisplayName("Giá trị không nhận")
    class Validation {

        @Test
        @DisplayName("Ngày tương lai ⇒ 400 và cột không đổi")
        void futureDateRejected() throws Exception {
            Organization org = org();
            User owner = member(org, "OWNER", User.Role.OWNER);
            LocalDate dob = LocalDate.now().minusYears(17).minusDays(1);
            User student = student(org, dob);

            putBirthDate(owner, student, LocalDate.now().plusDays(1).toString())
                    .andExpect(status().isBadRequest());
            assertThat(birthDateOf(student.getId())).isEqualTo(dob);
        }

        @Test
        @DisplayName("Chuỗi sai định dạng ⇒ 400 với câu tiếng Việt, không phải lỗi Jackson")
        void malformedDateRejected() throws Exception {
            Organization org = org();
            User owner = member(org, "OWNER", User.Role.OWNER);
            User student = student(org, null);

            putBirthDate(owner, student, "14/09/2009")
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.detail", containsString("Ngày sinh")));
        }

        @Test
        @DisplayName("Thân rỗng ⇒ 400 chứ không 500 (@RequestBody required=false)")
        void emptyBodyRejected() throws Exception {
            Organization org = org();
            User owner = member(org, "OWNER", User.Role.OWNER);
            User student = student(org, null);

            mockMvc.perform(put(path(student)).with(user(owner))
                            .contentType(MediaType.APPLICATION_JSON).content("{}"))
                    .andExpect(status().isBadRequest());
        }
    }

    // ── Helper ───────────────────────────────────────────────────────────────

    private static String path(User student) {
        return "/api/org/students/" + student.getId() + "/birth-date";
    }

    private ResultActions putBirthDate(User actor, User student, String isoDate) throws Exception {
        return mockMvc.perform(put(path(student)).with(user(actor))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of("birthDate", isoDate))));
    }

    private List<String> auditActions(Long studentUserId) {
        return jdbcTemplate.queryForList(
                "SELECT event_name FROM audit_logs "
                        + "WHERE target_id = ? AND event_name LIKE 'student_birth_date%' ORDER BY id",
                String.class, String.valueOf(studentUserId));
    }

    private List<NotificationOutbox> birthDateNotices(Long studentUserId) {
        return outboxRepo.findAll().stream()
                .filter(n -> NotificationType.BIRTH_DATE_UPDATED.equals(n.getNotificationType()))
                .filter(n -> studentUserId.equals(n.getRecipientId()))
                .toList();
    }

    private Organization org() {
        return organizationRepo.save(Organization.builder()
                .name("TT " + UUID.randomUUID().toString().substring(0, 8))
                .slug("birthdate-" + UUID.randomUUID())
                .seatLimit(50)
                .status("ACTIVE")
                .build());
    }

    private User account(User.Role role) {
        return userRepository.save(User.builder()
                .email("birthdate-" + UUID.randomUUID() + "@test.local")
                .passwordHash("x")
                .displayName("BirthDate " + role.name())
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

    /** Học viên ACTIVE với ngày sinh cho trước ({@code null} = chưa khai). */
    private User student(Organization org, LocalDate birthDate) {
        User u = member(org, "STUDENT", User.Role.STUDENT);
        if (birthDate != null) {
            // 🪤 users.birth_date là updatable=false ở entity — dựng cảnh phải đi thẳng SQL.
            jdbcTemplate.update("UPDATE users SET birth_date = ? WHERE id = ?", birthDate, u.getId());
        }
        return u;
    }

    private LocalDate birthDateOf(Long userId) {
        return jdbcTemplate.queryForObject("SELECT birth_date FROM users WHERE id = ?", LocalDate.class, userId);
    }
}
