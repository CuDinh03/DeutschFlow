package com.deutschflow.common.minor;

import com.deutschflow.common.audit.AuditActor;
import com.deutschflow.common.audit.AuditLogService;
import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.user.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.ArgumentMatchers;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;

import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * DEC-22 — nền dữ liệu vị thành niên. Ca ở đây chốt bốn thứ dễ trôi nhất khi PR sau sửa vào:
 * ngày sinh CHỈ ghi được một lần, sổ đồng ý đọc theo {@code effective_at}, người giám hộ không được
 * nối chéo sang học viên khác, và vết audit KHÔNG mang nội dung.
 *
 * <p>Không có Spring context: service chỉ là luật + ba cộng tác viên, dựng thẳng bằng constructor.
 * {@link MinorPolicy} dùng bản THẬT ({@code new MinorPolicy(16, 18)}) chứ không mock — mock nó đi
 * thì ca "vết audit ghi đúng nhóm tuổi" chỉ còn kiểm chính cái mock.
 *
 * <p>🪤 Ngày sinh trong test là hằng và tuổi tính từ {@code now()} thật, nên ca nào cần một nhóm
 * tuổi cụ thể đều dựng bằng {@code LocalDate.now(...).minusYears(n).minusDays(1)} — trừ thêm một
 * ngày để ca không lật đúng vào ngày sinh nhật.
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("MinorLearnerService — nền dữ liệu học viên chưa thành niên (DEC-22)")
class MinorLearnerServiceTest {

    private static final Long STUDENT = 42L;
    private static final Long OTHER_STUDENT = 43L;
    private static final Long ORG = 7L;
    private static final Long MANAGER = 5L;
    private static final AuditActor ACTOR = new AuditActor(MANAGER, "quanly@tt.vn", "MANAGER");

    @Mock private JdbcTemplate jdbcTemplate;
    @Mock private UserRepository userRepository;
    @Mock private StudentGuardianRepository guardianRepository;
    @Mock private StudentConsentRepository consentRepository;
    @Mock private AuditLogService auditLogService;

    private MinorLearnerService service;

    @BeforeEach
    void setUp() {
        service = new MinorLearnerService(jdbcTemplate, userRepository, guardianRepository,
                consentRepository, new MinorPolicy(16, 18), auditLogService);
    }

    /** Ngày sinh của một em đúng {@code age} tuổi rưỡi — không rơi vào biên sinh nhật. */
    private static LocalDate aged(int age) {
        return LocalDate.now(MinorPolicy.ZONE).minusYears(age).minusMonths(6);
    }

    /**
     * 🪤 Phải có type witness {@code <RowMapper<LocalDate>>}: {@code any(RowMapper.class)} là kiểu
     * thô nên biến cả lời gọi {@code query} thành thô, và {@code thenReturn(List<LocalDate>)} không
     * còn khớp kiểu trả về đã bị xoá generic.
     */
    private void stubBirthDate(LocalDate birthDate) {
        List<LocalDate> rows = birthDate == null ? List.of() : List.of(birthDate);
        when(jdbcTemplate.query(anyString(), ArgumentMatchers.<RowMapper<LocalDate>>any(), eq(STUDENT)))
                .thenReturn(rows);
    }

    private Map<String, Object> capturedMeta() {
        @SuppressWarnings("unchecked")
        ArgumentCaptor<Map<String, Object>> captor = ArgumentCaptor.forClass(Map.class);
        verify(auditLogService).log(anyString(), any(AuditActor.class), anyString(), anyString(),
                any(), captor.capture());
        return captor.getValue();
    }

    @Nested
    @DisplayName("recordBirthDate — ghi một lần, không ghi đè")
    class RecordBirthDate {

        @Test
        @DisplayName("cột đang NULL thì ghi được và để lại vết mang nhóm tuổi")
        void writesWhenColumnIsNull() {
            LocalDate dob = aged(14);
            when(jdbcTemplate.update(anyString(), eq(dob), eq(MANAGER), eq(STUDENT))).thenReturn(1);

            boolean written = service.recordBirthDate(STUDENT, dob, MANAGER, ORG, ACTOR);

            assertThat(written).isTrue();
            Map<String, Object> meta = capturedMeta();
            assertThat(meta).containsEntry("minorStatus", "MINOR_LEGAL")
                    .containsEntry("studentUserId", STUDENT);
        }

