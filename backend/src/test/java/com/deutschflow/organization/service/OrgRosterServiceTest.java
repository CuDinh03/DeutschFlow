package com.deutschflow.organization.service;

import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.organization.dto.RosterImportResultDto;
import com.deutschflow.organization.entity.OrgMember;
import com.deutschflow.organization.entity.OrgMemberId;
import com.deutschflow.organization.entity.Organization;
import com.deutschflow.organization.repository.OrgMemberRepository;
import com.deutschflow.organization.repository.OrganizationRepository;
import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.common.exception.ForbiddenException;
import com.deutschflow.teacher.entity.ClassStudent;
import com.deutschflow.teacher.entity.ClassStudentId;
import com.deutschflow.teacher.entity.TeacherClass;
import com.deutschflow.teacher.repository.ClassStudentRepository;
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

@ExtendWith(MockitoExtension.class)
@DisplayName("OrgRosterService Unit Tests")
class OrgRosterServiceTest {

    @Mock private OrganizationRepository organizationRepository;
    @Mock private UserRepository userRepository;
    @Mock private PasswordEncoder passwordEncoder;
    @Mock private OrgMembershipService membershipService;
    @Mock private OrgEntitlementService entitlementService;
    @Mock private OrgMemberRepository orgMemberRepository;
    @Mock private ClassStudentRepository classStudentRepository;
    @Mock private TeacherClassRepository teacherClassRepository;
    @Mock private JdbcTemplate jdbcTemplate;

    private OrgRosterService service;

    private static final Long ORG_ID = 10L;
    private static final Long CLASS_ID = 55L;

