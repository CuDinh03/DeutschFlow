package com.deutschflow.organization;

import com.deutschflow.common.minor.MinorAudioBlockedException;
import com.deutschflow.common.minor.MinorGate;
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
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Đường ghi đồng ý + người giám hộ của trung tâm trên PostgreSQL THẬT (D1/D6/F4/R11, owner chốt
 * 10/09/2026) — vá lỗ chặn merge của Gói 1: trước bản này {@code recordConsent} không có caller nào
 * trong {@code src/main}, nên nhập {@code birthDate} cho một học viên là khoá vĩnh viễn phần nói.
 *
 * <p><b>Ca chốt quan trọng nhất</b> ({@link Gate#seventeenYearOld_blockedUntilCenterRecordsPaperConsent}):
 * đi trọn vòng đời mà thông điệp của {@code MinorGate} hứa — "liên hệ trung tâm để hoàn tất phiếu
 * đồng ý; sau khi trung tâm ghi nhận, phần luyện nói sẽ mở lại ngay". Trước: chặn. Trung tâm POST
 * phiếu giấy: hết chặn. Trung tâm POST thu hồi: chặn lại với lý do thu hồi. Chỉ DB thật mới chứng
 * minh được, vì gate đọc thẳng cột bằng SQL chứ không qua persistence context.
 *
 * <p>🪤 Không {@code @Transactional} trên lớp: import CSV chạy {@code REQUIRES_NEW} từng dòng và vết
 * audit phải COMMIT thật thì các bước sau mới thấy. Dữ liệu dựng bằng email/slug ngẫu nhiên nên các
 * ca không giẫm nhau. Tự bỏ qua khi không có Postgres — xem {@link AbstractPostgresIntegrationTest}.
 */
@SpringBootTest
@AutoConfigureMockMvc
@DisplayName("Người giám hộ & đồng ý của trung tâm — Integration (D1/D6/F4/R11)")
class OrgGuardianConsentControllerIntegrationTest extends AbstractPostgresIntegrationTest {

    private static final String IMPORT_PATH = "/api/org/students/import";

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private OrganizationRepository organizationRepo;
    @Autowired private OrgMemberRepository memberRepo;
    @Autowired private UserRepository userRepository;
    @Autowired private JdbcTemplate jdbcTemplate;
    @Autowired private MinorGate minorGate;

    // ── 1. Ca chốt: phần nói khoá → trung tâm ghi phiếu → mở → thu hồi → khoá ─

    @Nested
    @DisplayName("MinorGate ↔ endpoint đồng ý")
    class Gate {

        @Test
        @DisplayName("🔴 Học viên 17 tuổi có ngày sinh, chưa đồng ý ⇒ gate ném; POST GRANTED ⇒ hết ném; POST REVOKED ⇒ ném lại")
        void seventeenYearOld_blockedUntilCenterRecordsPaperConsent() throws Exception {
            Organization org = org();
            User owner = member(org, "OWNER", User.Role.OWNER);
            User student = student(org, 17);

            assertThatThrownBy(() -> minorGate.assertAudioAllowed(student.getId()))
                    .as("chưa có phiếu đồng ý ⇒ giọng nói không đi đâu cả")
                    .isInstanceOf(MinorAudioBlockedException.class)
                    .extracting(ex -> ((MinorAudioBlockedException) ex).getReason())
                    .isEqualTo(MinorAudioBlockedException.Reason.GUARDIAN_CONSENT_REQUIRED);

            Long guardianId = readId(postGuardian(owner, student, Map.of(
                    "fullName", "Trần Thị Bình", "relationship", "MOTHER", "phone", "0987654321"))
                    .andExpect(status().isCreated())
                    .andExpect(jsonPath("$.primary").value(true))
                    .andReturn().getResponse().getContentAsString());

            postConsent(owner, student, consentBody("AUDIO_RECORDING", "GRANTED", "PAPER", guardianId, "phiếu ký 09/09"))
                    .andExpect(status().isCreated())
                    .andExpect(jsonPath("$.action").value("GRANTED"))
                    .andExpect(jsonPath("$.method").value("PAPER"))
                    .andExpect(jsonPath("$.guardianName").value("Trần Thị Bình"))
                    .andExpect(jsonPath("$.termsVersion").isNotEmpty());

            assertThatCode(() -> minorGate.assertAudioAllowed(student.getId()))
                    .as("trung tâm ghi nhận xong ⇒ phần luyện nói mở lại NGAY, không cache 60 giây")
                    .doesNotThrowAnyException();

            postConsent(owner, student, consentBody("AUDIO_RECORDING", "REVOKED", "PHONE", null, "mẹ gọi rút"))
                    .andExpect(status().isCreated());

            assertThatThrownBy(() -> minorGate.assertAudioAllowed(student.getId()))
                    .isInstanceOf(MinorAudioBlockedException.class)
                    .extracting(ex -> ((MinorAudioBlockedException) ex).getReason())
                    .isEqualTo(MinorAudioBlockedException.Reason.GUARDIAN_CONSENT_REVOKED);

            // Sổ chỉ-ghi-thêm: hai dòng, mới nhất trước, dòng cũ còn nguyên.
            mockMvc.perform(get(consentsPath(student)).with(user(owner)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.length()").value(2))
                    .andExpect(jsonPath("$[0].action").value("REVOKED"))
                    .andExpect(jsonPath("$[1].action").value("GRANTED"))
                    .andExpect(jsonPath("$[1].recordedByName").isNotEmpty());

            // Màn chi tiết nói đúng trạng thái mà gate đang đọc — và KHÔNG lộ ngày sinh thô.
            String detail = mockMvc.perform(get("/api/org/students/" + student.getId()).with(user(owner)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.minorStatus").value("MINOR_CENTER_POLICY"))
                    .andExpect(jsonPath("$.birthDateRecorded").value(true))
                    .andExpect(jsonPath("$.audioConsentState").value("REVOKED"))
                    .andExpect(jsonPath("$.guardianCount").value(1))
                    .andReturn().getResponse().getContentAsString();
            assertThat(detail).doesNotContain("birthDate\"").doesNotContain(birthDateOf(student.getId()).toString());
        }

        @Test
        @DisplayName("Vết đồng ý/giám hộ rơi vào sổ của ĐÚNG trung tâm, mang định danh, không mang tên/điện thoại/ghi chú")
        void tracesLandInOrgLedger_withoutContent() throws Exception {
            Organization org = org();
            User manager = member(org, "MANAGER", User.Role.MANAGER);
            User student = student(org, 15);

            Long guardianId = readId(postGuardian(manager, student, Map.of(
                    "fullName", "Lê Văn Cường", "relationship", "FATHER", "phone", "0911222333"))
                    .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString());
            mockMvc.perform(put(guardiansPath(student) + "/" + guardianId).with(user(manager))
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(Map.of(
                                    "fullName", "Lê Văn Cường", "relationship", "FATHER",
                                    "phone", "0911222333", "email", "Cuong.Le@Example.com"))))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.email").value("cuong.le@example.com"))
                    .andExpect(jsonPath("$.primary").value(true));
            postConsent(manager, student, consentBody("AUDIO_RECORDING", "GRANTED", "PAPER", guardianId, "ghi chú tự do RẤT RIÊNG"))
                    .andExpect(status().isCreated());

            for (String event : List.of("student_guardian_recorded", "student_guardian_updated", "student_consent_recorded")) {
                List<Map<String, Object>> rows = jdbcTemplate.queryForList(
                        "SELECT org_id, metadata_json::text AS meta FROM audit_logs WHERE event_name = ? "
                                + "AND metadata_json->>'studentUserId' = ? ORDER BY id DESC LIMIT 1",
                        event, String.valueOf(student.getId()));
                assertThat(rows).as("phải có vết %s", event).hasSize(1);
                assertThat(((Number) rows.get(0).get("org_id")).longValue()).isEqualTo(org.getId());
                String meta = String.valueOf(rows.get(0).get("meta"));
                assertThat(meta).doesNotContain("Cường").doesNotContain("0911222333")
                        .doesNotContain("cuong.le").doesNotContain("RẤT RIÊNG").doesNotContain("FATHER");
            }
            String updated = String.valueOf(jdbcTemplate.queryForList(
                    "SELECT metadata_json::text AS meta FROM audit_logs WHERE event_name = 'student_guardian_updated' "
                            + "AND metadata_json->>'studentUserId' = ? ORDER BY id DESC LIMIT 1",
                    String.valueOf(student.getId())).get(0).get("meta"));
            assertThat(updated.replace(" ", "")).contains("\"changedFields\":[\"email\"]");
        }
    }

    // ── 2. Phân quyền ───────────────────────────────────────────────────────

    @Nested
    @DisplayName("Phân quyền — OWNER/MANAGER của chính trung tâm; 404 cho học viên ngoài trung tâm")
    class Rbac {

        @Test
        @DisplayName("MANAGER ghi/đọc được như OWNER")
        void managerAllowed() throws Exception {
            Organization org = org();
            User manager = member(org, "MANAGER", User.Role.MANAGER);
            User student = student(org, 15);

            postGuardian(manager, student, Map.of("fullName", "Mẹ", "relationship", "MOTHER", "phone", "0900"))
                    .andExpect(status().isCreated());
            mockMvc.perform(get(guardiansPath(student)).with(user(manager)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.length()").value(1));
            mockMvc.perform(get(consentsPath(student)).with(user(manager)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.length()").value(0));
        }

        @Test
        @DisplayName("TEACHER của chính trung tâm ⇒ 403 ở cả đọc lẫn ghi")
        void teacherForbidden() throws Exception {
            Organization org = org();
            User teacher = member(org, "TEACHER", User.Role.TEACHER);
            User student = student(org, 15);

            mockMvc.perform(get(guardiansPath(student)).with(user(teacher))).andExpect(status().isForbidden());
            mockMvc.perform(get(consentsPath(student)).with(user(teacher))).andExpect(status().isForbidden());
            postGuardian(teacher, student, Map.of("fullName", "Mẹ", "relationship", "MOTHER", "phone", "0900"))
                    .andExpect(status().isForbidden());
            postConsent(teacher, student, consentBody("AUDIO_RECORDING", "GRANTED", "PAPER", null, null))
                    .andExpect(status().isForbidden());
        }

        @Test
        @DisplayName("🔴 OWNER trung tâm KHÁC ⇒ 404 (không thành máy dò), không ghi gì")
        void ownerOfAnotherOrgNotFound() throws Exception {
            Organization orgA = org();
            Organization orgB = org();
            User studentA = student(orgA, 15);
            User ownerB = member(orgB, "OWNER", User.Role.OWNER);

            mockMvc.perform(get(guardiansPath(studentA)).with(user(ownerB))).andExpect(status().isNotFound());
            mockMvc.perform(get(consentsPath(studentA)).with(user(ownerB))).andExpect(status().isNotFound());
            postGuardian(ownerB, studentA, Map.of("fullName", "Kẻ lạ", "relationship", "OTHER", "phone", "0900"))
                    .andExpect(status().isNotFound());
            postConsent(ownerB, studentA, consentBody("AUDIO_RECORDING", "GRANTED", "PAPER", null, null))
                    .andExpect(status().isNotFound());

            assertThat(jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM student_guardians WHERE student_user_id = ?", Long.class, studentA.getId()))
                    .isZero();
            assertThat(jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM student_consents WHERE student_user_id = ?", Long.class, studentA.getId()))
                    .isZero();
        }

        @Test
        @DisplayName("Học viên ĐÃ RỜI trung tâm ⇒ 404 — trung tâm không còn là bên có nghĩa vụ")
        void removedStudentNotFound() throws Exception {
            Organization org = org();
            User owner = member(org, "OWNER", User.Role.OWNER);
            User student = student(org, 15);
            jdbcTemplate.update("UPDATE org_members SET status = 'REVOKED' WHERE org_id = ? AND user_id = ?",
                    org.getId(), student.getId());

            mockMvc.perform(get(guardiansPath(student)).with(user(owner))).andExpect(status().isNotFound());
        }

        @Test
        @DisplayName("Ẩn danh ⇒ 401")
        void anonymousRejected() throws Exception {
            mockMvc.perform(get("/api/org/students/1/guardians")).andExpect(status().isUnauthorized());
            mockMvc.perform(post("/api/org/students/1/consents").contentType(MediaType.APPLICATION_JSON).content("{}"))
                    .andExpect(status().isUnauthorized());
        }

        @Test
        @DisplayName("Payload sai (scope lạ, người giám hộ của học viên khác) ⇒ 400 tiếng Việt, không ghi")
        void badPayloadRejected() throws Exception {
            Organization org = org();
            User owner = member(org, "OWNER", User.Role.OWNER);
            User student = student(org, 15);
            User other = student(org, 15);
            Long foreignGuardian = readId(postGuardian(owner, other, Map.of(
                    "fullName", "Mẹ người khác", "relationship", "MOTHER", "phone", "0900"))
                    .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString());

            postConsent(owner, student, consentBody("VIDEO", "GRANTED", "PAPER", null, null))
                    .andExpect(status().isBadRequest());
            postConsent(owner, student, consentBody("AUDIO_RECORDING", "GRANTED", "PAPER", foreignGuardian, null))
                    .andExpect(status().isBadRequest());
            postGuardian(owner, student, Map.of("fullName", "Không liên lạc được", "relationship", "MOTHER"))
                    .andExpect(status().isBadRequest());

            assertThat(jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM student_consents WHERE student_user_id = ?", Long.class, student.getId()))
                    .isZero();
        }
    }

    // ── 3. Đường CSV: consentConfirmed (D1) + F4/D6 ─────────────────────────

    @Nested
    @DisplayName("Nhập CSV — cột consentConfirmed và chốt F4/D6")
    class Roster {

        @Test
        @DisplayName("🔴 consentConfirmed=x ghi MỘT dòng GRANTED/PAPER; nhập lại KHÔNG nhân đôi; gate mở")
        void consentColumn_recordsOnce_andOpensGate() throws Exception {
            Organization org = org();
            User owner = member(org, "OWNER", User.Role.OWNER);
            String email = "csv-" + UUID.randomUUID() + "@test.local";
            String csv = "email,displayName,birthDate,guardianName,guardianPhone,guardianEmail,consentConfirmed\n"
                    + email + ",Em Bé," + LocalDate.now().minusYears(17).minusDays(1)
                    + ",Trần Thị Bình,0987654321,Binh.Tran@Example.com,x\n";

            importCsv(owner, csv).andExpect(status().isOk())
                    .andExpect(jsonPath("$.created").value(1))
                    .andExpect(jsonPath("$.failed").value(0));
            Long studentId = userRepository.findByEmailIgnoreCase(email).orElseThrow().getId();

            List<Map<String, Object>> consents = jdbcTemplate.queryForList(
                    "SELECT scope, action, method, terms_version, note, guardian_id FROM student_consents WHERE student_user_id = ?",
                    studentId);
            assertThat(consents).hasSize(1);
            assertThat(consents.get(0)).containsEntry("scope", "AUDIO_RECORDING")
                    .containsEntry("action", "GRANTED").containsEntry("method", "PAPER")
                    .containsEntry("note", "roster-import");
            assertThat(consents.get(0).get("terms_version")).isNotNull();
            assertThat(consents.get(0).get("guardian_id")).as("nối với người giám hộ chính vừa thêm").isNotNull();
            assertThat(jdbcTemplate.queryForObject(
                    "SELECT email FROM student_guardians WHERE student_user_id = ?", String.class, studentId))
                    .isEqualTo("binh.tran@example.com");
            assertThatCode(() -> minorGate.assertAudioAllowed(studentId)).doesNotThrowAnyException();

            importCsv(owner, csv).andExpect(status().isOk()).andExpect(jsonPath("$.linked").value(1));
            assertThat(jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM student_consents WHERE student_user_id = ?", Long.class, studentId))
                    .as("nhập lại cùng tệp không phình sổ chỉ-ghi-thêm").isEqualTo(1L);
            assertThat(jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM student_guardians WHERE student_user_id = ?", Long.class, studentId))
                    .isEqualTo(1L);
        }

        @Test
        @DisplayName("🔴 F4 + D6: học viên đang ACTIVE ở trung tâm A, B nhập ⇒ dòng bị chặn nêu tên A; birth_date của em VẪN NULL; B không có dòng org_members")
        void studentActiveElsewhere_rejectedNamingOrgA_andBirthDateUntouched() throws Exception {
            Organization orgA = org();
            Organization orgB = org();
            User studentA = student(orgA, null);
            User ownerB = member(orgB, "OWNER", User.Role.OWNER);
            String csv = "email,displayName,birthDate,guardianName,guardianPhone\n"
                    + studentA.getEmail() + ",Em A," + LocalDate.now().minusYears(14) + ",Mẹ A,0900\n";

            String body = importCsv(ownerB, csv).andExpect(status().isOk())
                    .andExpect(jsonPath("$.failed").value(1))
                    .andExpect(jsonPath("$.created").value(0))
                    .andExpect(jsonPath("$.linked").value(0))
                    .andReturn().getResponse().getContentAsString();
            assertThat(body).contains(orgA.getName());

            assertThat(birthDateOf(studentA.getId())).as("D6: dòng bị chặn không chạm users").isNull();
            assertThat(memberRepo.findByIdOrgIdAndIdUserId(orgB.getId(), studentA.getId())).isEmpty();
            assertThat(memberRepo.findByIdOrgIdAndIdUserId(orgA.getId(), studentA.getId()))
                    .get().extracting(OrgMember::getStatus).isEqualTo("ACTIVE");
            assertThat(jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM student_guardians WHERE student_user_id = ?", Long.class, studentA.getId()))
                    .isZero();
        }

        @Test
        @DisplayName("🔴 R6: reportSharingConfirmed=x (bí danh tiếng Việt) ghi MỘT dòng GUARDIAN_REPORT_SHARING/GRANTED/PAPER cạnh dòng ghi âm; tệp hai cột nhập lại KHÔNG nhân đôi; vết đếm riêng")
        void reportSharingColumn_recordsScopeOnce_independentOfAudio() throws Exception {
            Organization org = org();
            User owner = member(org, "OWNER", User.Role.OWNER);
            String email = "csv-" + UUID.randomUUID() + "@test.local";
            String csv = "email,displayName,birthDate,guardianName,guardianPhone,consentConfirmed,Đồng ý chia sẻ phiếu\n"
                    + email + ",Em Bé," + LocalDate.now().minusYears(17).minusDays(1)
                    + ",Trần Thị Bình,0987654321,x,x\n";

            importCsv(owner, csv).andExpect(status().isOk())
                    .andExpect(jsonPath("$.created").value(1))
                    .andExpect(jsonPath("$.failed").value(0));
            User student = userRepository.findByEmailIgnoreCase(email).orElseThrow();

            List<Map<String, Object>> consents = jdbcTemplate.queryForList(
                    "SELECT scope, action, method, note, guardian_id FROM student_consents "
                            + "WHERE student_user_id = ? ORDER BY scope", student.getId());
            assertThat(consents).extracting(c -> c.get("scope"))
                    .containsExactly("AUDIO_RECORDING", "GUARDIAN_REPORT_SHARING");
            Map<String, Object> sharing = consents.get(1);
            assertThat(sharing).containsEntry("action", "GRANTED").containsEntry("method", "PAPER")
                    .containsEntry("note", "roster-import");
            assertThat(sharing.get("guardian_id")).as("nối với người giám hộ chính vừa thêm").isNotNull();
            assertThat(jdbcTemplate.queryForObject(
                    "SELECT metadata_json->>'reportSharingConsentsRecorded' FROM audit_logs "
                            + "WHERE event_name = 'org_member_imported' AND org_id = ? ORDER BY id DESC LIMIT 1",
                    String.class, org.getId())).isEqualTo("1");

            // Sổ đọc qua API thấy scope mới với nhãn thô của enum — web dịch bằng khoá scope.GUARDIAN_REPORT_SHARING.
            String ledger = mockMvc.perform(get(consentsPath(student)).with(user(owner)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.length()").value(2))
                    .andReturn().getResponse().getContentAsString();
            assertThat(ledger).contains("GUARDIAN_REPORT_SHARING");

            // Đánh dấu hàng loạt bằng tệp HAI cột sau khi thu phiếu: scope đã GRANTED ⇒ không thêm dòng.
            importCsv(owner, "email,reportSharingConfirmed\n" + email + ",x\n")
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.linked").value(1))
                    .andExpect(jsonPath("$.failed").value(0));
            assertThat(jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM student_consents WHERE student_user_id = ?", Long.class, student.getId()))
                    .as("nhập lại không phình sổ chỉ-ghi-thêm").isEqualTo(2L);
            assertThat(jdbcTemplate.queryForObject(
                    "SELECT metadata_json->>'reportSharingConsentsRecorded' FROM audit_logs "
                            + "WHERE event_name = 'org_member_imported' AND org_id = ? ORDER BY id DESC LIMIT 1",
                    String.class, org.getId())).isEqualTo("0");
        }

        @Test
        @DisplayName("🔴 R6/R11: guardianEmail trùng email học viên ⇒ dòng bị từ chối nêu cột, KHÔNG tạo tài khoản, không ghi gì")
        void guardianEmailEqualsStudentEmail_rowRejected_nothingWritten() throws Exception {
            Organization org = org();
            User owner = member(org, "OWNER", User.Role.OWNER);
            String email = "csv-" + UUID.randomUUID() + "@test.local";
            String csv = "email,displayName,birthDate,guardianName,guardianEmail,reportSharingConfirmed\n"
                    + email + ",Em Bé," + LocalDate.now().minusYears(15) + ",Mẹ," + email.toUpperCase() + ",x\n";

            String body = importCsv(owner, csv).andExpect(status().isOk())
                    .andExpect(jsonPath("$.failed").value(1))
                    .andExpect(jsonPath("$.created").value(0))
                    .andReturn().getResponse().getContentAsString();

            assertThat(body).contains("Dòng 2").contains("guardianEmail").contains("trùng email của học viên");
            assertThat(userRepository.findByEmailIgnoreCase(email)).as("dòng bị từ chối không chạm users").isEmpty();
        }
    }

    // ── 4. Email giám hộ ≠ email học viên trên endpoint giám hộ; scope chia sẻ phiếu qua API ──

    @Nested
    @DisplayName("Endpoint giám hộ/đồng ý — guardianEmail ≠ email học viên (R6/R11), scope GUARDIAN_REPORT_SHARING")
    class GuardianEmailAndReportSharing {

        @Test
        @DisplayName("🔴 POST/PUT guardians với email = email học viên ⇒ 400 + extensions.code=GUARDIAN_EMAIL_IS_STUDENT_EMAIL, không ghi; 400 thường vẫn không có mã")
        void guardianEmailEqualToStudentEmail_rejectedWithCode() throws Exception {
            Organization org = org();
            User owner = member(org, "OWNER", User.Role.OWNER);
            User student = student(org, 15);

            postGuardian(owner, student, Map.of("fullName", "Mẹ", "relationship", "MOTHER",
                    "email", student.getEmail().toUpperCase()))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.extensions.code").value("GUARDIAN_EMAIL_IS_STUDENT_EMAIL"))
                    .andExpect(jsonPath("$.detail").isNotEmpty());
            assertThat(jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM student_guardians WHERE student_user_id = ?", Long.class, student.getId()))
                    .isZero();

            Long guardianId = readId(postGuardian(owner, student, Map.of(
                    "fullName", "Mẹ", "relationship", "MOTHER", "phone", "0900"))
                    .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString());
            mockMvc.perform(put(guardiansPath(student) + "/" + guardianId).with(user(owner))
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(Map.of(
                                    "fullName", "Mẹ", "relationship", "MOTHER",
                                    "phone", "0900", "email", student.getEmail()))))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.extensions.code").value("GUARDIAN_EMAIL_IS_STUDENT_EMAIL"));
            assertThat(jdbcTemplate.queryForObject(
                    "SELECT email FROM student_guardians WHERE id = ?", String.class, guardianId)).isNull();

            // Hợp đồng 400 cũ không đổi: lỗi thiếu liên lạc vẫn là 400 KHÔNG mã.
            postGuardian(owner, student, Map.of("fullName", "Không liên lạc được", "relationship", "MOTHER"))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.extensions.code").doesNotExist());
        }

        @Test
        @DisplayName("POST consents scope=GUARDIAN_REPORT_SHARING/PAPER ⇒ 201 và có trong sổ; scope này KHÔNG mở phần ghi âm")
        void reportSharingScope_viaEndpoint_doesNotOpenAudio() throws Exception {
            Organization org = org();
            User owner = member(org, "OWNER", User.Role.OWNER);
            User student = student(org, 17);

            postConsent(owner, student, consentBody("GUARDIAN_REPORT_SHARING", "GRANTED", "PAPER", null, "mục C2 đã ký"))
                    .andExpect(status().isCreated())
                    .andExpect(jsonPath("$.scope").value("GUARDIAN_REPORT_SHARING"))
                    .andExpect(jsonPath("$.method").value("PAPER"));

            assertThatThrownBy(() -> minorGate.assertAudioAllowed(student.getId()))
                    .as("đồng ý chia sẻ phiếu không phải đồng ý ghi âm")
                    .isInstanceOf(MinorAudioBlockedException.class);
            mockMvc.perform(get(consentsPath(student)).with(user(owner)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.length()").value(1))
                    .andExpect(jsonPath("$[0].scope").value("GUARDIAN_REPORT_SHARING"));
        }
    }

    // ── helpers ─────────────────────────────────────────────────────────────

    private String guardiansPath(User student) {
        return "/api/org/students/" + student.getId() + "/guardians";
    }

    private String consentsPath(User student) {
        return "/api/org/students/" + student.getId() + "/consents";
    }

    private ResultActions postGuardian(User actor, User student, Map<String, Object> body) throws Exception {
        return mockMvc.perform(post(guardiansPath(student)).with(user(actor))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(body)));
    }

    private ResultActions postConsent(User actor, User student, Map<String, Object> body) throws Exception {
        return mockMvc.perform(post(consentsPath(student)).with(user(actor))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(body)));
    }

    private ResultActions importCsv(User actor, String csv) throws Exception {
        return mockMvc.perform(multipart(IMPORT_PATH)
                .file(new MockMultipartFile("file", "hoc-vien.csv", "text/csv", csv.getBytes(StandardCharsets.UTF_8)))
                .with(user(actor)));
    }

    private static Map<String, Object> consentBody(String scope, String action, String method,
                                                   Long guardianId, String note) {
        Map<String, Object> body = new HashMap<>();
        body.put("scope", scope);
        body.put("action", action);
        body.put("method", method);
        if (guardianId != null) {
            body.put("guardianId", guardianId);
        }
        if (note != null) {
            body.put("note", note);
        }
        return body;
    }

    private Long readId(String json) {
        try {
            return objectMapper.readTree(json).get("id").asLong();
        } catch (java.io.IOException ex) {
            throw new java.io.UncheckedIOException(ex);
        }
    }

    private Organization org() {
        return organizationRepo.save(Organization.builder()
                .name("TT " + UUID.randomUUID().toString().substring(0, 8))
                .slug("consent-" + UUID.randomUUID())
                .seatLimit(50)
                .status("ACTIVE")
                .build());
    }

    private User account(User.Role role) {
        return userRepository.save(User.builder()
                .email("consent-" + UUID.randomUUID() + "@test.local")
                .passwordHash("x")
                .displayName("Consent " + role.name())
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

    /** Học viên ACTIVE của trung tâm với ngày sinh cho trước ({@code null} = chưa khai). */
    private User student(Organization org, LocalDate birthDate) {
        User u = member(org, "STUDENT", User.Role.STUDENT);
        if (birthDate != null) {
            // 🪤 users.birth_date là updatable=false ở entity — dựng cảnh phải đi thẳng SQL.
            jdbcTemplate.update("UPDATE users SET birth_date = ? WHERE id = ?", birthDate, u.getId());
        }
        return u;
    }

    private User student(Organization org, int ageYears) {
        return student(org, LocalDate.now().minusYears(ageYears).minusDays(1));
    }

    private LocalDate birthDateOf(Long userId) {
        return jdbcTemplate.queryForObject("SELECT birth_date FROM users WHERE id = ?", LocalDate.class, userId);
    }
}