        @Test
        @DisplayName("⛔ vết audit KHÔNG mang ngày sinh thô dưới bất kỳ khoá nào")
        void auditNeverCarriesRawBirthDate() {
            LocalDate dob = aged(17);
            when(jdbcTemplate.update(anyString(), eq(dob), eq(MANAGER), eq(STUDENT))).thenReturn(1);

            service.recordBirthDate(STUDENT, dob, MANAGER, ORG, ACTOR);

            Map<String, Object> meta = capturedMeta();
            assertThat(meta).containsEntry("minorStatus", "MINOR_CENTER_POLICY");
            assertThat(meta.values().stream().map(String::valueOf))
                    .noneMatch(v -> v.contains(String.valueOf(dob.getYear())) || v.contains(dob.toString()));
        }

        @Test
        @DisplayName("đã có ngày sinh ⇒ trả false, KHÔNG ghi vết (nhập lại CSV không phải lỗi)")
        void refusesOverwriteWithoutAudit() {
            LocalDate dob = aged(20);
            when(jdbcTemplate.update(anyString(), eq(dob), eq(MANAGER), eq(STUDENT))).thenReturn(0);
            when(userRepository.existsById(STUDENT)).thenReturn(true);

            assertThat(service.recordBirthDate(STUDENT, dob, MANAGER, ORG, ACTOR)).isFalse();
            verifyNoInteractions(auditLogService);
        }

        @Test
        @DisplayName("không có tài khoản ⇒ NotFound, phân biệt hẳn với ca đã-có-giá-trị")
        void throwsWhenStudentMissing() {
            LocalDate dob = aged(20);
            when(jdbcTemplate.update(anyString(), eq(dob), eq(MANAGER), eq(STUDENT))).thenReturn(0);
            when(userRepository.existsById(STUDENT)).thenReturn(false);

            assertThatThrownBy(() -> service.recordBirthDate(STUDENT, dob, MANAGER, ORG, ACTOR))
                    .isInstanceOf(NotFoundException.class);
        }

        @Test
        @DisplayName("ngày sinh tương lai bị chặn ở tầng ứng dụng (PostgreSQL cấm CURRENT_DATE trong CHECK)")
        void rejectsFutureBirthDate() {
            LocalDate tomorrow = LocalDate.now(MinorPolicy.ZONE).plusDays(1);

            assertThatThrownBy(() -> service.recordBirthDate(STUDENT, tomorrow, MANAGER, ORG, ACTOR))
                    .isInstanceOf(BadRequestException.class);
            verify(jdbcTemplate, never()).update(anyString(), any(), any(), any());
        }

        @Test
        @DisplayName("thiếu người ghi ⇒ chặn: một thay đổi danh tính phải có người chịu trách nhiệm")
        void requiresRecordedBy() {
            assertThatThrownBy(() -> service.recordBirthDate(STUDENT, aged(15), null, ORG, ACTOR))
                    .isInstanceOf(BadRequestException.class);
        }
    }

    @Nested
    @DisplayName("statusOf — nạp từ DB, không từ principal")
    class StatusOf {

        @Test
        @DisplayName("đọc thẳng cột birth_date và phân loại theo hai ngưỡng")
        void readsColumnDirectly() {
            stubBirthDate(aged(15));
            assertThat(service.statusOf(STUDENT)).isEqualTo(MinorPolicy.Status.MINOR_LEGAL);
            verifyNoInteractions(userRepository);
        }

        @Test
        @DisplayName("chưa khai ⇒ UNKNOWN, để điểm gọi tự fail-closed")
        void unknownWhenNotDeclared() {
            stubBirthDate(null);
            assertThat(service.statusOf(STUDENT)).isEqualTo(MinorPolicy.Status.UNKNOWN);
        }
    }

    @Nested
    @DisplayName("recordGuardian")
    class RecordGuardian {

        private final GuardianDraft draft = new GuardianDraft(
                "  Nguyễn Thị Mai  ", StudentGuardian.Relationship.MOTHER, " 0901234567 ", null, true);

