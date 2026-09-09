package com.deutschflow.organization.service;

import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.common.audit.AuditActor;
import com.deutschflow.common.audit.AuditLogService;
import com.deutschflow.common.minor.GuardianDraft;
import com.deutschflow.common.minor.MinorLearnerService;
import com.deutschflow.common.minor.MinorPolicy;
import com.deutschflow.common.minor.StudentGuardian;
import com.deutschflow.organization.dto.RosterImportResultDto;
import com.deutschflow.organization.entity.OrgMember;
import com.deutschflow.organization.entity.OrgMemberId;
import com.deutschflow.organization.entity.Organization;
import com.deutschflow.organization.repository.OrgMemberRepository;
import com.deutschflow.organization.repository.OrganizationRepository;
import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.common.exception.ForbiddenException;
import com.deutschflow.teacher.entity.ClassStudentId;
import com.deutschflow.teacher.entity.TeacherClass;
import com.deutschflow.teacher.repository.TeacherClassRepository;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.LocalDate;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import java.util.List;

@ExtendWith(MockitoExtension.class)
@DisplayName("OrgRosterService Unit Tests")
class OrgRosterServiceTest {

    @Mock private OrganizationRepository organizationRepository;
    @Mock private UserRepository userRepository;
    @Mock private PasswordEncoder passwordEncoder;
    @Mock private OrgMembershipService membershipService;
    @Mock private OrgEntitlementService entitlementService;
    @Mock private OrgMemberRepository orgMemberRepository;
    @Mock private com.deutschflow.teacher.service.ClassEnrollmentService classEnrollmentService;
    @Mock private TeacherClassRepository teacherClassRepository;
    @Mock private JdbcTemplate jdbcTemplate;
    @Mock private com.deutschflow.teacher.service.AssignmentBackfillService assignmentBackfillService;
    @Mock private MinorLearnerService minorLearnerService;

    private OrgRosterService service;

    @Mock private AuditLogService auditLogService;

    /** Người bấm import — vết tổng kết mang danh tính này. */
    private static final AuditActor ACTOR = new AuditActor(2L, "manager@tt.vn", "MANAGER");
    private static final Long ORG_ID = 10L;
    private static final Long CLASS_ID = 55L;

    @BeforeEach
    void setUp() {
        // The per-row DB work lives in OrgRosterRowImporter (its own REQUIRES_NEW transaction).
        // Constructed directly here, so it is unproxied and its @Transactional is inert — these
        // tests exercise the import logic, not the transaction boundary. That boundary is covered
        // by OrgRosterServiceTransactionTest, which needs a real Spring context to observe it.
        OrgRosterRowImporter rowImporter = new OrgRosterRowImporter(
                userRepository,
                passwordEncoder,
                membershipService,
                entitlementService,
                orgMemberRepository,
                classEnrollmentService,
                assignmentBackfillService,
                minorLearnerService,
                jdbcTemplate
        );
        service = new OrgRosterService(
                organizationRepository,
                teacherClassRepository,
                rowImporter,
                // MinorPolicy thật (16/18 = mặc định production): nó thuần tính toán, mock nó thì
                // bài test "dưới 16 phải có người giám hộ" chỉ còn kiểm chính cái mock.
                new RosterMinorColumnReader(new MinorPolicy(16, 18)),
                auditLogService
        );
        // Stub the advisory FOR UPDATE lock — no-op in tests (J).
        lenient().when(jdbcTemplate.queryForObject(
                org.mockito.ArgumentMatchers.contains("FOR UPDATE"),
                org.mockito.ArgumentMatchers.eq(Long.class),
                org.mockito.ArgumentMatchers.any())).thenReturn(ORG_ID);
        // CLASS_ID belongs to ORG_ID by default so the existing classId tests pass the IDOR guard.
        lenient().when(teacherClassRepository.findById(CLASS_ID))
                .thenReturn(Optional.of(TeacherClass.builder().id(CLASS_ID).orgId(ORG_ID).build()));
    }

    @Test
    @DisplayName("PR-A5b: ô bọc ngoặc kép — tên có dấu phẩy và \"\" bên trong tách đúng, header bọc ngoặc vẫn được bỏ qua")
    void importStudents_parsesQuotedFieldsPerRfc4180() {
        stubOrg(org(0, "PRO"));
        String csv = "\"email\",\"displayName\",\"phone\"\n"
                + "\"an@x.com\",\"Nguyễn, An\",\"0912\"\n"
                + "binh@x.com,\"Trần \"\"Bình\"\" Văn\",\n";
        when(userRepository.findByEmailIgnoreCase(anyString())).thenReturn(Optional.empty());
        when(userRepository.save(any(User.class))).thenAnswer(inv -> {
            User created = inv.getArgument(0);
            created.setId(100L);
            return created;
        });

        RosterImportResultDto result = service.importStudents(ORG_ID, csv, null, ACTOR);

        assertEquals(2, result.total(), "header bọc ngoặc phải bị bỏ qua, còn đúng 2 dòng dữ liệu");
        assertEquals(0, result.failed(), () -> "không dòng nào được coi là lỗi: " + result.errors());
        ArgumentCaptor<User> saved = ArgumentCaptor.forClass(User.class);
        verify(userRepository, times(2)).save(saved.capture());
        assertEquals(List.of("Nguyễn, An", "Trần \"Bình\" Văn"),
                saved.getAllValues().stream().map(User::getDisplayName).toList());
        assertEquals(List.of("an@x.com", "binh@x.com"),
                saved.getAllValues().stream().map(User::getEmail).toList());
    }