    @BeforeEach
    void setUp() {
        service = new OrgRosterService(
                organizationRepository,
                userRepository,
                passwordEncoder,
                membershipService,
                entitlementService,
                orgMemberRepository,
                classStudentRepository,
                teacherClassRepository,
                jdbcTemplate
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
        when(userRepository.findByEmail("alice@school.edu")).thenReturn(Optional.empty());
        when(passwordEncoder.encode(anyString())).thenReturn("hashed");

        User created = savedStudent(1L, "alice@school.edu");
        when(userRepository.save(any(User.class))).thenReturn(created);

        RosterImportResultDto result = service.importStudents(ORG_ID, csv, null);

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
        when(userRepository.findByEmail("bob@school.edu")).thenReturn(Optional.of(existing));
        when(orgMemberRepository.findByIdOrgIdAndIdUserId(ORG_ID, 42L))
                .thenReturn(Optional.of(new OrgMember()));

        String csv = "bob@school.edu,Bob Nguyen";
        RosterImportResultDto result = service.importStudents(ORG_ID, csv, null);

        assertThat(result.linked()).isEqualTo(1);
        assertThat(result.created()).isEqualTo(0);
        assertThat(result.failed()).isEqualTo(0);

        // save must not be called for user creation (only the existing user path is taken)
        verify(userRepository, never()).save(any(User.class));
        verify(membershipService).upsertMember(eq(ORG_ID), eq(42L), eq("STUDENT"));
        verify(entitlementService).grantStudent(eq(42L), eq(org));
    }

    // ------------------------------------------------------------------ class enrollment

    @Test
    @DisplayName("import with classId: new student is enrolled into the class")
    void importStudents_withClassId_enrollsStudent() {
        Organization org = org(0, "PRO");
        stubOrg(org);

        User created = savedStudent(7L, "charlie@school.edu");
        when(userRepository.findByEmail("charlie@school.edu")).thenReturn(Optional.empty());
        when(passwordEncoder.encode(anyString())).thenReturn("hashed");
        when(userRepository.save(any(User.class))).thenReturn(created);
        when(classStudentRepository.existsByIdClassIdAndIdStudentId(CLASS_ID, 7L)).thenReturn(false);

        String csv = "charlie@school.edu,Charlie";
        RosterImportResultDto result = service.importStudents(ORG_ID, csv, CLASS_ID);

        assertThat(result.enrolled()).isEqualTo(1);

        ArgumentCaptor<ClassStudent> captor = ArgumentCaptor.forClass(ClassStudent.class);
        verify(classStudentRepository).save(captor.capture());
        assertThat(captor.getValue().getId().getClassId()).isEqualTo(CLASS_ID);
        assertThat(captor.getValue().getId().getStudentId()).isEqualTo(7L);
    }

    @Test
    @DisplayName("import with classId: already-enrolled student is NOT re-enrolled")
    void importStudents_withClassId_alreadyEnrolled_skipsEnrollment() {
        Organization org = org(0, "PRO");
        stubOrg(org);

        User existing = savedStudent(8L, "diana@school.edu");
        when(userRepository.findByEmail("diana@school.edu")).thenReturn(Optional.of(existing));
        when(orgMemberRepository.findByIdOrgIdAndIdUserId(ORG_ID, 8L))
                .thenReturn(Optional.of(new OrgMember()));
        when(classStudentRepository.existsByIdClassIdAndIdStudentId(CLASS_ID, 8L)).thenReturn(true);

        String csv = "diana@school.edu,Diana";
        RosterImportResultDto result = service.importStudents(ORG_ID, csv, CLASS_ID);

        assertThat(result.enrolled()).isEqualTo(0);
        verify(classStudentRepository, never()).save(any());
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
        when(userRepository.findByEmail("valid@school.edu")).thenReturn(Optional.empty());
        when(passwordEncoder.encode(anyString())).thenReturn("hashed");
        when(userRepository.save(any(User.class))).thenReturn(created);

        RosterImportResultDto result = service.importStudents(ORG_ID, csv, null);

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
        when(userRepository.findByEmail("good@school.edu")).thenReturn(Optional.empty());
        when(passwordEncoder.encode(anyString())).thenReturn("hashed");
        when(userRepository.save(any(User.class))).thenReturn(created);

        RosterImportResultDto result = service.importStudents(ORG_ID, csv, null);

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

        RosterImportResultDto result = service.importStudents(ORG_ID, csv, null);

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
        when(userRepository.findByEmail("over@school.edu")).thenReturn(Optional.empty());
        // Seat count is already at the limit
        when(membershipService.countByRole(ORG_ID, "STUDENT")).thenReturn(5L);

        String csv = "over@school.edu,Over Limit";
        RosterImportResultDto result = service.importStudents(ORG_ID, csv, null);

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
        when(userRepository.findByEmail("first@school.edu")).thenReturn(Optional.empty());
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
        when(userRepository.findByEmail("second@school.edu")).thenReturn(Optional.empty());

        RosterImportResultDto result = service.importStudents(ORG_ID, csv, null);

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
        when(userRepository.findByEmail("any@school.edu")).thenReturn(Optional.empty());
        when(passwordEncoder.encode(anyString())).thenReturn("hashed");
        when(userRepository.save(any(User.class))).thenReturn(created);

        RosterImportResultDto result = service.importStudents(ORG_ID, csv, null);

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
        when(userRepository.findByEmail("student@school.edu")).thenReturn(Optional.empty());
        when(passwordEncoder.encode(anyString())).thenReturn("hashed");
        when(userRepository.save(any(User.class))).thenReturn(created);

        RosterImportResultDto result = service.importStudents(ORG_ID, csv, null);

        assertThat(result.total()).isEqualTo(1); // header not counted
        assertThat(result.created()).isEqualTo(1);
    }

    // ------------------------------------------------------------------ org not found

    @Test
    @DisplayName("import: unknown org → throws NotFoundException immediately")
    void importStudents_orgNotFound_throwsNotFoundException() {
        when(organizationRepository.findById(ORG_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.importStudents(ORG_ID, "a@b.com", null))
                .isInstanceOf(NotFoundException.class);
    }

    // ------------------------------------------------------------------ display-name fallback

    @Test
    @DisplayName("import: missing display name → uses local part of email as display name")
    void importStudents_missingDisplayName_usesEmailLocalPart() {
        Organization org = org(0, null);
        stubOrg(org);

        String csv = "noname@school.edu";
        when(userRepository.findByEmail("noname@school.edu")).thenReturn(Optional.empty());
        when(passwordEncoder.encode(anyString())).thenReturn("hashed");
        User created = savedStudent(20L, "noname@school.edu");
        when(userRepository.save(any(User.class))).thenReturn(created);

        service.importStudents(ORG_ID, csv, null);

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

        assertThatThrownBy(() -> service.importStudents(ORG_ID, "a@b.com,A", foreignClassId))
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

        assertThatThrownBy(() -> service.importStudents(ORG_ID, "a@b.com,A", 404L))
                .isInstanceOf(BadRequestException.class);

        verify(membershipService, never()).upsertMember(anyLong(), anyLong(), anyString());
    }
}