        @Test
        @DisplayName("hạ người chính cũ TRƯỚC khi thêm (uq_student_guardians_primary)")
        void demotesCurrentPrimaryFirst() {
            StudentGuardian current = StudentGuardian.builder().id(1L).studentUserId(STUDENT).primary(true).build();
            when(guardianRepository.findByStudentUserIdAndPrimaryTrue(STUDENT)).thenReturn(Optional.of(current));
            when(userRepository.existsById(STUDENT)).thenReturn(true);
            when(guardianRepository.save(any())).thenAnswer(inv -> {
                StudentGuardian g = inv.getArgument(0);
                g.setId(2L);
                return g;
            });
            stubBirthDate(aged(14));

            StudentGuardian saved = service.recordGuardian(STUDENT, ORG, draft, ACTOR);

            assertThat(current.isPrimary()).isFalse();
            verify(guardianRepository).saveAndFlush(current);
            assertThat(saved.getFullName()).isEqualTo("Nguyễn Thị Mai");
            assertThat(saved.getPhone()).isEqualTo("0901234567");
        }

        @Test
        @DisplayName("⛔ vết audit không mang tên, số điện thoại, email hay quan hệ gia đình")
        void auditCarriesNoContactContent() {
            when(userRepository.existsById(STUDENT)).thenReturn(true);
            when(guardianRepository.findByStudentUserIdAndPrimaryTrue(STUDENT)).thenReturn(Optional.empty());
            when(guardianRepository.save(any())).thenAnswer(inv -> {
                StudentGuardian g = inv.getArgument(0);
                g.setId(9L);
                return g;
            });
            when(guardianRepository.countByStudentUserId(STUDENT)).thenReturn(1L);
            stubBirthDate(aged(14));

            service.recordGuardian(STUDENT, ORG, draft, ACTOR);

            Map<String, Object> meta = capturedMeta();
            assertThat(meta).containsEntry("guardianId", 9L)
                    .containsEntry("guardianCount", 1L)
                    .containsEntry("minorStatus", "MINOR_LEGAL")
                    .doesNotContainKeys("fullName", "phone", "email", "relationship");
            assertThat(meta.values().stream().map(String::valueOf))
                    .noneMatch(v -> v.contains("Mai") || v.contains("0901234567") || v.contains("MOTHER"));
        }

        @Test
        @DisplayName("không số điện thoại lẫn email ⇒ chặn ở đây, không để CHECK của DB thành 500")
        void requiresAtLeastOneContact() {
            when(userRepository.existsById(STUDENT)).thenReturn(true);
            GuardianDraft unreachable = new GuardianDraft(
                    "Ẩn danh", StudentGuardian.Relationship.OTHER, "  ", null, false);

            assertThatThrownBy(() -> service.recordGuardian(STUDENT, ORG, unreachable, ACTOR))
                    .isInstanceOf(BadRequestException.class);
            verify(guardianRepository, never()).save(any());
        }
    }

    @Nested
    @DisplayName("recordConsent + consentStatus")
    class Consent {

        private ConsentDraft granted() {
            return new ConsentDraft(StudentConsent.Scope.AI_PROCESSING, StudentConsent.Action.GRANTED,
                    null, StudentConsent.Method.PAPER, "v3", Instant.now().minus(1, ChronoUnit.DAYS), "  ");
        }