    @Test
    @DisplayName("PR-A5b: splitCsvLine — ô thường, ô bọc ngoặc, ngoặc không đóng không làm nổ")
    void splitCsvLine_edgeCases() {
        assertArrayEquals(new String[]{"a@x.com", "A", ""}, OrgRosterService.splitCsvLine("a@x.com,A,"));
        assertArrayEquals(new String[]{"a@x.com", "Nguyễn, An"}, OrgRosterService.splitCsvLine("a@x.com,\"Nguyễn, An\""));
        assertArrayEquals(new String[]{"", ""}, OrgRosterService.splitCsvLine(","));
        assertArrayEquals(new String[]{"a@x.com", "chưa đóng, ngoặc"}, OrgRosterService.splitCsvLine("a@x.com,\"chưa đóng, ngoặc"));
    }

    @Test
    @DisplayName("import ghi ĐÚNG MỘT dòng vết tổng kết, không phải mỗi học viên một dòng")
    void importStudents_writesExactlyOneSummaryAudit() {
        stubOrg(org(0, "PRO"));
        String csv = "a@x.com,A\nb@x.com,B\nc@x.com,C";
        when(userRepository.findByEmailIgnoreCase(anyString())).thenReturn(Optional.empty());
        when(userRepository.save(any(User.class))).thenAnswer(inv -> {
            User u = inv.getArgument(0);
            u.setId(100L);
            return u;
        });

        service.importStudents(ORG_ID, csv, null, ACTOR);

        @SuppressWarnings("unchecked")
        ArgumentCaptor<Map<String, Object>> meta = ArgumentCaptor.forClass(Map.class);
        // 3 học viên → vẫn CHỈ 1 dòng audit: import là MỘT hành động của MỘT người. Ghi từng dòng
        // sẽ nhấn chìm màn hình vết mà không thêm thông tin — chi tiết lỗi đã nằm ở DTO trả về.
        verify(auditLogService).log(eq("org_member_imported"), eq(ACTOR),
                eq("ORG"), eq(String.valueOf(ORG_ID)), eq(ORG_ID), meta.capture());
        assertThat(meta.getValue())
                .containsEntry("orgId", ORG_ID)
                .containsEntry("total", 3)
                .containsEntry("created", 3)
                .containsEntry("failed", 0);
    }

    // ------------------------------------------------------------------ helpers

    private Organization org(int seatLimit, String planCode) {
        return Organization.builder()
                .id(ORG_ID)
                .name("Test Org")
                .slug("test-org")
                .seatLimit(seatLimit)
                .planCode(planCode)
                .build();
    }

    private User savedStudent(Long id, String email) {
        return User.builder()
                .id(id)
                .email(email)
                .displayName("Student " + id)
                .role(User.Role.STUDENT)
                .passwordHash("hashed")
                .build();
    }

    private void stubOrg(Organization org) {
        when(organizationRepository.findById(ORG_ID)).thenReturn(Optional.of(org));
    }

    // ------------------------------------------------------------------ new user created

    @Test
    @DisplayName("import: new email → creates STUDENT user + upserts membership + grants entitlement")
    void importStudents_newEmail_createsUserMembershipAndGrantsEntitlement() {
        Organization org = org(0, "PRO");
        stubOrg(org);

        String csv = "alice@school.edu,Alice Tran";
        when(userRepository.findByEmailIgnoreCase("alice@school.edu")).thenReturn(Optional.empty());
        when(passwordEncoder.encode(anyString())).thenReturn("hashed");

        User created = savedStudent(1L, "alice@school.edu");
        when(userRepository.save(any(User.class))).thenReturn(created);

        RosterImportResultDto result = service.importStudents(ORG_ID, csv, null, ACTOR);

        assertThat(result.created()).isEqualTo(1);
        assertThat(result.linked()).isEqualTo(0);
        assertThat(result.failed()).isEqualTo(0);
        assertThat(result.errors()).isEmpty();

        ArgumentCaptor<User> userCaptor = ArgumentCaptor.forClass(User.class);
        verify(userRepository).save(userCaptor.capture());
        User saved = userCaptor.getValue();
        assertThat(saved.getEmail()).isEqualTo("alice@school.edu");
        assertThat(saved.getDisplayName()).isEqualTo("Alice Tran");
        assertThat(saved.getRole()).isEqualTo(User.Role.STUDENT);

        verify(membershipService).upsertMember(eq(ORG_ID), eq(1L), eq("STUDENT"));
        verify(entitlementService).grantStudent(eq(1L), eq(org));
    }

    // ------------------------------------------------------------------ existing email → linked, not created

    @Test
    @DisplayName("import: existing email → links user, does NOT create a new User entity")
    void importStudents_existingEmail_linkedNotCreated() {
        Organization org = org(0, "PRO");
        stubOrg(org);

        User existing = savedStudent(42L, "bob@school.edu");
        when(userRepository.findByEmailIgnoreCase("bob@school.edu")).thenReturn(Optional.of(existing));
        // Thành viên sẵn có ở đây là HỌC VIÊN. `new OrgMember()` mặc định role="TEACHER" (xem
        // entity) — khai rõ vai để bài test nói đúng tình huống nó muốn nói.
        when(orgMemberRepository.findByIdOrgIdAndIdUserId(ORG_ID, 42L))
                .thenReturn(Optional.of(activeMember(42L, "STUDENT")));

        String csv = "bob@school.edu,Bob Nguyen";
        RosterImportResultDto result = service.importStudents(ORG_ID, csv, null, ACTOR);

        assertThat(result.linked()).isEqualTo(1);
        assertThat(result.created()).isEqualTo(0);
        assertThat(result.failed()).isEqualTo(0);

        // save must not be called for user creation (only the existing user path is taken)
        verify(userRepository, never()).save(any(User.class));
        verify(membershipService).upsertMember(eq(ORG_ID), eq(42L), eq("STUDENT"));
        verify(entitlementService).grantStudent(eq(42L), eq(org));
    }

    // ------------------------------------------------------------ CSV học viên KHÔNG hạ vai nhân sự

