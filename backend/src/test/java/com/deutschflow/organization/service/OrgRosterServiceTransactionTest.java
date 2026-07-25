package com.deutschflow.organization.service;

import com.deutschflow.common.audit.AuditActor;
import com.deutschflow.common.audit.AuditLogService;
import com.deutschflow.organization.dto.RosterImportResultDto;
import com.deutschflow.organization.entity.OrgMember;
import com.deutschflow.organization.entity.OrgMemberId;
import com.deutschflow.organization.entity.Organization;
import com.deutschflow.organization.repository.OrgMemberRepository;
import com.deutschflow.organization.repository.OrganizationRepository;
import com.deutschflow.teacher.repository.ClassStudentRepository;
import com.deutschflow.teacher.repository.TeacherClassRepository;
import com.deutschflow.teacher.service.AssignmentBackfillService;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentMatchers;
import org.springframework.context.annotation.AnnotationConfigApplicationContext;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.ResultSetExtractor;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.EnableTransactionManagement;

import javax.sql.DataSource;
import java.sql.Connection;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Transaction-boundary contract of {@link OrgRosterService#importStudents}: one bad row must not
 * kill the whole import.
 *
 * <p>Why this test cannot be a plain Mockito unit test (unlike its sibling
 * {@code OrgRosterServiceTest}): the defect lives in the Spring proxy layer, not in the service
 * code. When a collaborator annotated {@code @Transactional} (REQUIRED) throws a RuntimeException,
 * {@code TransactionAspectSupport} marks the *shared* transaction rollback-only before the
 * exception ever reaches the caller's {@code catch}. Swallowing it does not clear that flag, so the
 * commit at the end blows up with {@link org.springframework.transaction.UnexpectedRollbackException}
 * and the endpoint 500s — even though every row was individually accounted for in
 * {@link RosterImportResultDto#errors()}. A constructor-wired service with mocked collaborators has
 * no proxy and no transaction, so it can never observe this.
 *
 * <p>So we stand up a real (tiny) Spring context: real {@code @EnableTransactionManagement}, a real
 * {@link DataSourceTransactionManager}, and the two real services that participate in the shared
 * transaction. Only the DataSource/Connection and the leaf repositories are mocked. The rollback-only
 * bookkeeping under test lives entirely in {@code AbstractPlatformTransactionManager} +
 * {@code ConnectionHolder} (in-memory flags), so a mocked JDBC {@link Connection} exercises the exact
 * production control flow without a database. Boot wires {@code JpaTransactionManager} in prod, which
 * implements the identical participation contract from the same base class.
 *
 * <p>The trigger is the real, documented one (see the "Audit M-1" comment in
 * {@link OrgMembershipService#upsertMember}): the loop's pre-check treats any existing
 * {@code org_members} row as "not a new member" and skips its seat gate, while {@code upsertMember}
 * treats a REVOKED/LEFT row as a seat-adding re-add and fires its gate. At the seat cap those two
 * disagree and {@code upsertMember} throws {@code BadRequestException} from inside the shared
 * transaction.
 */
@DisplayName("OrgRosterService — transaction boundary (one bad row must not poison the import)")
class OrgRosterServiceTransactionTest {

    private static final Long ORG_ID = 10L;
    private static final AuditActor ACTOR = new AuditActor(2L, "manager@tt.vn", "MANAGER");
    private static final long SEAT_LIMIT = 5L;

    private AnnotationConfigApplicationContext ctx;

    private OrganizationRepository organizationRepository;
    private UserRepository userRepository;
    private PasswordEncoder passwordEncoder;
    private OrgEntitlementService entitlementService;
    private OrgMemberRepository orgMemberRepository;
    private ClassStudentRepository classStudentRepository;
    private TeacherClassRepository teacherClassRepository;
    private AssignmentBackfillService assignmentBackfillService;
    private JdbcTemplate jdbcTemplate;
    private AuditLogService auditLogService;

    private OrgRosterService service;

    /** Enables the real {@code @Transactional} proxy machinery — the whole point of this test. */
    @Configuration
    @EnableTransactionManagement(proxyTargetClass = true)
    static class TxConfig {
    }

    @BeforeEach
    void setUp() throws Exception {
        organizationRepository = mock(OrganizationRepository.class);
        userRepository = mock(UserRepository.class);
        passwordEncoder = mock(PasswordEncoder.class);
        entitlementService = mock(OrgEntitlementService.class);
        orgMemberRepository = mock(OrgMemberRepository.class);
        classStudentRepository = mock(ClassStudentRepository.class);
        teacherClassRepository = mock(TeacherClassRepository.class);
        assignmentBackfillService = mock(AssignmentBackfillService.class);
        jdbcTemplate = mock(JdbcTemplate.class);
        auditLogService = mock(AuditLogService.class);

        // A mocked Connection is enough: begin/commit/rollback/close are no-ops, and the
        // rollback-only flag we are asserting on lives on Spring's ConnectionHolder, not in the DB.
        DataSource dataSource = mock(DataSource.class);
        Connection connection = mock(Connection.class);
        when(dataSource.getConnection()).thenReturn(connection);

        ctx = new AnnotationConfigApplicationContext();
        ctx.registerBean(PlatformTransactionManager.class,
                () -> new DataSourceTransactionManager(dataSource));
        ctx.registerBean(OrganizationRepository.class, () -> organizationRepository);
        ctx.registerBean(UserRepository.class, () -> userRepository);
        ctx.registerBean(PasswordEncoder.class, () -> passwordEncoder);
        ctx.registerBean(OrgEntitlementService.class, () -> entitlementService);
        ctx.registerBean(OrgMemberRepository.class, () -> orgMemberRepository);
        ctx.registerBean(ClassStudentRepository.class, () -> classStudentRepository);
        ctx.registerBean(TeacherClassRepository.class, () -> teacherClassRepository);
        ctx.registerBean(AssignmentBackfillService.class, () -> assignmentBackfillService);
        ctx.registerBean(JdbcTemplate.class, () -> jdbcTemplate);
        // OrgMembershipService nay ghi vết audit cho mọi thay đổi thành viên, nên context tối
        // giản này cũng cần bean đó. Mock: bài test đo RANH GIỚI TRANSACTION, không đo vết.
        ctx.registerBean(AuditLogService.class, () -> auditLogService);
        // Real and proxied — these are the beans whose transaction boundaries are under test.
        ctx.registerBean(OrgMembershipService.class);
        ctx.registerBean(OrgRosterRowImporter.class);
        ctx.registerBean(OrgRosterService.class);
        ctx.register(TxConfig.class);
        ctx.refresh();

        service = ctx.getBean(OrgRosterService.class);
    }

    @AfterEach
    void tearDown() {
        if (ctx != null) {
            ctx.close();
        }
    }

    // ------------------------------------------------------------------ fixture

    private void stubOrgAtSeatCap() {
        Organization org = Organization.builder()
                .id(ORG_ID)
                .name("Test Org")
                .slug("test-org")
                .seatLimit((int) SEAT_LIMIT)
                .planCode(null)   // no plan → grantStudent is a no-op, keeps the fixture small
                .build();
        when(organizationRepository.findById(ORG_ID)).thenReturn(Optional.of(org));

        // Batch-level advisory lock taken by importStudents (J).
        lenient().when(jdbcTemplate.queryForObject(contains("FOR UPDATE"), eq(Long.class), any()))
                .thenReturn(ORG_ID);
        // Seat gate re-read inside upsertMember.
        lenient().when(jdbcTemplate.query(contains("seat_limit"),
                        ArgumentMatchers.<ResultSetExtractor<Long>>any(), any()))
                .thenReturn(SEAT_LIMIT);
        // Org is exactly at its cap.
        lenient().when(orgMemberRepository.countByIdOrgIdAndRoleAndStatus(ORG_ID, "STUDENT", "ACTIVE"))
                .thenReturn(SEAT_LIMIT);
    }

    /** An existing user who is already an ACTIVE STUDENT member — imports cleanly at the cap. */
    private void stubActiveMember(Long userId, String email) {
        User user = User.builder()
                .id(userId).email(email).displayName("U" + userId)
                .role(User.Role.STUDENT).passwordHash("hashed").build();
        when(userRepository.findByEmailIgnoreCase(email)).thenReturn(Optional.of(user));
        lenient().when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        OrgMember member = OrgMember.builder()
                .id(new OrgMemberId(ORG_ID, userId)).role("STUDENT").status("ACTIVE").build();
        when(orgMemberRepository.findByIdOrgIdAndIdUserId(ORG_ID, userId))
                .thenReturn(Optional.of(member));
    }

    /**
     * An existing user whose membership was REVOKED. The import loop's pre-check sees a member row
     * and skips its seat gate; {@code upsertMember} sees a non-ACTIVE row, classifies the upsert as
     * seat-adding, and throws at the cap. This is the divergence that poisons the transaction.
     */
    private void stubRevokedMember(Long userId, String email) {
        User user = User.builder()
                .id(userId).email(email).displayName("U" + userId)
                .role(User.Role.STUDENT).passwordHash("hashed").build();
        when(userRepository.findByEmailIgnoreCase(email)).thenReturn(Optional.of(user));
        lenient().when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        OrgMember member = OrgMember.builder()
                .id(new OrgMemberId(ORG_ID, userId)).role("STUDENT").status("REVOKED").build();
        when(orgMemberRepository.findByIdOrgIdAndIdUserId(ORG_ID, userId))
                .thenReturn(Optional.of(member));
    }

    // ------------------------------------------------------------------ the regression

    @Test
    @DisplayName("a row whose upsertMember throws is reported in errors[] — the import still commits")
    void importStudents_rowFailure_doesNotPoisonTheSharedTransaction() {
        stubOrgAtSeatCap();
        stubActiveMember(1L, "alice@school.edu");
        stubRevokedMember(2L, "bob@school.edu");
        stubActiveMember(3L, "carol@school.edu");

        String csv = """
                alice@school.edu,Alice
                bob@school.edu,Bob
                carol@school.edu,Carol""";

        RosterImportResultDto result = service.importStudents(ORG_ID, csv, null, ACTOR);

        assertThat(result.total()).isEqualTo(3);
        assertThat(result.failed()).as("only Bob's row fails").isEqualTo(1);
        assertThat(result.linked()).as("Alice and Carol are still imported").isEqualTo(2);
        assertThat(result.errors()).hasSize(1);
        assertThat(result.errors().get(0))
                .contains("Dòng 2")
                .contains("giới hạn chỗ ngồi");

        // The two good rows really were written, not silently rolled back.
        verify(userRepository).findById(1L);
        verify(userRepository).findById(3L);
    }

    @Test
    @DisplayName("a row failing on the LAST line still commits the earlier rows")
    void importStudents_failureOnLastRow_stillCommits() {
        stubOrgAtSeatCap();
        stubActiveMember(1L, "alice@school.edu");
        stubRevokedMember(2L, "bob@school.edu");

        String csv = """
                alice@school.edu,Alice
                bob@school.edu,Bob""";

        assertThatCode(() -> {
            RosterImportResultDto result = service.importStudents(ORG_ID, csv, null, ACTOR);
            assertThat(result.linked()).isEqualTo(1);
            assertThat(result.failed()).isEqualTo(1);
        }).doesNotThrowAnyException();
    }

    @Test
    @DisplayName("an all-good import commits normally through the proxy")
    void importStudents_allRowsValid_commits() {
        stubOrgAtSeatCap();
        stubActiveMember(1L, "alice@school.edu");
        stubActiveMember(3L, "carol@school.edu");

        String csv = """
                alice@school.edu,Alice
                carol@school.edu,Carol""";

        RosterImportResultDto result = service.importStudents(ORG_ID, csv, null, ACTOR);

        assertThat(result.linked()).isEqualTo(2);
        assertThat(result.failed()).isZero();
        assertThat(result.errors()).isEmpty();
        verify(entitlementService, times(2)).grantStudent(anyLong(), any());
        verify(assignmentBackfillService, never()).ensureAssignmentsForStudent(anyLong(), anyLong());
        verify(classStudentRepository, never()).save(any());
        verify(passwordEncoder, never()).encode(anyString());
    }
}