        @Test
        @DisplayName("ghi được và vết mang scope/action/termsVersion nhưng KHÔNG mang note tự do")
        void writesAndAuditsShapeNotContent() {
            when(userRepository.existsById(STUDENT)).thenReturn(true);
            when(consentRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
            stubBirthDate(aged(14));
            ConsentDraft draft = new ConsentDraft(StudentConsent.Scope.AUDIO_RECORDING,
                    StudentConsent.Action.GRANTED, null, StudentConsent.Method.PAPER, "v3",
                    Instant.now().minus(2, ChronoUnit.DAYS), "bố ký tại quầy, sđt 0909");

            service.recordConsent(STUDENT, ORG, draft, ACTOR);

            Map<String, Object> meta = capturedMeta();
            assertThat(meta).containsEntry("scope", "AUDIO_RECORDING")
                    .containsEntry("action", "GRANTED")
                    .containsEntry("termsVersion", "v3")
                    .containsEntry("hasGuardian", false)
                    .doesNotContainKey("note");
            assertThat(meta.values().stream().map(String::valueOf)).noneMatch(v -> v.contains("0909"));
        }

        @Test
        @DisplayName("người giám hộ của học viên KHÁC bị chặn — sổ chỉ-ghi-thêm không gỡ được dòng sai")
        void rejectsGuardianOfAnotherStudent() {
            when(userRepository.existsById(STUDENT)).thenReturn(true);
            when(guardianRepository.findById(77L)).thenReturn(Optional.of(
                    StudentGuardian.builder().id(77L).studentUserId(OTHER_STUDENT).build()));
            ConsentDraft draft = new ConsentDraft(StudentConsent.Scope.AI_PROCESSING,
                    StudentConsent.Action.GRANTED, 77L, StudentConsent.Method.PAPER, "v3", null, null);

            assertThatThrownBy(() -> service.recordConsent(STUDENT, ORG, draft, ACTOR))
                    .isInstanceOf(BadRequestException.class);
            verify(consentRepository, never()).save(any());
        }

        @Test
        @DisplayName("thiếu termsVersion ⇒ chặn: bằng chứng phải nói được đồng ý với CÁI GÌ")
        void requiresTermsVersion() {
            when(userRepository.existsById(STUDENT)).thenReturn(true);
            ConsentDraft draft = new ConsentDraft(StudentConsent.Scope.MESSAGING,
                    StudentConsent.Action.GRANTED, null, StudentConsent.Method.IN_APP, " ", null, null);

            assertThatThrownBy(() -> service.recordConsent(STUDENT, ORG, draft, ACTOR))
                    .isInstanceOf(BadRequestException.class);
        }

        @Test
        @DisplayName("effectiveAt ở tương lai xa bị chặn (dung sai lệch đồng hồ 5 phút)")
        void rejectsFutureEffectiveAt() {
            when(userRepository.existsById(STUDENT)).thenReturn(true);
            ConsentDraft draft = new ConsentDraft(StudentConsent.Scope.MESSAGING,
                    StudentConsent.Action.GRANTED, null, StudentConsent.Method.IN_APP, "v1",
                    Instant.now().plus(1, ChronoUnit.DAYS), null);

            assertThatThrownBy(() -> service.recordConsent(STUDENT, ORG, draft, ACTOR))
                    .isInstanceOf(BadRequestException.class);
        }

        @Test
        @DisplayName("REVOKED mới nhất ⇒ KHÔNG còn đồng ý")
        void latestRevokedWins() {
            when(consentRepository.findFirstByStudentUserIdAndScopeOrderByEffectiveAtDescIdDesc(
                    STUDENT, StudentConsent.Scope.AI_PROCESSING))
                    .thenReturn(Optional.of(StudentConsent.builder()
                            .action(StudentConsent.Action.REVOKED).build()));

            ConsentState state = service.consentStatus(STUDENT, StudentConsent.Scope.AI_PROCESSING);

            assertThat(state).isEqualTo(ConsentState.REVOKED);
            assertThat(state.isEffective()).isFalse();
        }

        @Test
        @DisplayName("chưa có dòng nào ⇒ NEVER_RECORDED, khác hẳn REVOKED về vận hành")
        void neverRecordedWhenLedgerEmpty() {
            when(consentRepository.findFirstByStudentUserIdAndScopeOrderByEffectiveAtDescIdDesc(
                    STUDENT, StudentConsent.Scope.AI_PROCESSING)).thenReturn(Optional.empty());

            ConsentState state = service.consentStatus(STUDENT, StudentConsent.Scope.AI_PROCESSING);

            assertThat(state).isEqualTo(ConsentState.NEVER_RECORDED);
            assertThat(state.isEffective()).isFalse();
        }

        @Test
        @DisplayName("GRANTED mới nhất ⇒ được phép xử lý")
        void latestGrantedIsEffective() {
            when(consentRepository.findFirstByStudentUserIdAndScopeOrderByEffectiveAtDescIdDesc(
                    STUDENT, StudentConsent.Scope.AI_PROCESSING))
                    .thenReturn(Optional.of(StudentConsent.builder()
                            .action(StudentConsent.Action.GRANTED).build()));

            assertThat(service.consentStatus(STUDENT, StudentConsent.Scope.AI_PROCESSING).isEffective())
                    .isTrue();
        }
    }

    @Nested
    @DisplayName("Bất biến chỉ-ghi-thêm của sổ đồng ý")
    class AppendOnly {

        @Test
        @DisplayName("StudentConsent không có setter công khai nào cho trường đã ghi")
        void entityExposesNoSetters() {
            assertThat(StudentConsent.class.getMethods())
                    .noneMatch(m -> m.getName().startsWith("set"));
        }

        @Test
        @DisplayName("StudentConsentRepository không khai báo @Modifying nào")
        void repositoryDeclaresNoModifyingQuery() {
            assertThat(StudentConsentRepository.class.getDeclaredMethods())
                    .noneMatch(m -> m.isAnnotationPresent(
                            org.springframework.data.jpa.repository.Modifying.class));
        }
    }
}