    /** Thành viên đang hoạt động của org với vai {@code role}. */
    private OrgMember activeMember(Long userId, String role) {
        OrgMember m = new OrgMember();
        m.setId(new OrgMemberId(ORG_ID, userId));
        m.setRole(role);
        m.setStatus("ACTIVE");
        return m;
    }

    @Test
    @DisplayName("import: email của MANAGER đang hoạt động → dòng bị từ chối, KHÔNG hạ xuống STUDENT")
    void importStudents_activeManagerEmail_rejectedNotDemoted() {
        stubOrg(org(0, "PRO"));
        User manager = savedStudent(77L, "rival@tt.vn");
        when(userRepository.findByEmailIgnoreCase("rival@tt.vn")).thenReturn(Optional.of(manager));
        when(orgMemberRepository.findByIdOrgIdAndIdUserId(ORG_ID, 77L))
                .thenReturn(Optional.of(activeMember(77L, "MANAGER")));

        RosterImportResultDto result = service.importStudents(ORG_ID, "rival@tt.vn,Đối thủ", null, ACTOR);

        assertThat(result.failed()).isEqualTo(1);
        assertThat(result.linked()).isEqualTo(0);
        assertThat(result.errors()).singleElement().asString().contains("MANAGER");
        // Đây mới là điều quan trọng: KHÔNG một lệnh ghi vai trò nào được phát ra.
        verify(membershipService, never()).upsertMember(anyLong(), anyLong(), anyString());
        verify(entitlementService, never()).grantStudent(anyLong(), any());
    }

    @Test
    @DisplayName("import: email của TEACHER đang hoạt động → cũng bị từ chối (không âm thầm biến GV thành HV)")
    void importStudents_activeTeacherEmail_rejectedNotDemoted() {
        stubOrg(org(0, "PRO"));
        User teacher = savedStudent(78L, "gv@tt.vn");
        when(userRepository.findByEmailIgnoreCase("gv@tt.vn")).thenReturn(Optional.of(teacher));
        when(orgMemberRepository.findByIdOrgIdAndIdUserId(ORG_ID, 78L))
                .thenReturn(Optional.of(activeMember(78L, "TEACHER")));

        RosterImportResultDto result = service.importStudents(ORG_ID, "gv@tt.vn,Giáo viên", null, ACTOR);

        assertThat(result.failed()).isEqualTo(1);
        verify(membershipService, never()).upsertMember(anyLong(), anyLong(), anyString());
    }

    @Test
    @DisplayName("import: học viên ACTIVE sẵn vẫn nhập lại bình thường — chốt mới chỉ chạm nhân sự")
    void importStudents_activeStudentEmail_stillImported() {
        Organization org = org(0, "PRO");
        stubOrg(org);
        User student = savedStudent(79L, "hv@tt.vn");
        when(userRepository.findByEmailIgnoreCase("hv@tt.vn")).thenReturn(Optional.of(student));
        when(orgMemberRepository.findByIdOrgIdAndIdUserId(ORG_ID, 79L))
                .thenReturn(Optional.of(activeMember(79L, "STUDENT")));

        RosterImportResultDto result = service.importStudents(ORG_ID, "hv@tt.vn,Học viên", null, ACTOR);

        assertThat(result.failed()).isEqualTo(0);
        assertThat(result.linked()).isEqualTo(1);
        verify(membershipService).upsertMember(eq(ORG_ID), eq(79L), eq("STUDENT"));
    }

    // -------------------------------------------------- DEC-13: admin nền tảng không vào CSV học viên

    /** Tài khoản quản trị viên NỀN TẢNG (users.role = ADMIN) — không bao giờ là thành viên trung tâm. */
    private User platformAdmin(Long id, String email) {
        return User.builder()
                .id(id)
                .email(email)
                .displayName("Quản trị viên " + id)
                .role(User.Role.ADMIN)
                .passwordHash("hashed")
                .build();
    }

    @Test
    @DisplayName("DEC-13: dòng CSV là email của ADMIN nền tảng → vào errors KÈM email, không tạo membership")
    void importStudents_platformAdminEmail_rejectedWithEmailInMessage() {
        stubOrg(org(0, "PRO"));
        when(userRepository.findByEmailIgnoreCase("admin@deutschflow.vn"))
                .thenReturn(Optional.of(platformAdmin(9L, "admin@deutschflow.vn")));

        RosterImportResultDto result =
                service.importStudents(ORG_ID, "admin@deutschflow.vn,Quản trị", null, ACTOR);

        assertThat(result.failed()).isEqualTo(1);
        assertThat(result.created()).isEqualTo(0);
        assertThat(result.linked()).isEqualTo(0);
        // Thông báo phải nêu ĐÍCH DANH email: người nhập cầm tệp vài trăm dòng, "lỗi xử lý" trống
        // không cho họ biết phải sửa dòng nào.
        assertThat(result.errors()).singleElement().asString().contains("admin@deutschflow.vn");
        // Và tuyệt đối không có lệnh ghi nào lọt ra: không thành viên, không quyền lợi, không tài khoản mới.
        verify(membershipService, never()).upsertMember(anyLong(), anyLong(), anyString());
        verify(entitlementService, never()).grantStudent(anyLong(), any());
        verify(userRepository, never()).save(any(User.class));
    }

    @Test
    @DisplayName("DEC-22: CSV 3 dòng, giữa là admin nền tảng → hai dòng hợp lệ VẪN nhập, chỉ dòng giữa lỗi")
    void importStudents_platformAdminRowAmongValidRows_otherRowsStillImported() {
        Organization org = org(0, "PRO");
        stubOrg(org);

        // Dòng 1 và 3 hợp lệ, dòng 2 là admin nền tảng. Mỗi dòng chạy trong REQUIRES_NEW riêng nên
        // dòng hỏng không kéo theo dòng lành — ca này khoá ngữ nghĩa đó lại để đợt sau không phá.
        String csv = "truoc@x.com,Trước\nadmin@deutschflow.vn,Quản trị\nsau@x.com,Sau";
        when(userRepository.findByEmailIgnoreCase("truoc@x.com")).thenReturn(Optional.empty());
        when(userRepository.findByEmailIgnoreCase("admin@deutschflow.vn"))
                .thenReturn(Optional.of(platformAdmin(9L, "admin@deutschflow.vn")));
        when(userRepository.findByEmailIgnoreCase("sau@x.com")).thenReturn(Optional.empty());
        when(passwordEncoder.encode(anyString())).thenReturn("hashed");
        when(userRepository.save(any(User.class))).thenAnswer(inv -> {
            User u = inv.getArgument(0);
            u.setId("truoc@x.com".equals(u.getEmail()) ? 201L : 203L);
            return u;
        });

        RosterImportResultDto result = service.importStudents(ORG_ID, csv, null, ACTOR);

        assertEquals(3, result.total());
        assertEquals(2, result.created(), () -> "hai dòng hợp lệ phải vào được: " + result.errors());
        assertEquals(1, result.failed());
        assertThat(result.errors()).singleElement().asString()
                .contains("Dòng 2")
                .contains("admin@deutschflow.vn");

        // Hai dòng lành thực sự được ghi — và ĐÚNG hai, không kèm dòng admin.
        verify(membershipService).upsertMember(eq(ORG_ID), eq(201L), eq("STUDENT"));
        verify(membershipService).upsertMember(eq(ORG_ID), eq(203L), eq("STUDENT"));
        verify(membershipService, times(2)).upsertMember(anyLong(), anyLong(), anyString());
        verify(membershipService, never()).upsertMember(anyLong(), eq(9L), anyString());
        verify(entitlementService, times(2)).grantStudent(anyLong(), eq(org));
    }

    // ------------------------------------------------------------------ class enrollment

    @Test
    @DisplayName("import with classId: new student is enrolled into the class")
    void importStudents_withClassId_enrollsStudent() {
        Organization org = org(0, "PRO");
        stubOrg(org);

        User created = savedStudent(7L, "charlie@school.edu");
        when(userRepository.findByEmailIgnoreCase("charlie@school.edu")).thenReturn(Optional.empty());
        when(passwordEncoder.encode(anyString())).thenReturn("hashed");
        when(userRepository.save(any(User.class))).thenReturn(created);
        when(classEnrollmentService.enroll(CLASS_ID, 7L)).thenReturn(true);

        String csv = "charlie@school.edu,Charlie";
        RosterImportResultDto result = service.importStudents(ORG_ID, csv, CLASS_ID, ACTOR);

        assertThat(result.enrolled()).isEqualTo(1);

        verify(classEnrollmentService).enroll(CLASS_ID, 7L);
        verify(assignmentBackfillService).ensureAssignmentsForStudent(CLASS_ID, 7L);
    }

    @Test
    @DisplayName("import with classId: already-enrolled student is NOT re-enrolled")
    void importStudents_withClassId_alreadyEnrolled_skipsEnrollment() {
        Organization org = org(0, "PRO");
        stubOrg(org);

        User existing = savedStudent(8L, "diana@school.edu");
        when(userRepository.findByEmailIgnoreCase("diana@school.edu")).thenReturn(Optional.of(existing));
        when(orgMemberRepository.findByIdOrgIdAndIdUserId(ORG_ID, 8L))
                .thenReturn(Optional.of(activeMember(8L, "STUDENT")));
        when(classEnrollmentService.enroll(CLASS_ID, 8L)).thenReturn(false);

        String csv = "diana@school.edu,Diana";
        RosterImportResultDto result = service.importStudents(ORG_ID, csv, CLASS_ID, ACTOR);

        assertThat(result.enrolled()).isEqualTo(0);
        verify(assignmentBackfillService, never()).ensureAssignmentsForStudent(anyLong(), anyLong());
    }

    // ------------------------------------------------------------------ blank / invalid email

    @Test
    @DisplayName("import: blank email → recorded as error, import continues with valid rows")
    void importStudents_blankEmail_collectedInErrors() {
        Organization org = org(0, null);
        stubOrg(org);

        // Row 1 intentionally has no "email" keyword so it is NOT treated as a header.
        // A blank first column produces a blank email that fails validation.
        // Row 2 is a valid student row.
        String csv = ",Blank First Col\nvalid@school.edu,Valid User";
        User created = savedStudent(99L, "valid@school.edu");
        when(userRepository.findByEmailIgnoreCase("valid@school.edu")).thenReturn(Optional.empty());
        when(passwordEncoder.encode(anyString())).thenReturn("hashed");
        when(userRepository.save(any(User.class))).thenReturn(created);

        RosterImportResultDto result = service.importStudents(ORG_ID, csv, null, ACTOR);

        assertThat(result.failed()).isEqualTo(1);
        assertThat(result.created()).isEqualTo(1);
        assertThat(result.errors()).hasSize(1);
        assertThat(result.errors().get(0)).contains("email không hợp lệ");
    }

    @Test
    @DisplayName("import: invalid email format → collected in errors, import continues")
    void importStudents_invalidEmail_collectedInErrors() {
        Organization org = org(0, null);
        stubOrg(org);

        // "not-an-addr" contains no "@" so it fails the EMAIL_PATTERN check.
        // "good@school.edu" is processed normally afterwards.
        String csv = "not-an-addr,Bad Row\ngood@school.edu,Good User";
        User created = savedStudent(100L, "good@school.edu");
        when(userRepository.findByEmailIgnoreCase("good@school.edu")).thenReturn(Optional.empty());
        when(passwordEncoder.encode(anyString())).thenReturn("hashed");
        when(userRepository.save(any(User.class))).thenReturn(created);

        RosterImportResultDto result = service.importStudents(ORG_ID, csv, null, ACTOR);

        assertThat(result.failed()).isEqualTo(1);
        assertThat(result.created()).isEqualTo(1);
        assertThat(result.errors()).hasSize(1);
        assertThat(result.errors().get(0)).contains("email không hợp lệ");
    }

    @Test
    @DisplayName("import: multiple invalid rows → all collected, processing never aborts")
    void importStudents_multipleInvalidRows_allCollected() {
        Organization org = org(0, null);
        stubOrg(org);

        String csv = "bad-one\nbad-two\nbad-three";

        RosterImportResultDto result = service.importStudents(ORG_ID, csv, null, ACTOR);

        assertThat(result.failed()).isEqualTo(3);
        assertThat(result.created()).isEqualTo(0);
        assertThat(result.errors()).hasSize(3);
        verify(membershipService, never()).upsertMember(anyLong(), anyLong(), anyString());
    }

    // ------------------------------------------------------------------ seat limit reached

    @Test
    @DisplayName("import: seat limit reached for brand-new student → recorded as seat error, stops")
    void importStudents_seatLimitReached_newStudentRecordedAsSeatError() {
        Organization org = org(5, "PRO"); // limit = 5
        stubOrg(org);

        // The single student is brand-new to the org
        when(userRepository.findByEmailIgnoreCase("over@school.edu")).thenReturn(Optional.empty());
        // Seat count is already at the limit
        when(membershipService.countByRole(ORG_ID, "STUDENT")).thenReturn(5L);

        String csv = "over@school.edu,Over Limit";
        RosterImportResultDto result = service.importStudents(ORG_ID, csv, null, ACTOR);

        assertThat(result.failed()).isEqualTo(1);
        assertThat(result.created()).isEqualTo(0);
        assertThat(result.errors()).hasSize(1);
        assertThat(result.errors().get(0)).contains("giới hạn chỗ ngồi");
        // No membership or entitlement should be granted
        verify(membershipService, never()).upsertMember(anyLong(), anyLong(), anyString());
        verify(entitlementService, never()).grantStudent(anyLong(), any());
    }

    @Test
    @DisplayName("import: seat limit reached mid-batch → preceding valid students imported, remaining stopped")
    void importStudents_seatLimitReachedMidBatch_stopsAfterLimit() {
        Organization org = org(1, "PRO"); // limit = 1, only one slot available
        stubOrg(org);

        String csv = "first@school.edu,First\nsecond@school.edu,Second";

        // first student: brand-new, seat count = 0 (below limit)
        User first = savedStudent(1L, "first@school.edu");
        when(userRepository.findByEmailIgnoreCase("first@school.edu")).thenReturn(Optional.empty());
        when(membershipService.countByRole(ORG_ID, "STUDENT")).thenReturn(0L);
        when(passwordEncoder.encode(anyString())).thenReturn("hashed");
        when(userRepository.save(any(User.class))).thenReturn(first);

        // After first student is processed, second student would see count=1 (now at limit).
        // The orgMemberRepository stub for the second (new) student returns empty → isNewMember=true.
        // We rely on countByRole being called again but we don't need a second stub — Mockito
        // returns 0L for all calls unless re-stubbed. To simulate the limit being hit for the
        // second student we use thenReturn with sequence.
        when(membershipService.countByRole(ORG_ID, "STUDENT"))
                .thenReturn(0L)   // first student check: below limit
                .thenReturn(1L);  // second student check: at limit
        when(userRepository.findByEmailIgnoreCase("second@school.edu")).thenReturn(Optional.empty());

        RosterImportResultDto result = service.importStudents(ORG_ID, csv, null, ACTOR);

        assertThat(result.created()).isEqualTo(1);
        assertThat(result.failed()).isEqualTo(1);
        assertThat(result.errors()).hasSize(1);
        assertThat(result.errors().get(0)).contains("giới hạn chỗ ngồi");
    }

    @Test
    @DisplayName("import: seat limit = 0 (unlimited) → does not enforce seat check")
    void importStudents_seatLimitZero_noSeatCheck() {
        Organization org = org(0, null); // 0 = unlimited
        stubOrg(org);

        String csv = "any@school.edu,Any User";
        User created = savedStudent(1L, "any@school.edu");
        when(userRepository.findByEmailIgnoreCase("any@school.edu")).thenReturn(Optional.empty());
        when(passwordEncoder.encode(anyString())).thenReturn("hashed");
        when(userRepository.save(any(User.class))).thenReturn(created);

        RosterImportResultDto result = service.importStudents(ORG_ID, csv, null, ACTOR);

        assertThat(result.created()).isEqualTo(1);
        assertThat(result.failed()).isEqualTo(0);
        // countByRole must NOT be called when seatLimit = 0
        verify(membershipService, never()).countByRole(anyLong(), anyString());
    }

    // ------------------------------------------------------------------ header row skipping

    @Test
    @DisplayName("import: CSV with header line → header skipped, data row processed")
    void importStudents_withHeader_headerSkipped() {
        Organization org = org(0, null);
        stubOrg(org);

        String csv = "email,displayName\nstudent@school.edu,Student Name";
        User created = savedStudent(5L, "student@school.edu");
        when(userRepository.findByEmailIgnoreCase("student@school.edu")).thenReturn(Optional.empty());
        when(passwordEncoder.encode(anyString())).thenReturn("hashed");
        when(userRepository.save(any(User.class))).thenReturn(created);

        RosterImportResultDto result = service.importStudents(ORG_ID, csv, null, ACTOR);

        assertThat(result.total()).isEqualTo(1); // header not counted
        assertThat(result.created()).isEqualTo(1);
    }

    // ------------------------------------------------------------------ org not found

    @Test
    @DisplayName("import: unknown org → throws NotFoundException immediately")
    void importStudents_orgNotFound_throwsNotFoundException() {
        when(organizationRepository.findById(ORG_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.importStudents(ORG_ID, "a@b.com", null, ACTOR))
                .isInstanceOf(NotFoundException.class);
    }

    // ------------------------------------------------------------------ display-name fallback

    @Test
    @DisplayName("import: missing display name → uses local part of email as display name")
    void importStudents_missingDisplayName_usesEmailLocalPart() {
        Organization org = org(0, null);
        stubOrg(org);

        String csv = "noname@school.edu";
        when(userRepository.findByEmailIgnoreCase("noname@school.edu")).thenReturn(Optional.empty());
        when(passwordEncoder.encode(anyString())).thenReturn("hashed");
        User created = savedStudent(20L, "noname@school.edu");
        when(userRepository.save(any(User.class))).thenReturn(created);

        service.importStudents(ORG_ID, csv, null, ACTOR);

        ArgumentCaptor<User> captor = ArgumentCaptor.forClass(User.class);
        verify(userRepository).save(captor.capture());
        assertThat(captor.getValue().getDisplayName()).isEqualTo("noname");
    }

    // ------------------------------------------------------------------ IDOR: classId must belong to org

    @Test
    @DisplayName("import: classId belonging to ANOTHER org → ForbiddenException, no rows processed")
    void importStudents_foreignClassId_throwsForbidden() {
        Organization org = org(0, "PRO");
        stubOrg(org);
        Long foreignClassId = 99L;
        when(teacherClassRepository.findById(foreignClassId))
                .thenReturn(Optional.of(TeacherClass.builder().id(foreignClassId).orgId(999L).build()));

        assertThatThrownBy(() -> service.importStudents(ORG_ID, "a@b.com,A", foreignClassId, ACTOR))
                .isInstanceOf(ForbiddenException.class);

        verify(membershipService, never()).upsertMember(anyLong(), anyLong(), anyString());
        verify(userRepository, never()).save(any(User.class));
    }

    @Test
    @DisplayName("import: unknown classId → BadRequestException before any row is processed")
    void importStudents_unknownClassId_throwsBadRequest() {
        Organization org = org(0, "PRO");
        stubOrg(org);
        when(teacherClassRepository.findById(404L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.importStudents(ORG_ID, "a@b.com,A", 404L, ACTOR))
                .isInstanceOf(BadRequestException.class);

        verify(membershipService, never()).upsertMember(anyLong(), anyLong(), anyString());
    }

    @Test
    @DisplayName("PR-A5c: ô bọc ngoặc kép chứa xuống dòng vẫn là MỘT bản ghi, không chẻ đôi")
    void splitNonEmptyLines_quotedNewlineStaysOneRecord() {
        List<OrgRosterService.CsvRecord> recs = OrgRosterService.splitNonEmptyLines("foo@x.com,\"Dòng1\nDòng2\",0912");

        assertThat(recs).hasSize(1);
        assertThat(OrgRosterService.splitCsvLine(recs.get(0).text()))
                .containsExactly("foo@x.com", "Dòng1\nDòng2", "0912");
    }

    @Test
    @DisplayName("PR-A5c: nhiều bản ghi, một bản trải hai dòng — không sinh dòng lỗi ma")
    void splitNonEmptyLines_mixedRecords() {
        List<OrgRosterService.CsvRecord> recs = OrgRosterService.splitNonEmptyLines(
                "a@x.com,A,1\r\nb@x.com,\"B1\nB2\",2\r\n\r\nc@x.com,C,3");

        assertThat(recs).hasSize(3);
        assertThat(OrgRosterService.splitCsvLine(recs.get(1).text()))
                .containsExactly("b@x.com", "B1\nB2", "2");
    }

    @Test
    @DisplayName("PR-A5c: ngoặc kép escape trong ô nhiều dòng về đúng một dấu ngoặc")
    void splitNonEmptyLines_escapedQuoteInsideMultilineCell() {
        List<OrgRosterService.CsvRecord> recs = OrgRosterService.splitNonEmptyLines("a@x.com,\"nói \"\"xin chào\"\"\nrồi đi\"");

        assertThat(recs).hasSize(1);
        assertThat(OrgRosterService.splitCsvLine(recs.get(0).text())[1]).isEqualTo("nói \"xin chào\"\nrồi đi");
    }

    @Test
    @DisplayName("PR-A5c: ngoặc kép không đóng tới cuối tệp không làm mất dữ liệu")
    void splitNonEmptyLines_unclosedQuoteKeepsRest() {
        List<OrgRosterService.CsvRecord> recs = OrgRosterService.splitNonEmptyLines("a@x.com,\"chưa đóng\nb@x.com,B,2");

        assertThat(recs).hasSize(1);
    }

    @Test
    @DisplayName("PR-A5c: số dòng báo lỗi là dòng VẬT LÝ trong tệp, tính cả header")
    void splitNonEmptyLines_reportsPhysicalLineNumber() {
        List<OrgRosterService.CsvRecord> recs = OrgRosterService.splitNonEmptyLines(
                "email,displayName,phone\na@x.com,A,1\nb@x.com,\"B1\nB2\",2\nc@x.com,C,3");

        assertThat(recs).extracting(OrgRosterService.CsvRecord::line).containsExactly(1, 2, 3, 5);
    }

    // ================================================================== PR-1B: cột chưa thành niên
    //
    // Hai quyết định của owner (09/09/2026) mà nhóm test này khoá lại:
    //   1. Ghi danh KHÔNG phải cổng — dòng không khai ngày sinh vẫn vào bình thường.
    //   2. Cột mới TÙY CHỌN — tệp ba cột đang dùng của trung tâm không được đổi hành vi.

    /** Ngày sinh tương đối với hôm nay, để bài test không tự đỏ theo lịch. */
    private static String birthDateAgedYears(int years) {
        return LocalDate.now(MinorPolicy.ZONE).minusYears(years).toString();
    }

    @Test
    @DisplayName("PR-1B: tệp CŨ ba cột — không có birthDate trong tiêu đề thì KHÔNG đọc cột mới")
    void importStudents_legacyThreeColumnFile_touchesNoMinorData() {
        stubOrg(org(0, null));
        String csv = "email,displayName,phone\nan@x.com,Nguyễn An,0912\n";
        when(userRepository.findByEmailIgnoreCase("an@x.com")).thenReturn(Optional.empty());
        when(passwordEncoder.encode(anyString())).thenReturn("hashed");
        when(userRepository.save(any(User.class))).thenReturn(savedStudent(7L, "an@x.com"));

        RosterImportResultDto result = service.importStudents(ORG_ID, csv, null, ACTOR);

        assertThat(result.created()).isEqualTo(1);
        assertThat(result.failed()).isEqualTo(0);
        verify(minorLearnerService, never()).recordBirthDate(anyLong(), any(), anyLong(), anyLong(), any());
        verify(minorLearnerService, never()).recordGuardian(anyLong(), anyLong(), any(), any());
    }

    @Test
    @DisplayName("PR-1B: tiêu đề có birthDate → ghi ngày sinh và người giám hộ qua MinorLearnerService")
    void importStudents_birthDateHeader_recordsBirthDateAndGuardian() {
        stubOrg(org(0, null));
        String birthDate = birthDateAgedYears(14);
        String csv = "email,displayName,phone,birthDate,guardianName,guardianPhone,guardianRelationship\n"
                + "an@x.com,Nguyễn An,0912," + birthDate + ",Trần Thị Bình,0987654321,mẹ\n";
        when(userRepository.findByEmailIgnoreCase("an@x.com")).thenReturn(Optional.empty());
        when(passwordEncoder.encode(anyString())).thenReturn("hashed");
        when(userRepository.save(any(User.class))).thenReturn(savedStudent(7L, "an@x.com"));
        when(minorLearnerService.recordBirthDate(eq(7L), any(), eq(2L), eq(ORG_ID), any())).thenReturn(true);

        RosterImportResultDto result = service.importStudents(ORG_ID, csv, null, ACTOR);

        assertThat(result.failed()).as("dòng hợp lệ: %s", result.errors()).isEqualTo(0);
        assertThat(result.created()).isEqualTo(1);
        verify(minorLearnerService).recordBirthDate(7L, LocalDate.parse(birthDate), 2L, ORG_ID, ACTOR);
        ArgumentCaptor<GuardianDraft> draft = ArgumentCaptor.forClass(GuardianDraft.class);
        verify(minorLearnerService).recordGuardian(eq(7L), eq(ORG_ID), draft.capture(), eq(ACTOR));
        assertThat(draft.getValue().fullName()).isEqualTo("Trần Thị Bình");
        assertThat(draft.getValue().phone()).isEqualTo("0987654321");
        assertThat(draft.getValue().relationship()).isEqualTo(StudentGuardian.Relationship.MOTHER);
        assertThat(draft.getValue().primary()).isTrue();
    }

    @Test
    @DisplayName("PR-1B: ngày sinh sai định dạng → chỉ dòng đó hỏng, thông báo nêu dòng vật lý + email")
    void importStudents_malformedBirthDate_rejectsOnlyThatRow() {
        stubOrg(org(0, null));
        String csv = "email,displayName,phone,birthDate\n"
                + "an@x.com,An,,01/02/2010\n"
                + "binh@x.com,Bình,,\n";
        when(userRepository.findByEmailIgnoreCase("binh@x.com")).thenReturn(Optional.empty());
        when(passwordEncoder.encode(anyString())).thenReturn("hashed");
        when(userRepository.save(any(User.class))).thenReturn(savedStudent(8L, "binh@x.com"));

        RosterImportResultDto result = service.importStudents(ORG_ID, csv, null, ACTOR);

        assertThat(result.failed()).isEqualTo(1);
        assertThat(result.created()).as("dòng lành vẫn được commit").isEqualTo(1);
        assertThat(result.errors()).singleElement().asString()
                .contains("Dòng 2")
                .contains("an@x.com")
                .contains("YYYY-MM-DD");
    }

    @Test
    @DisplayName("PR-1B: ngày sinh ở tương lai bị từ chối")
    void importStudents_futureBirthDate_rejected() {
        stubOrg(org(0, null));
        String future = LocalDate.now(MinorPolicy.ZONE).plusYears(1).toString();
        String csv = "email,birthDate\nan@x.com," + future + "\n";

        RosterImportResultDto result = service.importStudents(ORG_ID, csv, null, ACTOR);

        assertThat(result.failed()).isEqualTo(1);
        assertThat(result.errors()).singleElement().asString().contains("tương lai");
        verify(userRepository, never()).save(any(User.class));
    }

    @Test
    @DisplayName("PR-1B: dưới ngưỡng pháp lý mà thiếu người giám hộ → từ chối; 16–17 thì vẫn nhận")
    void importStudents_legalMinorWithoutGuardian_rejected() {
        stubOrg(org(0, null));
        String csv = "email,displayName,phone,birthDate,guardianName,guardianPhone\n"
                + "nho@x.com,Nhỏ,," + birthDateAgedYears(14) + ",,\n"
                + "lon@x.com,Lớn,," + birthDateAgedYears(17) + ",,\n";
        when(userRepository.findByEmailIgnoreCase("lon@x.com")).thenReturn(Optional.empty());
        when(passwordEncoder.encode(anyString())).thenReturn("hashed");
        when(userRepository.save(any(User.class))).thenReturn(savedStudent(9L, "lon@x.com"));

        RosterImportResultDto result = service.importStudents(ORG_ID, csv, null, ACTOR);

        assertThat(result.failed()).isEqualTo(1);
        assertThat(result.created()).as("16–17 là luật nội bộ, không phải nghĩa vụ luật — vẫn nhận").isEqualTo(1);
        assertThat(result.errors()).singleElement().asString()
                .contains("Dòng 2").contains("nho@x.com").contains("người giám hộ");
    }

    @Test
    @DisplayName("PR-1B: có guardianName mà thiếu guardianPhone → từ chối (bản ghi phải liên lạc được)")
    void importStudents_guardianWithoutPhone_rejected() {
        stubOrg(org(0, null));
        String csv = "email,birthDate,guardianName,guardianPhone\n"
                + "an@x.com," + birthDateAgedYears(14) + ",Trần Bình,\n";

        RosterImportResultDto result = service.importStudents(ORG_ID, csv, null, ACTOR);

        assertThat(result.failed()).isEqualTo(1);
        assertThat(result.errors()).singleElement().asString().contains("guardianPhone");
    }

    @Test
    @DisplayName("PR-1B: guardianRelationship lạ → từ chối kèm danh sách giá trị nhận được")
    void importStudents_unknownRelationship_rejected() {
        stubOrg(org(0, null));
        String csv = "email,birthDate,guardianName,guardianPhone,guardianRelationship\n"
                + "an@x.com," + birthDateAgedYears(14) + ",Trần Bình,0987,hàng xóm\n";

        RosterImportResultDto result = service.importStudents(ORG_ID, csv, null, ACTOR);

        assertThat(result.failed()).isEqualTo(1);
        assertThat(result.errors()).singleElement().asString()
                .contains("guardianRelationship").contains("LEGAL_GUARDIAN");
    }

    @Test
    @DisplayName("PR-1B: nhập lại — tài khoản đã có ngày sinh/người giám hộ KHÔNG tính là lỗi")
    void importStudents_reimport_existingBirthDateIsNotAFailure() {
        stubOrg(org(0, null));
        User existing = savedStudent(11L, "an@x.com");
        when(userRepository.findByEmailIgnoreCase("an@x.com")).thenReturn(Optional.of(existing));
        when(orgMemberRepository.findByIdOrgIdAndIdUserId(ORG_ID, 11L)).thenReturn(Optional.of(
                OrgMember.builder().id(new OrgMemberId(ORG_ID, 11L)).role("STUDENT").status("ACTIVE").build()));
        // Đã có ngày sinh ⇒ recordBirthDate trả false; đã có người giám hộ ⇒ không thêm dòng thứ hai.
        when(minorLearnerService.recordBirthDate(eq(11L), any(), anyLong(), anyLong(), any()))
                .thenReturn(false);
        when(minorLearnerService.guardiansOf(11L)).thenReturn(List.of(
                StudentGuardian.builder().id(3L).studentUserId(11L).fullName("Đã có").build()));
        String csv = "email,birthDate,guardianName,guardianPhone\n"
                + "an@x.com," + birthDateAgedYears(14) + ",Trần Bình,0987\n";

        RosterImportResultDto result = service.importStudents(ORG_ID, csv, null, ACTOR);

        assertThat(result.failed()).as("nhập lại không phải lỗi: %s", result.errors()).isEqualTo(0);
        assertThat(result.linked()).isEqualTo(1);
        verify(minorLearnerService, never()).recordGuardian(anyLong(), anyLong(), any(), any());
    }

    @Test
    @DisplayName("PR-1B: tiêu đề không có displayName → tên KHÔNG lấy nhầm ô ngày sinh")
    void importStudents_headerWithoutDisplayName_doesNotReadBirthDateAsName() {
        stubOrg(org(0, null));
        String csv = "email,birthDate\nan@x.com," + birthDateAgedYears(20) + "\n";
        when(userRepository.findByEmailIgnoreCase("an@x.com")).thenReturn(Optional.empty());
        when(passwordEncoder.encode(anyString())).thenReturn("hashed");
        ArgumentCaptor<User> saved = ArgumentCaptor.forClass(User.class);
        when(userRepository.save(saved.capture())).thenReturn(savedStudent(12L, "an@x.com"));

        service.importStudents(ORG_ID, csv, null, ACTOR);

        assertThat(saved.getValue().getDisplayName())
                .as("rỗng thì lùi về phần trước @ của email, không phải ngày sinh").isEqualTo("an");
    }

    @Test
    @DisplayName("⛔ PR-1B: vết tổng kết mang SỐ LƯỢNG, không mang ngày sinh hay tên người giám hộ")
    void importStudents_auditMetadataCarriesCountsNotContent() {
        stubOrg(org(0, null));
        String birthDate = birthDateAgedYears(14);
        String csv = "email,birthDate,guardianName,guardianPhone\n"
                + "an@x.com," + birthDate + ",Trần Thị Bình,0987654321\n";
        when(userRepository.findByEmailIgnoreCase("an@x.com")).thenReturn(Optional.empty());
        when(passwordEncoder.encode(anyString())).thenReturn("hashed");
        when(userRepository.save(any(User.class))).thenReturn(savedStudent(13L, "an@x.com"));
        when(minorLearnerService.recordBirthDate(eq(13L), any(), anyLong(), anyLong(), any()))
                .thenReturn(true);

        service.importStudents(ORG_ID, csv, null, ACTOR);

        @SuppressWarnings("unchecked")
        ArgumentCaptor<Map<String, Object>> meta = ArgumentCaptor.forClass(Map.class);
        verify(auditLogService).log(eq("org_member_imported"), eq(ACTOR), eq("ORG"),
                eq(String.valueOf(ORG_ID)), eq(ORG_ID), meta.capture());
        assertThat(meta.getValue()).containsEntry("birthDatesRecorded", 1)
                .containsEntry("guardiansRecorded", 1);
        assertThat(meta.getValue().toString())
                .as("không ngày sinh thô, không tên/điện thoại người giám hộ trong sổ hoạt động")
                .doesNotContain(birthDate)
                .doesNotContain("Trần Thị Bình")
                .doesNotContain("0987654321");
    }
}
