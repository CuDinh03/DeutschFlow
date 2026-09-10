package com.deutschflow.organization.service;

import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.common.exception.ConflictException;
import com.deutschflow.common.exception.ForbiddenException;
import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.common.exception.PrivilegedActionBlockedException;
import com.deutschflow.common.audit.AuditActor;
import com.deutschflow.common.audit.AuditLogService;
import com.deutschflow.organization.dto.OrgMemberDto;
import com.deutschflow.organization.entity.OrgMember;
import com.deutschflow.organization.entity.Organization;
import com.deutschflow.organization.entity.OrgMemberId;
import com.deutschflow.organization.repository.OrgMemberRepository;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.RefreshTokenRepository;
import com.deutschflow.user.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.ResultSetExtractor;

import java.time.Instant;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.catchThrowable;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anySet;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("OrgMembershipService Unit Tests")
class OrgMembershipServiceTest {

    private static final Long ORG_ID = 10L;
    private static final Long OTHER_ORG = 20L;
    private static final Long USER_ID = 99L;
    private static final Long NEW_OWNER_ID = 77L;

    @Mock private OrgMemberRepository memberRepo;
    @Mock private UserRepository userRepository;
    @Mock private JdbcTemplate jdbcTemplate;
    @Mock private com.deutschflow.organization.repository.OrgAcademicApproverRepository academicApproverRepo;
    @Mock private com.deutschflow.teacher.repository.ClassStudentRepository classStudentRepository;

    @Mock private AuditLogService auditLogService;
    @Mock private com.deutschflow.organization.repository.OrganizationRepository organizationRepository;
    @Mock private OrgEntitlementService orgEntitlementService;
    @Mock private RefreshTokenRepository refreshTokenRepository;
    @Mock private OrgTeachingHandoverGuard teachingHandoverGuard;

    /** Người thao tác — mọi mutation thành viên nay ghi vết kèm danh tính này. */
    private static final AuditActor ACTOR = new AuditActor(2L, "owner@tt.vn", "OWNER");
    /** Các luồng tự-thao-tác (rời org, chuyển quyền) — actor CHÍNH là USER_ID. */
    private static final AuditActor ACTOR_SELF = new AuditActor(USER_ID, "self@tt.vn", "OWNER");
    private OrgMembershipService service;

    @BeforeEach
    void setUp() {
        service = new OrgMembershipService(memberRepo, academicApproverRepo, classStudentRepository,
                userRepository, jdbcTemplate,
                auditLogService, organizationRepository, orgEntitlementService, refreshTokenRepository,
                // Chốt lớp mồ côi (G-07): mock KHÔNG ném ⇒ mọi ca sẵn có giữ nguyên nghĩa
                // "không lớp nào mất người dạy". Ca chặn nằm ở OrgMembershipHandoverGuardTest.
                teachingHandoverGuard);
    }

    private User studentUser() {
        return User.builder().id(USER_ID).role(User.Role.STUDENT).build();
    }

    private User teacherUser(Long orgId) {
        User u = User.builder().id(USER_ID).role(User.Role.TEACHER).build();
        u.setOrgId(orgId);
        return u;
    }

    /** DEC-13: admin nền tảng — người mà không đường kết nạp nào được biến thành thành viên trung tâm. */
    private User adminUser() {
        return User.builder().id(USER_ID).role(User.Role.ADMIN)
                .email("admin@deutschflow.vn").displayName("Quản trị nền tảng").build();
    }

    private User userWith(Long id, User.Role role) {
        User u = User.builder().id(id).role(role).email("u" + id + "@trungtam.com").displayName("U" + id).build();
        u.setOrgId(ORG_ID);
        return u;
    }

    // ── ORG-1: centralized, race-safe seat-limit gate in upsertMember ──────────

    @Test
    @DisplayName("upsertMember: rejects a brand-new STUDENT when the org is at its seat limit")
    void upsertMember_newStudentAtSeatLimit_rejected() {
        when(memberRepo.findByIdOrgIdAndIdUserId(ORG_ID, USER_ID)).thenReturn(Optional.empty());
        when(jdbcTemplate.query(anyString(), any(ResultSetExtractor.class), eq(ORG_ID)))
                .thenReturn(5L); // seat_limit = 5 (locked read)
        when(memberRepo.countByIdOrgIdAndRoleAndStatus(ORG_ID, "STUDENT", "ACTIVE")).thenReturn(5L); // at limit

        assertThatThrownBy(() -> service.upsertMember(ORG_ID, USER_ID, "STUDENT"))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("giới hạn chỗ ngồi");

        verify(memberRepo, never()).save(any());
    }

    @Test
    @DisplayName("upsertMember: allows a new STUDENT when seat_limit is 0 (unlimited)")
    void upsertMember_unlimitedSeats_allowed() {
        when(memberRepo.findByIdOrgIdAndIdUserId(ORG_ID, USER_ID)).thenReturn(Optional.empty());
        when(jdbcTemplate.query(anyString(), any(ResultSetExtractor.class), eq(ORG_ID)))
                .thenReturn(0L); // 0 = unlimited → no count query, no block
        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(studentUser()));

        service.upsertMember(ORG_ID, USER_ID, "STUDENT");

        verify(memberRepo).save(any());
    }

    // ── R-M1/R-M3: bất biến 1-OWNER tại chokepoint upsertMember ───────────────────

    @Test
    @DisplayName("R-M1: upsertMember từ chối HẠ một OWNER đang hoạt động (nhận lời mời TEACHER cũ)")
    void upsertMember_demotingActiveOwner_rejected() {
        // Đường lạm dụng: một OWNER đang hoạt động bấm nhận một lời mời TEACHER cũ → upsert(TEACHER).
        when(memberRepo.existsByIdUserIdAndStatusAndIdOrgIdNot(USER_ID, "ACTIVE", ORG_ID)).thenReturn(false);
        when(memberRepo.findByIdOrgIdAndIdUserId(ORG_ID, USER_ID))
                .thenReturn(Optional.of(member("OWNER", "ACTIVE")));

        // R-M9: subtype mang event để GlobalExceptionHandler ghi vết lần thử sau rollback —
        // chokepoint này hứng cả đường nhận-lời-mời (không phải admin console).
        assertThatThrownBy(() -> service.upsertMember(ORG_ID, USER_ID, "TEACHER"))
                .isInstanceOf(com.deutschflow.common.exception.PrivilegedActionBlockedException.class)
                .hasMessageContaining("chủ sở hữu")
                .extracting("auditEvent").isEqualTo("org.owner_invariant.blocked");

        verify(memberRepo, never()).save(any());
        verify(userRepository, never()).save(any());
    }

    @Test
    @DisplayName("R-M3: upsertMember từ chối tạo OWNER thứ hai khi org đã có OWNER (dưới khóa FOR UPDATE)")
    void upsertMember_secondOwner_rejected() {
        when(memberRepo.existsByIdUserIdAndStatusAndIdOrgIdNot(USER_ID, "ACTIVE", ORG_ID)).thenReturn(false);
        when(memberRepo.findByIdOrgIdAndIdUserId(ORG_ID, USER_ID)).thenReturn(Optional.empty());
        when(memberRepo.countByIdOrgIdAndRoleAndStatus(ORG_ID, "OWNER", "ACTIVE")).thenReturn(1L); // đã có 1 OWNER

        assertThatThrownBy(() -> service.upsertMember(ORG_ID, USER_ID, "OWNER"))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("đã có chủ sở hữu");

        // Khóa dòng org PHẢI được lấy trước khi đếm — chống TOCTOU.
        verify(jdbcTemplate).query(anyString(), any(ResultSetExtractor.class), eq(ORG_ID));
        verify(memberRepo, never()).save(any());
    }

    @Test
    @DisplayName("R-M3: upsertMember CHO PHÉP tạo OWNER đầu tiên khi org có 0 OWNER (đường tạo org)")
    void upsertMember_firstOwner_allowed() {
        when(memberRepo.existsByIdUserIdAndStatusAndIdOrgIdNot(USER_ID, "ACTIVE", ORG_ID)).thenReturn(false);
        when(memberRepo.findByIdOrgIdAndIdUserId(ORG_ID, USER_ID)).thenReturn(Optional.empty());
        when(memberRepo.countByIdOrgIdAndRoleAndStatus(ORG_ID, "OWNER", "ACTIVE")).thenReturn(0L); // chưa có OWNER
        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(userWith(USER_ID, User.Role.OWNER)));

        service.upsertMember(ORG_ID, USER_ID, "OWNER");

        ArgumentCaptor<OrgMember> saved = ArgumentCaptor.forClass(OrgMember.class);
        verify(memberRepo).save(saved.capture());
        assertThat(saved.getValue().getRole()).isEqualTo("OWNER");
    }

    private OrgMember member(String role, String status) {
        return member(USER_ID, role, status);
    }

    private OrgMember member(Long userId, String role, String status) {
        OrgMember m = new OrgMember();
        m.setId(new OrgMemberId(ORG_ID, userId));
        m.setRole(role);
        m.setStatus(status);
        return m;
    }

    // ----------------------------------------------------------------- upsertMember

    @Test
    @DisplayName("upsertMember inserts ACTIVE membership and syncs the platform role to MANAGER")
    void upsertMember_newManager_promotesGlobalRole() {
        when(memberRepo.existsByIdUserIdAndStatusAndIdOrgIdNot(USER_ID, "ACTIVE", ORG_ID)).thenReturn(false);
        when(memberRepo.findByIdOrgIdAndIdUserId(ORG_ID, USER_ID)).thenReturn(Optional.empty());
        User user = studentUser();
        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(user));

        service.upsertMember(ORG_ID, USER_ID, "MANAGER");

        ArgumentCaptor<OrgMember> saved = ArgumentCaptor.forClass(OrgMember.class);
        verify(memberRepo).save(saved.capture());
        assertThat(saved.getValue().getStatus()).isEqualTo("ACTIVE");
        assertThat(saved.getValue().getRole()).isEqualTo("MANAGER");
        assertThat(user.getOrgId()).isEqualTo(ORG_ID);
        assertThat(user.getRole()).isEqualTo(User.Role.MANAGER);
    }

    @Test
    @DisplayName("upsertMember reactivates a previously-LEFT membership and clears left_at")
    void upsertMember_reactivates_clearsLeftAt() {
        OrgMember existing = member("TEACHER", "LEFT");
        existing.setLeftAt(Instant.now());
        when(memberRepo.existsByIdUserIdAndStatusAndIdOrgIdNot(USER_ID, "ACTIVE", ORG_ID)).thenReturn(false);
        when(memberRepo.findByIdOrgIdAndIdUserId(ORG_ID, USER_ID)).thenReturn(Optional.of(existing));
        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(studentUser()));

        service.upsertMember(ORG_ID, USER_ID, "TEACHER");

        assertThat(existing.getStatus()).isEqualTo("ACTIVE");
        assertThat(existing.getLeftAt()).isNull();
    }

    @Test
    @DisplayName("upsertMember rejects a staff role when the user is ACTIVE in another org (1-ACTIVE)")
    void upsertMember_staffActiveElsewhere_throwsConflict() {
        when(memberRepo.existsByIdUserIdAndStatusAndIdOrgIdNot(USER_ID, "ACTIVE", ORG_ID)).thenReturn(true);

        assertThatThrownBy(() -> service.upsertMember(ORG_ID, USER_ID, "TEACHER"))
                .isInstanceOf(ConflictException.class);

        verify(memberRepo, never()).save(any());
    }

    // ── F4 (owner chốt 10/09/2026): "1 người – 1 trung tâm ACTIVE" áp cho CẢ STUDENT ──
    //
    // Trước F4, STUDENT giữ "move-semantics": trung tâm B nhập CSV là lặng lẽ kéo học viên đang học ở
    // A sang B — A mất học viên khỏi danh sách mà không ai ở A được báo, và hồ sơ giám hộ/đồng ý do A
    // thu bỗng nằm dưới quyền đọc của B. Ca cũ "does NOT block a STUDENT" bị lật lại ở đây.

    @Test
    @DisplayName("F4 upsertMember: STUDENT đang ACTIVE ở trung tâm khác → ConflictException NÊU TÊN trung tâm đó, không ghi gì")
    void upsertMember_studentActiveElsewhere_blockedNamingOtherOrg() {
        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(studentUser()));
        when(memberRepo.existsByIdUserIdAndStatusAndIdOrgIdNot(USER_ID, "ACTIVE", ORG_ID)).thenReturn(true);
        OrgMember elsewhere = OrgMember.builder()
                .id(new OrgMemberId(77L, USER_ID)).role("STUDENT").status("ACTIVE").build();
        when(memberRepo.findFirstByIdUserIdAndStatusAndIdOrgIdNot(USER_ID, "ACTIVE", ORG_ID))
                .thenReturn(Optional.of(elsewhere));
        when(organizationRepository.findById(77L)).thenReturn(Optional.of(
                com.deutschflow.organization.entity.Organization.builder().id(77L).name("Trung tâm Alpha").build()));

        assertThatThrownBy(() -> service.upsertMember(ORG_ID, USER_ID, "STUDENT"))
                .isInstanceOf(ConflictException.class)
                .hasMessageContaining("Trung tâm Alpha");

        verify(memberRepo, never()).save(any());
        verify(userRepository, never()).save(any());
    }

    @Test
    @DisplayName("F4 upsertMember: không tra được tên trung tâm kia → vẫn chặn, câu chung \"một tổ chức khác\"")
    void upsertMember_studentActiveElsewhere_unknownOrgName_stillBlocked() {
        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(studentUser()));
        when(memberRepo.existsByIdUserIdAndStatusAndIdOrgIdNot(USER_ID, "ACTIVE", ORG_ID)).thenReturn(true);

        assertThatThrownBy(() -> service.upsertMember(ORG_ID, USER_ID, "STUDENT"))
                .isInstanceOf(ConflictException.class)
                .hasMessageContaining("tổ chức khác");
        verify(memberRepo, never()).save(any());
    }

    @Test
    @DisplayName("F4 hồi quy: STUDENT không ACTIVE ở đâu khác vẫn nhận ghế như trước")
    void upsertMember_studentNotActiveElsewhere_allowed() {
        when(memberRepo.findByIdOrgIdAndIdUserId(ORG_ID, USER_ID)).thenReturn(Optional.empty());
        when(memberRepo.existsByIdUserIdAndStatusAndIdOrgIdNot(USER_ID, "ACTIVE", ORG_ID)).thenReturn(false);
        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(studentUser()));

        service.upsertMember(ORG_ID, USER_ID, "STUDENT");

        verify(memberRepo).save(any());
    }

    @Test
    @DisplayName("F4 activeMembershipElsewhere: trả org/tên/vai của trung tâm kia; không có thì empty")
    void activeMembershipElsewhere_resolvesOrgName() {
        OrgMember elsewhere = OrgMember.builder()
                .id(new OrgMemberId(77L, USER_ID)).role("STUDENT").status("ACTIVE").build();
        when(memberRepo.findFirstByIdUserIdAndStatusAndIdOrgIdNot(USER_ID, "ACTIVE", ORG_ID))
                .thenReturn(Optional.of(elsewhere));
        when(organizationRepository.findById(77L)).thenReturn(Optional.of(
                com.deutschflow.organization.entity.Organization.builder().id(77L).name("Trung tâm Alpha").build()));

        assertThat(service.activeMembershipElsewhere(USER_ID, ORG_ID))
                .contains(new OrgMembershipService.ActiveElsewhere(77L, "Trung tâm Alpha", "STUDENT"));

        when(memberRepo.findFirstByIdUserIdAndStatusAndIdOrgIdNot(USER_ID, "ACTIVE", 77L))
                .thenReturn(Optional.empty());
        assertThat(service.activeMembershipElsewhere(USER_ID, 77L)).isEmpty();
    }

    // ── DEC-13 (owner chốt 09/09/2026): admin nền tảng KHÔNG BAO GIỜ là thành viên trung tâm ──
    //
    // Một dòng org_members là TOÀN BỘ điều kiện vào 9 controller /api/org/**, còn syncPlatformRole
    // cố ý giữ users.role = ADMIN — nên một admin lọt vào org_members vừa giữ trọn /api/admin/**,
    // vừa đi qua assertOrgAdmin như người của trung tâm, và mọi lượt AI của họ trừ vào pool token
    // của trung tâm. upsertMember là chokepoint DUY NHẤT ghi org_members + users.org_id, nên ca
    // dưới đây khoá chặn ở đúng đó.

    @Test
    @DisplayName("DEC-13 upsertMember: user role ADMIN → chặn kèm đủ chất liệu ghi vết, không ghi dòng nào")
    void upsertMember_platformAdmin_blockedWithAudit() {
        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(adminUser()));

        Throwable thrown = catchThrowable(() -> service.upsertMember(ORG_ID, USER_ID, "TEACHER"));

        assertThat(thrown)
                .isInstanceOf(PrivilegedActionBlockedException.class)
                // vẫn là BadRequestException → client nhận 400 như cũ, handler cũ không đổi hành vi
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("Quản trị viên nền tảng");
        PrivilegedActionBlockedException blocked = (PrivilegedActionBlockedException) thrown;
        assertThat(blocked.getAuditEvent()).isEqualTo("org.admin_membership.blocked");
        // target_type = ORG: tra sổ theo trung tâm mới thấy được lần thử kết nạp này.
        assertThat(blocked.getTargetType()).isEqualTo("ORG");
        assertThat(blocked.getTargetId()).isEqualTo(String.valueOf(ORG_ID));
        assertThat(blocked.getAuditMeta())
                .containsEntry("reason", "platform_admin")
                .containsEntry("targetUserId", USER_ID)
                .containsEntry("requestedRole", "TEACHER");

        // Không dòng org_members, không đụng users.org_id.
        verify(memberRepo, never()).save(any());
        verify(userRepository, never()).save(any());
        // Guard nằm NGAY ĐẦU hàm: hai guard cũ (1 staff–1 org, nạp membership) chưa kịp chạy.
        verify(memberRepo, never()).existsByIdUserIdAndStatusAndIdOrgIdNot(any(), any(), any());
        verify(memberRepo, never()).findByIdOrgIdAndIdUserId(any(), any());
    }

    @Test
    @DisplayName("DEC-13 upsertMember: chặn admin BẤT KỂ vai xin là gì — kể cả STUDENT (không lách bằng vai nhẹ)")
    void upsertMember_platformAdminAsStudent_blocked() {
        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(adminUser()));

        Throwable thrown = catchThrowable(() -> service.upsertMember(ORG_ID, USER_ID, "STUDENT"));

        assertThat(thrown).isInstanceOf(PrivilegedActionBlockedException.class);
        assertThat(((PrivilegedActionBlockedException) thrown).getAuditMeta())
                .containsEntry("requestedRole", "STUDENT");
        verify(memberRepo, never()).save(any());
        verify(userRepository, never()).save(any());
    }

    @Test
    @DisplayName("DEC-13 hồi quy: TEACHER thường vẫn vào được — guard không chặn nhầm nhân sự bình thường")
    void upsertMember_normalTeacher_notBlockedByAdminGuard() {
        User user = studentUser();
        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(user));
        when(memberRepo.existsByIdUserIdAndStatusAndIdOrgIdNot(USER_ID, "ACTIVE", ORG_ID)).thenReturn(false);
        when(memberRepo.findByIdOrgIdAndIdUserId(ORG_ID, USER_ID)).thenReturn(Optional.empty());

        service.upsertMember(ORG_ID, USER_ID, "TEACHER");

        ArgumentCaptor<OrgMember> saved = ArgumentCaptor.forClass(OrgMember.class);
        verify(memberRepo).save(saved.capture());
        assertThat(saved.getValue().getRole()).isEqualTo("TEACHER");
        assertThat(saved.getValue().getStatus()).isEqualTo("ACTIVE");
        assertThat(user.getOrgId()).isEqualTo(ORG_ID);
        assertThat(user.getRole()).isEqualTo(User.Role.TEACHER);
        verify(userRepository).save(user);
    }

    @Test
    @DisplayName("DEC-13 hồi quy: STUDENT thường vẫn nhận được ghế — guard không chặn nhầm học viên")
    void upsertMember_normalStudent_notBlockedByAdminGuard() {
        User user = studentUser();
        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(user));
        when(memberRepo.findByIdOrgIdAndIdUserId(ORG_ID, USER_ID)).thenReturn(Optional.empty());

        service.upsertMember(ORG_ID, USER_ID, "STUDENT");

        ArgumentCaptor<OrgMember> saved = ArgumentCaptor.forClass(OrgMember.class);
        verify(memberRepo).save(saved.capture());
        assertThat(saved.getValue().getRole()).isEqualTo("STUDENT");
        assertThat(user.getOrgId()).isEqualTo(ORG_ID);
        assertThat(user.getRole()).isEqualTo(User.Role.STUDENT);
    }

    @Test
    @DisplayName("DEC-13: đường thuận nạp user ĐÚNG MỘT lượt — guard dùng lại biến, không thêm truy vấn thứ hai")
    void upsertMember_happyPath_loadsUserExactlyOnce() {
        // Chốt số lượt: guard DEC-13 nạp user ở đầu hàm, đoạn cuối DÙNG LẠI chính biến đó. Nếu một
        // lần refactor sau đổi thành findById(...).orElseThrow() lần nữa, mỗi lượt thêm thành viên
        // (import CSV = mỗi dòng một lượt) sẽ âm thầm gấp đôi truy vấn — ca này đỏ ngay.
        User user = studentUser();
        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(user));
        when(memberRepo.findByIdOrgIdAndIdUserId(ORG_ID, USER_ID)).thenReturn(Optional.empty());

        service.upsertMember(ORG_ID, USER_ID, "STUDENT");

        verify(userRepository, times(1)).findById(USER_ID);
        verify(userRepository).save(user);
    }

    // ----------------------------------------------------------------- ensureStudentSeat (vào TT qua lớp)

    @Test
    @DisplayName("ensureStudentSeat: non-member is upserted as an ACTIVE STUDENT (gets a seat)")
    void ensureStudentSeat_nonMember_upsertsStudent() {
        when(memberRepo.findByIdOrgIdAndIdUserId(ORG_ID, USER_ID)).thenReturn(Optional.empty());
        when(memberRepo.existsByIdUserIdAndStatusAndIdOrgIdNot(USER_ID, "ACTIVE", ORG_ID)).thenReturn(false);
        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(studentUser()));

        service.ensureStudentSeat(ORG_ID, USER_ID);

        ArgumentCaptor<OrgMember> saved = ArgumentCaptor.forClass(OrgMember.class);
        verify(memberRepo).save(saved.capture());
        assertThat(saved.getValue().getRole()).isEqualTo("STUDENT");
        assertThat(saved.getValue().getStatus()).isEqualTo("ACTIVE");
    }

    @Test
    @DisplayName("ensureStudentSeat: an ACTIVE member of this org (any role) is a no-op — staff is not demoted")
    void ensureStudentSeat_activeStaffSameOrg_noop() {
        when(memberRepo.findByIdOrgIdAndIdUserId(ORG_ID, USER_ID))
                .thenReturn(Optional.of(member("TEACHER", "ACTIVE")));

        service.ensureStudentSeat(ORG_ID, USER_ID);

        verify(memberRepo, never()).save(any());
    }

    @Test
    @DisplayName("ensureStudentSeat: rejects a user ACTIVE in another org — no silent re-homing via class code")
    void ensureStudentSeat_activeElsewhere_throwsBadRequest() {
        when(memberRepo.findByIdOrgIdAndIdUserId(ORG_ID, USER_ID)).thenReturn(Optional.empty());
        when(memberRepo.existsByIdUserIdAndStatusAndIdOrgIdNot(USER_ID, "ACTIVE", ORG_ID)).thenReturn(true);

        assertThatThrownBy(() -> service.ensureStudentSeat(ORG_ID, USER_ID))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("trung tâm khác");

        verify(memberRepo, never()).save(any());
    }

    @Test
    @DisplayName("ensureStudentSeat: a LEFT/REVOKED member is reactivated through upsertMember (seat gate applies)")
    void ensureStudentSeat_formerMember_reactivatedViaUpsert() {
        OrgMember former = member("STUDENT", "LEFT");
        former.setLeftAt(Instant.now());
        when(memberRepo.findByIdOrgIdAndIdUserId(ORG_ID, USER_ID)).thenReturn(Optional.of(former));
        when(memberRepo.existsByIdUserIdAndStatusAndIdOrgIdNot(USER_ID, "ACTIVE", ORG_ID)).thenReturn(false);
        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(studentUser()));

        service.ensureStudentSeat(ORG_ID, USER_ID);

        assertThat(former.getStatus()).isEqualTo("ACTIVE");
        assertThat(former.getLeftAt()).isNull();
        verify(memberRepo).save(former);
    }

    @Test
    @DisplayName("DEC-13 ensureStudentSeat: giáo viên bấm Duyệt cho tài khoản ADMIN → chặn, không ai vào trung tâm")
    void ensureStudentSeat_platformAdmin_blocked() {
        // Đường kết nạp dễ sót nhất: không qua console admin, không qua CSV, không qua lời mời —
        // một giáo viên bất kỳ duyệt yêu cầu vào lớp là đủ. Chặn ngay ở đây (không đợi upsertMember)
        // để câu thông báo nói được cho giáo viên biết chuyện gì xảy ra.
        when(memberRepo.findByIdOrgIdAndIdUserId(ORG_ID, USER_ID)).thenReturn(Optional.empty());
        when(memberRepo.existsByIdUserIdAndStatusAndIdOrgIdNot(USER_ID, "ACTIVE", ORG_ID)).thenReturn(false);
        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(adminUser()));

        Throwable thrown = catchThrowable(() -> service.ensureStudentSeat(ORG_ID, USER_ID));

        assertThat(thrown)
                .isInstanceOf(PrivilegedActionBlockedException.class)
                .hasMessageContaining("quản trị viên nền tảng");
        PrivilegedActionBlockedException blocked = (PrivilegedActionBlockedException) thrown;
        assertThat(blocked.getAuditEvent()).isEqualTo("org.admin_membership.blocked");
        assertThat(blocked.getTargetType()).isEqualTo("ORG");
        assertThat(blocked.getTargetId()).isEqualTo(String.valueOf(ORG_ID));
        assertThat(blocked.getAuditMeta())
                .containsEntry("reason", "platform_admin_join_class")
                .containsEntry("targetUserId", USER_ID);

        // upsertMember không tạo dòng nào, và không cấp gói của trung tâm cho admin.
        verify(memberRepo, never()).save(any());
        verify(userRepository, never()).save(any());
        verify(orgEntitlementService, never()).grantStudent(any(), any());
    }

    // ----------------------------------------------------------------- V-05: vào TT qua lớp phải ĐƯỢC CẤP GÓI

    @Test
    @DisplayName("V-05 ensureStudentSeat: cấp gói của trung tâm cho học viên vừa nhận ghế (như đường import/thêm tay)")
    void ensureStudentSeat_nonMember_grantsOrgPlan() {
        Organization org = Organization.builder().id(ORG_ID).planCode("PRO").build();
        when(memberRepo.findByIdOrgIdAndIdUserId(ORG_ID, USER_ID)).thenReturn(Optional.empty());
        when(memberRepo.existsByIdUserIdAndStatusAndIdOrgIdNot(USER_ID, "ACTIVE", ORG_ID)).thenReturn(false);
        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(studentUser()));
        when(organizationRepository.findById(ORG_ID)).thenReturn(Optional.of(org));

        service.ensureStudentSeat(ORG_ID, USER_ID);

        verify(orgEntitlementService).grantStudent(USER_ID, org);
    }

    @Test
    @DisplayName("V-05 ensureStudentSeat: thành viên ACTIVE sẵn → KHÔNG cấp gói lần hai")
    void ensureStudentSeat_activeMember_doesNotGrantTwice() {
        when(memberRepo.findByIdOrgIdAndIdUserId(ORG_ID, USER_ID))
                .thenReturn(Optional.of(member("STUDENT", "ACTIVE")));

        service.ensureStudentSeat(ORG_ID, USER_ID);

        verify(orgEntitlementService, never()).grantStudent(any(), any());
    }

    @Test
    @DisplayName("V-05 ensureStudentSeat: hết ghế → seat-gate ném lỗi TRƯỚC, không cấp gói")
    void ensureStudentSeat_seatLimitReached_noGrant() {
        when(memberRepo.findByIdOrgIdAndIdUserId(ORG_ID, USER_ID)).thenReturn(Optional.empty());
        when(memberRepo.existsByIdUserIdAndStatusAndIdOrgIdNot(USER_ID, "ACTIVE", ORG_ID)).thenReturn(false);
        when(jdbcTemplate.query(anyString(), any(ResultSetExtractor.class), eq(ORG_ID))).thenReturn(3L);
        when(memberRepo.countByIdOrgIdAndRoleAndStatus(ORG_ID, "STUDENT", "ACTIVE")).thenReturn(3L);

        assertThatThrownBy(() -> service.ensureStudentSeat(ORG_ID, USER_ID))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("giới hạn chỗ ngồi");

        verify(orgEntitlementService, never()).grantStudent(any(), any());
    }

    // ----------------------------------------------------------------- removeMember (admin revoke)

    @Test
    @DisplayName("removeMember marks REVOKED + stamps left_at and detaches the user")
    void removeMember_revokesAndDetaches() {
        OrgMember active = member("TEACHER", "ACTIVE");
        when(memberRepo.findByIdOrgIdAndIdUserId(ORG_ID, USER_ID)).thenReturn(Optional.of(active));
        User user = teacherUser(ORG_ID);
        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(user));
        when(memberRepo.existsByIdUserIdAndRoleInAndStatus(eq(USER_ID), anySet(), eq("ACTIVE"))).thenReturn(false);

        service.removeMember(ORG_ID, USER_ID, ACTOR);

        assertThat(active.getStatus()).isEqualTo("REVOKED");
        assertThat(active.getLeftAt()).isNotNull();
        assertThat(user.getOrgId()).isNull();
        assertThat(user.getRole()).isEqualTo(User.Role.STUDENT);
    }

    @Test
    @DisplayName("removeMember refuses to revoke the OWNER (a MANAGER-authorized caller cannot seize control; last-owner protected)")
    void removeMember_ownerTarget_throwsBadRequest() {
        // C-2/H-5: DELETE /api/org/members/{id} is gated by assertOrgAdmin = {OWNER, MANAGER}, so a
        // MANAGER reaches removeMember. The service must still refuse when the target is the OWNER —
        // otherwise the MANAGER revokes the OWNER and seizes the org. This also guards the last-owner
        // invariant (ownership only moves via transferOwnership).
        when(memberRepo.findByIdOrgIdAndIdUserId(ORG_ID, USER_ID))
                .thenReturn(Optional.of(member("OWNER", "ACTIVE")));

        assertThatThrownBy(() -> service.removeMember(ORG_ID, USER_ID, ACTOR))
                .isInstanceOf(BadRequestException.class);

        verify(memberRepo, never()).save(any());
        verify(userRepository, never()).save(any());
    }

    // ----------------------------------------------------------------- V-14: chỉ OWNER mới gỡ được MANAGER

    @Test
    @DisplayName("V-14 removeMember: MANAGER KHÔNG gỡ được MANAGER khác → 403, không ghi gì")
    void removeMember_managerTarget_managerActor_throwsForbidden() {
        AuditActor managerActor = new AuditActor(2L, "manager@tt.vn", "MANAGER");
        when(memberRepo.findByIdOrgIdAndIdUserId(ORG_ID, USER_ID))
                .thenReturn(Optional.of(member("MANAGER", "ACTIVE")));
        when(memberRepo.findByIdOrgIdAndIdUserId(ORG_ID, 2L))
                .thenReturn(Optional.of(member(2L, "MANAGER", "ACTIVE")));

        assertThatThrownBy(() -> service.removeMember(ORG_ID, USER_ID, managerActor))
                .isInstanceOf(ForbiddenException.class)
                .hasMessageContaining("Chỉ chủ sở hữu");

        verify(memberRepo, never()).save(any());
        verify(userRepository, never()).save(any());
    }

    @Test
    @DisplayName("V-14 removeMember: OWNER VẪN gỡ được MANAGER (không chặn nhầm đường chính đáng)")
    void removeMember_managerTarget_ownerActor_allowed() {
        OrgMember target = member("MANAGER", "ACTIVE");
        when(memberRepo.findByIdOrgIdAndIdUserId(ORG_ID, USER_ID)).thenReturn(Optional.of(target));
        when(memberRepo.findByIdOrgIdAndIdUserId(ORG_ID, 2L))
                .thenReturn(Optional.of(member(2L, "OWNER", "ACTIVE")));
        User user = userWith(USER_ID, User.Role.MANAGER);
        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(user));
        when(memberRepo.existsByIdUserIdAndRoleInAndStatus(eq(USER_ID), anySet(), eq("ACTIVE"))).thenReturn(false);

        service.removeMember(ORG_ID, USER_ID, ACTOR);

        assertThat(target.getStatus()).isEqualTo("REVOKED");
        assertThat(user.getOrgId()).isNull();
    }

    @Test
    @DisplayName("V-14 removeMember: TEACHER vẫn do org-admin (MANAGER) gỡ được — luật mới chỉ chạm MANAGER")
    void removeMember_teacherTarget_managerActor_stillAllowed() {
        AuditActor managerActor = new AuditActor(2L, "manager@tt.vn", "MANAGER");
        OrgMember target = member("TEACHER", "ACTIVE");
        when(memberRepo.findByIdOrgIdAndIdUserId(ORG_ID, USER_ID)).thenReturn(Optional.of(target));
        User user = teacherUser(ORG_ID);
        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(user));
        when(memberRepo.existsByIdUserIdAndRoleInAndStatus(eq(USER_ID), anySet(), eq("ACTIVE"))).thenReturn(false);

        service.removeMember(ORG_ID, USER_ID, managerActor);

        assertThat(target.getStatus()).isEqualTo("REVOKED");
    }

    // ----------------------------------------------------------------- selfLeave

    @Test
    @DisplayName("selfLeave marks LEFT + stamps left_at and detaches the user")
    void selfLeave_teacher_leavesAndDetaches() {
        OrgMember active = member("TEACHER", "ACTIVE");
        when(memberRepo.findByIdOrgIdAndIdUserId(ORG_ID, USER_ID)).thenReturn(Optional.of(active));
        User user = teacherUser(ORG_ID);
        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(user));
        when(memberRepo.existsByIdUserIdAndRoleInAndStatus(eq(USER_ID), anySet(), eq("ACTIVE"))).thenReturn(false);

        service.selfLeave(ORG_ID, ACTOR_SELF);

        assertThat(active.getStatus()).isEqualTo("LEFT");
        assertThat(active.getLeftAt()).isNotNull();
        assertThat(user.getOrgId()).isNull();
        // Portability (B2B model §2.2): rời TT chỉ đóng membership — account KHÔNG bị xoá → giáo viên tự do.
        verify(userRepository, never()).delete(any());
    }

    // ── G-03: rời trung tâm phải CẮT quyền vào lớp và quyền duyệt học vụ ──────

    @Test
    @DisplayName("G-03 selfLeave: đóng mọi ghi danh lớp CỦA CHÍNH trung tâm ấy (không đụng lớp B2C)")
    void selfLeave_endsClassEnrollmentsInThatOrg() {
        OrgMember active = member("STUDENT", "ACTIVE");
        when(memberRepo.findByIdOrgIdAndIdUserId(ORG_ID, USER_ID)).thenReturn(Optional.of(active));
        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(studentUser()));

        service.selfLeave(ORG_ID, ACTOR_SELF);

        verify(classStudentRepository).endEnrollmentsInOrg(eq(ORG_ID), eq(USER_ID), any(),
                eq(com.deutschflow.teacher.entity.ClassStudent.END_REASON_LEFT_ORG));
    }

    @Test
    @DisplayName("G-03 selfLeave: thu hồi phân công duyệt học vụ — nợ ghi ở PR #617, hai đường ra nay như nhau")
    void selfLeave_revokesAcademicApprovers() {
        OrgMember active = member("TEACHER", "ACTIVE");
        when(memberRepo.findByIdOrgIdAndIdUserId(ORG_ID, USER_ID)).thenReturn(Optional.of(active));
        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(teacherUser(ORG_ID)));
        when(memberRepo.existsByIdUserIdAndRoleInAndStatus(eq(USER_ID), anySet(), eq("ACTIVE"))).thenReturn(false);

        service.selfLeave(ORG_ID, ACTOR_SELF);

        verify(academicApproverRepo).revokeAllActiveFor(eq(ORG_ID), eq(USER_ID), any(), eq(null));
    }

    @Test
    @DisplayName("G-03 removeMember: đường admin cũng đóng ghi danh lớp, không chỉ membership")
    void removeMember_endsClassEnrollmentsInThatOrg() {
        OrgMember active = member("STUDENT", "ACTIVE");
        when(memberRepo.findByIdOrgIdAndIdUserId(ORG_ID, USER_ID)).thenReturn(Optional.of(active));
        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(studentUser()));

        service.removeMember(ORG_ID, USER_ID, ACTOR);

        verify(classStudentRepository).endEnrollmentsInOrg(eq(ORG_ID), eq(USER_ID), any(),
                eq(com.deutschflow.teacher.entity.ClassStudent.END_REASON_LEFT_ORG));
        verify(academicApproverRepo).revokeAllActiveFor(eq(ORG_ID), eq(USER_ID), any(), eq(null));
    }

    @Test
    @DisplayName("G-03: selfLeave bị từ chối (OWNER) thì KHÔNG cắt gì cả")
    void selfLeave_refused_touchesNothing() {
        when(memberRepo.findByIdOrgIdAndIdUserId(ORG_ID, USER_ID))
                .thenReturn(Optional.of(member("OWNER", "ACTIVE")));

        assertThatThrownBy(() -> service.selfLeave(ORG_ID, ACTOR_SELF))
                .isInstanceOf(BadRequestException.class);

        verify(classStudentRepository, never()).endEnrollmentsInOrg(any(), any(), any(), anyString());
        verify(academicApproverRepo, never()).revokeAllActiveFor(any(), any(), any(), any());
    }

    @Test
    @DisplayName("selfLeave throws BadRequest for OWNER (must transfer ownership first)")
    void selfLeave_owner_throwsBadRequest() {
        when(memberRepo.findByIdOrgIdAndIdUserId(ORG_ID, USER_ID))
                .thenReturn(Optional.of(member("OWNER", "ACTIVE")));

        assertThatThrownBy(() -> service.selfLeave(ORG_ID, ACTOR_SELF))
                .isInstanceOf(BadRequestException.class);

        verify(userRepository, never()).save(any());
    }

    @Test
    @DisplayName("selfLeave throws Forbidden when the caller is not an ACTIVE member")
    void selfLeave_nonMember_throwsForbidden() {
        when(memberRepo.findByIdOrgIdAndIdUserId(ORG_ID, USER_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.selfLeave(ORG_ID, ACTOR_SELF))
                .isInstanceOf(ForbiddenException.class);
    }

    @Test
    @DisplayName("countByRole delegates to the ACTIVE count query")
    void countByRole_delegates() {
        when(memberRepo.countByIdOrgIdAndRoleAndStatus(ORG_ID, "STUDENT", "ACTIVE")).thenReturn(7L);

        assertThat(service.countByRole(ORG_ID, "STUDENT")).isEqualTo(7L);
    }

    // ----------------------------------------------------------------- changeRole

    @Test
    @DisplayName("changeRole promotes a TEACHER to MANAGER and returns the updated member")
    void changeRole_teacherToManager_updates() {
        OrgMember m = member("TEACHER", "ACTIVE");
        when(memberRepo.findByIdOrgIdAndIdUserId(ORG_ID, USER_ID)).thenReturn(Optional.of(m));
        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(teacherUser(ORG_ID)));

        OrgMemberDto dto = service.changeRole(ORG_ID, USER_ID, "manager", ACTOR);

        assertThat(m.getRole()).isEqualTo("MANAGER");
        assertThat(dto.role()).isEqualTo("MANAGER");
    }

    @Test
    @DisplayName("changeRole rejects a non-staff target role")
    void changeRole_invalidRole_throwsBadRequest() {
        assertThatThrownBy(() -> service.changeRole(ORG_ID, USER_ID, "STUDENT", ACTOR))
                .isInstanceOf(BadRequestException.class);
        verify(memberRepo, never()).save(any());
    }

    @Test
    @DisplayName("changeRole refuses to reassign the OWNER")
    void changeRole_ownerTarget_throwsBadRequest() {
        when(memberRepo.findByIdOrgIdAndIdUserId(ORG_ID, USER_ID))
                .thenReturn(Optional.of(member("OWNER", "ACTIVE")));

        assertThatThrownBy(() -> service.changeRole(ORG_ID, USER_ID, "MANAGER", ACTOR))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    @DisplayName("changeRole refuses to convert a STUDENT member via this path")
    void changeRole_studentMember_throwsBadRequest() {
        when(memberRepo.findByIdOrgIdAndIdUserId(ORG_ID, USER_ID))
                .thenReturn(Optional.of(member("STUDENT", "ACTIVE")));

        assertThatThrownBy(() -> service.changeRole(ORG_ID, USER_ID, "TEACHER", ACTOR))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    @DisplayName("changeRole 404s when the member is missing/inactive")
    void changeRole_missing_throwsNotFound() {
        when(memberRepo.findByIdOrgIdAndIdUserId(ORG_ID, USER_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.changeRole(ORG_ID, USER_ID, "MANAGER", ACTOR))
                .isInstanceOf(NotFoundException.class);
    }

    @Test
    @DisplayName("removeMember 404s when the member does not exist (no silent no-op)")
    void removeMember_missing_throwsNotFound() {
        when(memberRepo.findByIdOrgIdAndIdUserId(ORG_ID, USER_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.removeMember(ORG_ID, USER_ID, ACTOR))
                .isInstanceOf(NotFoundException.class);
        verify(memberRepo, never()).save(any());
    }

    // ----------------------------------------------------------------- transferOwnership (C-2 recovery path)

    @Test
    @DisplayName("transferOwnership promotes the target to OWNER and demotes the current owner to MANAGER")
    void transferOwnership_promotesTargetDemotesOwner() {
        OrgMember currentOwner = member(USER_ID, "OWNER", "ACTIVE");
        OrgMember target = member(NEW_OWNER_ID, "MANAGER", "ACTIVE");
        when(memberRepo.findByIdOrgIdAndIdUserId(ORG_ID, USER_ID)).thenReturn(Optional.of(currentOwner));
        when(memberRepo.findByIdOrgIdAndIdUserId(ORG_ID, NEW_OWNER_ID)).thenReturn(Optional.of(target));
        User ownerUser = userWith(USER_ID, User.Role.OWNER);
        User targetUser = userWith(NEW_OWNER_ID, User.Role.MANAGER);
        when(userRepository.findById(NEW_OWNER_ID)).thenReturn(Optional.of(targetUser));
        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(ownerUser));

        OrgMemberDto dto = service.transferOwnership(ORG_ID, ACTOR_SELF, NEW_OWNER_ID);

        // Ownership seat moved: exactly one OWNER (the target), old owner is now MANAGER — never zero.
        assertThat(target.getRole()).isEqualTo("OWNER");
        assertThat(currentOwner.getRole()).isEqualTo("MANAGER");
        assertThat(targetUser.getRole()).isEqualTo(User.Role.OWNER);
        assertThat(ownerUser.getRole()).isEqualTo(User.Role.MANAGER);
        assertThat(dto.userId()).isEqualTo(NEW_OWNER_ID);
        assertThat(dto.role()).isEqualTo("OWNER");
    }

    @Test
    @DisplayName("transferOwnership can promote an ACTIVE TEACHER to OWNER")
    void transferOwnership_teacherTarget_allowed() {
        OrgMember currentOwner = member(USER_ID, "OWNER", "ACTIVE");
        OrgMember target = member(NEW_OWNER_ID, "TEACHER", "ACTIVE");
        when(memberRepo.findByIdOrgIdAndIdUserId(ORG_ID, USER_ID)).thenReturn(Optional.of(currentOwner));
        when(memberRepo.findByIdOrgIdAndIdUserId(ORG_ID, NEW_OWNER_ID)).thenReturn(Optional.of(target));
        when(userRepository.findById(NEW_OWNER_ID)).thenReturn(Optional.of(userWith(NEW_OWNER_ID, User.Role.TEACHER)));
        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(userWith(USER_ID, User.Role.OWNER)));

        service.transferOwnership(ORG_ID, ACTOR_SELF, NEW_OWNER_ID);

        assertThat(target.getRole()).isEqualTo("OWNER");
        assertThat(currentOwner.getRole()).isEqualTo("MANAGER");
    }

    @Test
    @DisplayName("transferOwnership rejects transferring to yourself")
    void transferOwnership_sameUser_throwsBadRequest() {
        assertThatThrownBy(() -> service.transferOwnership(ORG_ID, ACTOR_SELF, USER_ID))
                .isInstanceOf(BadRequestException.class);

        verify(memberRepo, never()).save(any());
    }

    @Test
    @DisplayName("transferOwnership rejects a caller who is not the current OWNER (e.g. a MANAGER)")
    void transferOwnership_callerNotOwner_throwsForbidden() {
        when(memberRepo.findByIdOrgIdAndIdUserId(ORG_ID, USER_ID))
                .thenReturn(Optional.of(member(USER_ID, "MANAGER", "ACTIVE")));

        assertThatThrownBy(() -> service.transferOwnership(ORG_ID, ACTOR_SELF, NEW_OWNER_ID))
                .isInstanceOf(ForbiddenException.class);

        verify(memberRepo, never()).save(any());
    }

    @Test
    @DisplayName("transferOwnership throws Forbidden when the caller is not an ACTIVE member")
    void transferOwnership_callerNotMember_throwsForbidden() {
        when(memberRepo.findByIdOrgIdAndIdUserId(ORG_ID, USER_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.transferOwnership(ORG_ID, ACTOR_SELF, NEW_OWNER_ID))
                .isInstanceOf(ForbiddenException.class);

        verify(memberRepo, never()).save(any());
    }

    @Test
    @DisplayName("transferOwnership 404s when the target is not a member of the org")
    void transferOwnership_targetMissing_throwsNotFound() {
        when(memberRepo.findByIdOrgIdAndIdUserId(ORG_ID, USER_ID))
                .thenReturn(Optional.of(member(USER_ID, "OWNER", "ACTIVE")));
        when(memberRepo.findByIdOrgIdAndIdUserId(ORG_ID, NEW_OWNER_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.transferOwnership(ORG_ID, ACTOR_SELF, NEW_OWNER_ID))
                .isInstanceOf(NotFoundException.class);

        verify(memberRepo, never()).save(any());
    }

    @Test
    @DisplayName("transferOwnership rejects a non-staff (STUDENT) target")
    void transferOwnership_studentTarget_throwsBadRequest() {
        when(memberRepo.findByIdOrgIdAndIdUserId(ORG_ID, USER_ID))
                .thenReturn(Optional.of(member(USER_ID, "OWNER", "ACTIVE")));
        when(memberRepo.findByIdOrgIdAndIdUserId(ORG_ID, NEW_OWNER_ID))
                .thenReturn(Optional.of(member(NEW_OWNER_ID, "STUDENT", "ACTIVE")));

        assertThatThrownBy(() -> service.transferOwnership(ORG_ID, ACTOR_SELF, NEW_OWNER_ID))
                .isInstanceOf(BadRequestException.class);

        verify(memberRepo, never()).save(any());
    }

    @Test
    @DisplayName("countActiveOwners delegates to the ACTIVE OWNER count query")
    void countActiveOwners_delegates() {
        when(memberRepo.countByIdOrgIdAndRoleAndStatus(ORG_ID, "OWNER", "ACTIVE")).thenReturn(1L);

        assertThat(service.countActiveOwners(ORG_ID)).isEqualTo(1L);
    }

    // ----------------------------------------------------------------- vết audit

    @Test
    @DisplayName("changeRole ghi vết kèm vai trò CŨ → MỚI")
    void changeRole_writesAuditWithFromTo() {
        OrgMember m = member("TEACHER", "ACTIVE");
        when(memberRepo.findByIdOrgIdAndIdUserId(ORG_ID, USER_ID)).thenReturn(Optional.of(m));
        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(teacherUser(ORG_ID)));

        service.changeRole(ORG_ID, USER_ID, "MANAGER", ACTOR);

        @SuppressWarnings("unchecked")
        ArgumentCaptor<Map<String, Object>> meta = ArgumentCaptor.forClass(Map.class);
        verify(auditLogService).log(eq("org_member_role_changed"), eq(ACTOR),
                eq("ORG_MEMBER"), eq(String.valueOf(USER_ID)), eq(ORG_ID), meta.capture());
        assertThat(meta.getValue())
                .containsEntry("from", "TEACHER")
                .containsEntry("to", "MANAGER")
                .containsEntry("orgId", ORG_ID)
                .containsEntry("targetUserId", USER_ID);
    }

    @Test
    @DisplayName("removeMember ghi vết kèm vai trò người bị gỡ — vai trò đó biến mất sau khi gỡ")
    void removeMember_writesAuditWithRole() {
        when(memberRepo.findByIdOrgIdAndIdUserId(ORG_ID, USER_ID))
                .thenReturn(Optional.of(member("TEACHER", "ACTIVE")));
        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(teacherUser(ORG_ID)));
        when(memberRepo.existsByIdUserIdAndRoleInAndStatus(eq(USER_ID), anySet(), eq("ACTIVE")))
                .thenReturn(false);

        service.removeMember(ORG_ID, USER_ID, ACTOR);

        @SuppressWarnings("unchecked")
        ArgumentCaptor<Map<String, Object>> meta = ArgumentCaptor.forClass(Map.class);
        verify(auditLogService).log(eq("org_member_removed"), eq(ACTOR),
                eq("ORG_MEMBER"), eq(String.valueOf(USER_ID)), eq(ORG_ID), meta.capture());
        assertThat(meta.getValue()).containsEntry("role", "TEACHER").containsEntry("status", "REVOKED");
    }

    @Test
    @DisplayName("selfLeave ghi vết KÈM orgId tường minh — users.org_id của chính người rời vừa bị xoá")
    void selfLeave_writesAuditWithExplicitOrgId() {
        // DEC-13: ca mà đường lùi "suy org từ users.org_id của actor" hỏng theo kiểu khó thấy nhất.
        // Actor CHÍNH LÀ người rời, và detachUser đã xoá users.org_id của họ NGAY TRƯỚC lời gọi ghi
        // vết. Không truyền orgId thì vết "đã rời trung tâm" rơi vào diện B2C (org_id NULL) và biến
        // mất khỏi sổ của giám đốc — đúng cái vết mà giám đốc cần đọc nhất lại là vết duy nhất
        // không đọc được.
        OrgMember active = member("TEACHER", "ACTIVE");
        when(memberRepo.findByIdOrgIdAndIdUserId(ORG_ID, USER_ID)).thenReturn(Optional.of(active));
        User user = teacherUser(ORG_ID);
        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(user));
        when(memberRepo.existsByIdUserIdAndRoleInAndStatus(eq(USER_ID), anySet(), eq("ACTIVE")))
                .thenReturn(false);

        service.selfLeave(ORG_ID, ACTOR_SELF);

        assertThat(user.getOrgId())
                .as("đường lùi đã hết đường: org_id của actor bị xoá trước khi vết được ghi")
                .isNull();
        @SuppressWarnings("unchecked")
        ArgumentCaptor<Map<String, Object>> meta = ArgumentCaptor.forClass(Map.class);
        verify(auditLogService).log(eq("org_member_left"), eq(ACTOR_SELF),
                eq("ORG_MEMBER"), eq(String.valueOf(USER_ID)), eq(ORG_ID), meta.capture());
        assertThat(meta.getValue()).containsEntry("role", "TEACHER").containsEntry("status", "LEFT");
    }

    @Test
    @DisplayName("transferOwnership ghi vết trên TỔ CHỨC, không phải trên một thành viên")
    void transferOwnership_writesOrgScopedAudit() {
        OrgMember owner = member("OWNER", "ACTIVE");
        OrgMember target = member(NEW_OWNER_ID, "MANAGER", "ACTIVE");
        when(memberRepo.findByIdOrgIdAndIdUserId(ORG_ID, USER_ID)).thenReturn(Optional.of(owner));
        when(memberRepo.findByIdOrgIdAndIdUserId(ORG_ID, NEW_OWNER_ID)).thenReturn(Optional.of(target));

        service.transferOwnership(ORG_ID, ACTOR_SELF, NEW_OWNER_ID);

        @SuppressWarnings("unchecked")
        ArgumentCaptor<Map<String, Object>> meta = ArgumentCaptor.forClass(Map.class);
        // target_type = ORG: đây là lần đổi chủ của tổ chức, tra theo org mới thấy được nó.
        verify(auditLogService).log(eq("org_ownership_transferred"), eq(ACTOR_SELF),
                eq("ORG"), eq(String.valueOf(ORG_ID)), eq(ORG_ID), meta.capture());
        assertThat(meta.getValue())
                .containsEntry("fromUserId", USER_ID)
                .containsEntry("toUserId", NEW_OWNER_ID);
    }

    @Test
    @DisplayName("gỡ OWNER bị chặn thì không có vết — vết chỉ dành cho việc đã thực sự xảy ra")
    void removeOwner_blocked_writesNoAudit() {
        when(memberRepo.findByIdOrgIdAndIdUserId(ORG_ID, USER_ID))
                .thenReturn(Optional.of(member("OWNER", "ACTIVE")));

        assertThatThrownBy(() -> service.removeMember(ORG_ID, USER_ID, ACTOR))
                .isInstanceOf(com.deutschflow.common.exception.BadRequestException.class);

        verify(auditLogService, never()).log(any(), any(AuditActor.class), any(), any(), any(), any());
    }

    // ----------------------------------------------------------------- forceOwnership (DEC-13 / A6 — đường khôi phục của admin)

    /** Admin nền tảng — không thuộc trung tâm nào, là người bấm trên console admin. */
    private static final AuditActor ADMIN_ACTOR = new AuditActor(1L, "admin@deutschflow.vn", "ADMIN");
    private static final String FORCE_REASON = "Giám đốc cũ nghỉ việc, không bàn giao tài khoản.";
    private static final Long SECOND_OWNER_ID = 88L;

    private java.util.List<OrgMember> activeOwners(OrgMember... owners) {
        return java.util.List.of(owners);
    }

    @Test
    @DisplayName("forceOwnership: trung tâm 0 OWNER (ca khôi phục) → giáo viên được đặt làm OWNER, không ai bị hạ")
    void forceOwnership_zeroOwner_promotesTeacher() {
        OrgMember target = member(NEW_OWNER_ID, "TEACHER", "ACTIVE");
        when(memberRepo.findByIdOrgIdAndIdUserId(ORG_ID, NEW_OWNER_ID)).thenReturn(Optional.of(target));
        when(memberRepo.findByIdOrgIdAndRoleAndStatus(ORG_ID, "OWNER", "ACTIVE")).thenReturn(activeOwners());
        User targetUser = userWith(NEW_OWNER_ID, User.Role.TEACHER);
        targetUser.setOrgId(null); // dòng users từng bị detach — đường ép phải dán lại org_id
        when(userRepository.findById(NEW_OWNER_ID)).thenReturn(Optional.of(targetUser));

        OrgMembershipService.ForcedOwnership out =
                service.forceOwnership(ADMIN_ACTOR, ORG_ID, NEW_OWNER_ID, FORCE_REASON);

        assertThat(target.getRole()).isEqualTo("OWNER");
        assertThat(targetUser.getRole()).isEqualTo(User.Role.OWNER);
        assertThat(targetUser.getOrgId()).isEqualTo(ORG_ID);
        assertThat(out.demotedOwnerUserIds()).isEmpty();
        assertThat(out.newOwner().userId()).isEqualTo(NEW_OWNER_ID);
        assertThat(out.newOwner().role()).isEqualTo("OWNER");
    }

    @Test
    @DisplayName("forceOwnership: 1 OWNER hiện tại → hạ xuống MANAGER (cả org_members lẫn users.role), người mới lên OWNER")
    void forceOwnership_oneOwner_demotesToManager() {
        OrgMember currentOwner = member(USER_ID, "OWNER", "ACTIVE");
        OrgMember target = member(NEW_OWNER_ID, "MANAGER", "ACTIVE");
        when(memberRepo.findByIdOrgIdAndIdUserId(ORG_ID, NEW_OWNER_ID)).thenReturn(Optional.of(target));
        when(memberRepo.findByIdOrgIdAndRoleAndStatus(ORG_ID, "OWNER", "ACTIVE"))
                .thenReturn(activeOwners(currentOwner));
        User ownerUser = userWith(USER_ID, User.Role.OWNER);
        User targetUser = userWith(NEW_OWNER_ID, User.Role.MANAGER);
        when(userRepository.findById(NEW_OWNER_ID)).thenReturn(Optional.of(targetUser));
        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(ownerUser));

        OrgMembershipService.ForcedOwnership out =
                service.forceOwnership(ADMIN_ACTOR, ORG_ID, NEW_OWNER_ID, FORCE_REASON);

        assertThat(target.getRole()).isEqualTo("OWNER");
        assertThat(currentOwner.getRole()).isEqualTo("MANAGER");
        assertThat(targetUser.getRole()).isEqualTo(User.Role.OWNER);
        assertThat(ownerUser.getRole()).isEqualTo(User.Role.MANAGER);
        assertThat(out.demotedOwnerUserIds()).containsExactly(USER_ID);
        verify(memberRepo).save(target);
        verify(memberRepo).save(currentOwner);
    }

    @Test
    @DisplayName("forceOwnership: dữ liệu cũ có NHIỀU OWNER → tất cả bị hạ, trung tâm về đúng một OWNER")
    void forceOwnership_multipleOwners_allDemoted() {
        OrgMember owner1 = member(USER_ID, "OWNER", "ACTIVE");
        OrgMember owner2 = member(SECOND_OWNER_ID, "OWNER", "ACTIVE");
        OrgMember target = member(NEW_OWNER_ID, "TEACHER", "ACTIVE");
        when(memberRepo.findByIdOrgIdAndIdUserId(ORG_ID, NEW_OWNER_ID)).thenReturn(Optional.of(target));
        when(memberRepo.findByIdOrgIdAndRoleAndStatus(ORG_ID, "OWNER", "ACTIVE"))
                .thenReturn(activeOwners(owner1, owner2));
        when(userRepository.findById(NEW_OWNER_ID)).thenReturn(Optional.of(userWith(NEW_OWNER_ID, User.Role.TEACHER)));
        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(userWith(USER_ID, User.Role.OWNER)));
        when(userRepository.findById(SECOND_OWNER_ID)).thenReturn(Optional.of(userWith(SECOND_OWNER_ID, User.Role.OWNER)));

        OrgMembershipService.ForcedOwnership out =
                service.forceOwnership(ADMIN_ACTOR, ORG_ID, NEW_OWNER_ID, FORCE_REASON);

        assertThat(target.getRole()).isEqualTo("OWNER");
        assertThat(owner1.getRole()).isEqualTo("MANAGER");
        assertThat(owner2.getRole()).isEqualTo("MANAGER");
        assertThat(out.demotedOwnerUserIds()).containsExactly(USER_ID, SECOND_OWNER_ID);
    }

    @Test
    @DisplayName("forceOwnership: người được chỉ định ĐÃ là OWNER → gọi lại là no-op có vết, không hạ ai")
    void forceOwnership_targetAlreadyOwner_isNoOpWithTrace() {
        OrgMember target = member(NEW_OWNER_ID, "OWNER", "ACTIVE");
        when(memberRepo.findByIdOrgIdAndIdUserId(ORG_ID, NEW_OWNER_ID)).thenReturn(Optional.of(target));
        // Danh sách OWNER ACTIVE chứa chính người đó — phải bị loại khỏi diện hạ vai.
        when(memberRepo.findByIdOrgIdAndRoleAndStatus(ORG_ID, "OWNER", "ACTIVE")).thenReturn(activeOwners(target));
        User targetUser = userWith(NEW_OWNER_ID, User.Role.OWNER);
        when(userRepository.findById(NEW_OWNER_ID)).thenReturn(Optional.of(targetUser));

        OrgMembershipService.ForcedOwnership out =
                service.forceOwnership(ADMIN_ACTOR, ORG_ID, NEW_OWNER_ID, FORCE_REASON);

        assertThat(target.getRole()).isEqualTo("OWNER");
        assertThat(targetUser.getRole()).isEqualTo(User.Role.OWNER);
        assertThat(out.demotedOwnerUserIds()).isEmpty();
        verify(auditLogService).log(eq("admin.org.owner.forced"), eq(ADMIN_ACTOR),
                eq("ORG"), eq(String.valueOf(ORG_ID)), eq(ORG_ID), any());
    }

    @Test
    @DisplayName("forceOwnership: vết admin.org.owner.forced ghi actor = ADMIN, org bị chạm = orgId, kèm lý do + danh sách chủ cũ")
    void forceOwnership_writesAdminActorTraceScopedToOrg() {
        OrgMember currentOwner = member(USER_ID, "OWNER", "ACTIVE");
        OrgMember target = member(NEW_OWNER_ID, "MANAGER", "ACTIVE");
        when(memberRepo.findByIdOrgIdAndIdUserId(ORG_ID, NEW_OWNER_ID)).thenReturn(Optional.of(target));
        when(memberRepo.findByIdOrgIdAndRoleAndStatus(ORG_ID, "OWNER", "ACTIVE"))
                .thenReturn(activeOwners(currentOwner));

        service.forceOwnership(ADMIN_ACTOR, ORG_ID, NEW_OWNER_ID, FORCE_REASON);

        @SuppressWarnings("unchecked")
        ArgumentCaptor<Map<String, Object>> meta = ArgumentCaptor.forClass(Map.class);
        // touchedOrgId = ORG_ID là điểm quyết định (DEC-13): admin không thuộc trung tâm nào nên
        // đường suy-từ-actor rơi vào org NULL — giám đốc mới sẽ không bao giờ đọc được vết này.
        verify(auditLogService).log(eq("admin.org.owner.forced"), eq(ADMIN_ACTOR),
                eq("ORG"), eq(String.valueOf(ORG_ID)), eq(ORG_ID), meta.capture());
        assertThat(meta.getValue())
                .containsEntry("orgId", ORG_ID)
                .containsEntry("newOwnerUserId", NEW_OWNER_ID)
                .containsEntry("previousOwnerUserIds", java.util.List.of(USER_ID))
                .containsEntry("reason", FORCE_REASON)
                .doesNotContainKeys("targetEmail", "email", "displayName");
        // Một thao tác, một dòng sổ: KHÔNG phát thêm org_ownership_transferred.
        verify(auditLogService, never()).log(eq("org_ownership_transferred"), any(AuditActor.class),
                any(), any(), any(), any());
    }

    @Test
    @DisplayName("forceOwnership: học viên (STUDENT) không nhận vai giám đốc → 400, không ghi gì, không vết")
    void forceOwnership_studentTarget_throwsBadRequest() {
        when(memberRepo.findByIdOrgIdAndIdUserId(ORG_ID, NEW_OWNER_ID))
                .thenReturn(Optional.of(member(NEW_OWNER_ID, "STUDENT", "ACTIVE")));

        assertThatThrownBy(() -> service.forceOwnership(ADMIN_ACTOR, ORG_ID, NEW_OWNER_ID, FORCE_REASON))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("học viên");

        verify(memberRepo, never()).save(any());
        verify(userRepository, never()).save(any());
        verify(auditLogService, never()).log(any(), any(AuditActor.class), any(), any(), any(), any());
    }

    @Test
    @DisplayName("forceOwnership: không phải thành viên, hoặc thành viên đã rời (LEFT) → 400, không ghi gì")
    void forceOwnership_nonMemberOrInactive_throwsBadRequest() {
        when(memberRepo.findByIdOrgIdAndIdUserId(ORG_ID, NEW_OWNER_ID)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.forceOwnership(ADMIN_ACTOR, ORG_ID, NEW_OWNER_ID, FORCE_REASON))
                .isInstanceOf(BadRequestException.class);

        when(memberRepo.findByIdOrgIdAndIdUserId(ORG_ID, NEW_OWNER_ID))
                .thenReturn(Optional.of(member(NEW_OWNER_ID, "MANAGER", "LEFT")));
        assertThatThrownBy(() -> service.forceOwnership(ADMIN_ACTOR, ORG_ID, NEW_OWNER_ID, FORCE_REASON))
                .isInstanceOf(BadRequestException.class);

        verify(memberRepo, never()).save(any());
        verify(auditLogService, never()).log(any(), any(AuditActor.class), any(), any(), any(), any());
    }

    @Test
    @DisplayName("hồi quy: transferOwnership (chủ cũ tự chuyển) vẫn ghi org_ownership_transferred với actor là chính OWNER")
    void transferOwnership_stillWritesOwnerActorTrace_afterSharedCoreExtraction() {
        OrgMember owner = member("OWNER", "ACTIVE");
        OrgMember target = member(NEW_OWNER_ID, "TEACHER", "ACTIVE");
        when(memberRepo.findByIdOrgIdAndIdUserId(ORG_ID, USER_ID)).thenReturn(Optional.of(owner));
        when(memberRepo.findByIdOrgIdAndIdUserId(ORG_ID, NEW_OWNER_ID)).thenReturn(Optional.of(target));
        User targetUser = userWith(NEW_OWNER_ID, User.Role.TEACHER);
        User ownerUser = userWith(USER_ID, User.Role.OWNER);
        when(userRepository.findById(NEW_OWNER_ID)).thenReturn(Optional.of(targetUser));
        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(ownerUser));

        service.transferOwnership(ORG_ID, ACTOR_SELF, NEW_OWNER_ID);

        assertThat(target.getRole()).isEqualTo("OWNER");
        assertThat(owner.getRole()).isEqualTo("MANAGER");
        assertThat(targetUser.getRole()).isEqualTo(User.Role.OWNER);
        assertThat(ownerUser.getRole()).isEqualTo(User.Role.MANAGER);
        verify(auditLogService).log(eq("org_ownership_transferred"), eq(ACTOR_SELF),
                eq("ORG"), eq(String.valueOf(ORG_ID)), eq(ORG_ID), any());
        verify(auditLogService, never()).log(eq("admin.org.owner.forced"), any(AuditActor.class),
                any(), any(), any(), any());
    }

    // ----------------------------------------------------------------- Gói 2: cắt phiên khi quyền trong trung tâm đổi

    private static final String REVOKED = OrgMembershipService.EVENT_SESSIONS_REVOKED;

    /** Bắt metadata của các dòng {@code org_member_sessions_revoked} ghi cho {@code targetUserId}. */
    @SuppressWarnings("unchecked")
    private Map<String, Object> revokedTraceFor(AuditActor actor, Long targetUserId) {
        ArgumentCaptor<Map<String, Object>> meta = ArgumentCaptor.forClass(Map.class);
        verify(auditLogService).log(eq(REVOKED), eq(actor), eq("ORG_MEMBER"),
                eq(String.valueOf(targetUserId)), eq(ORG_ID), meta.capture());
        return meta.getValue();
    }

    @Test
    @DisplayName("Gói 2 removeMember: thu hồi mọi refresh token của người bị gỡ, vết ghi SAU vết gỡ, chỉ id + số lượng")
    void removeMember_revokesSessions_andWritesCountOnlyTrace() {
        when(memberRepo.findByIdOrgIdAndIdUserId(ORG_ID, USER_ID))
                .thenReturn(Optional.of(member("TEACHER", "ACTIVE")));
        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(teacherUser(ORG_ID)));
        when(memberRepo.existsByIdUserIdAndRoleInAndStatus(eq(USER_ID), anySet(), eq("ACTIVE"))).thenReturn(false);
        when(refreshTokenRepository.revokeAllByUserId(USER_ID)).thenReturn(2); // hai thiết bị đang đăng nhập

        service.removeMember(ORG_ID, USER_ID, ACTOR);

        // Thứ tự sổ: việc xảy ra (gỡ) trước, hệ quả (cắt phiên) ngay sau — cùng transaction.
        InOrder ledger = inOrder(auditLogService);
        ledger.verify(auditLogService).log(eq("org_member_removed"), eq(ACTOR), eq("ORG_MEMBER"),
                eq(String.valueOf(USER_ID)), eq(ORG_ID), any());
        ledger.verify(auditLogService).log(eq(REVOKED), eq(ACTOR), eq("ORG_MEMBER"),
                eq(String.valueOf(USER_ID)), eq(ORG_ID), any());

        Map<String, Object> meta = revokedTraceFor(ACTOR, USER_ID);
        assertThat(meta)
                .containsEntry("reason", OrgMembershipService.REVOKE_REASON_REMOVED)
                .containsEntry("revokedCount", 2)
                .containsEntry("orgId", ORG_ID)
                .containsEntry("targetUserId", USER_ID);
        assertThat(meta.values()).as("không PII trong vết").noneMatch(v -> String.valueOf(v).contains("@"));
    }

    @Test
    @DisplayName("Gói 2 selfLeave: tự rời cũng cắt phiên của chính mình; vết mang orgId tường minh dù users.org_id đã bị xoá; 0 phiên vẫn có vết")
    void selfLeave_revokesOwnSessions_traceScopedToOrg() {
        OrgMember active = member("TEACHER", "ACTIVE");
        when(memberRepo.findByIdOrgIdAndIdUserId(ORG_ID, USER_ID)).thenReturn(Optional.of(active));
        User user = teacherUser(ORG_ID);
        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(user));
        when(memberRepo.existsByIdUserIdAndRoleInAndStatus(eq(USER_ID), anySet(), eq("ACTIVE"))).thenReturn(false);

        service.selfLeave(ORG_ID, ACTOR_SELF);

        assertThat(user.getOrgId()).isNull();
        verify(refreshTokenRepository).revokeAllByUserId(USER_ID);
        assertThat(revokedTraceFor(ACTOR_SELF, USER_ID))
                .containsEntry("reason", OrgMembershipService.REVOKE_REASON_LEFT)
                .containsEntry("revokedCount", 0); // mock mặc định: người này không có phiên nào đang sống
    }

    @Test
    @DisplayName("Gói 2 changeRole: đổi vai (MANAGER ↔ TEACHER) cắt phiên người bị đổi — cả chiều hạ lẫn chiều nâng")
    void changeRole_revokesTargetSessions_bothDirections() {
        OrgMember manager = member("MANAGER", "ACTIVE");
        when(memberRepo.findByIdOrgIdAndIdUserId(ORG_ID, USER_ID)).thenReturn(Optional.of(manager));
        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(userWith(USER_ID, User.Role.MANAGER)));
        when(refreshTokenRepository.revokeAllByUserId(USER_ID)).thenReturn(1);

        service.changeRole(ORG_ID, USER_ID, "TEACHER", ACTOR);

        assertThat(manager.getRole()).isEqualTo("TEACHER");
        assertThat(revokedTraceFor(ACTOR, USER_ID))
                .containsEntry("reason", OrgMembershipService.REVOKE_REASON_ROLE_CHANGED)
                .containsEntry("revokedCount", 1);
    }

    @Test
    @DisplayName("Gói 2 transferOwnership: CẢ chủ cũ lẫn chủ mới bị cắt phiên — hai vết, cùng lý do ownership_transferred")
    void transferOwnership_revokesBothParties() {
        OrgMember owner = member("OWNER", "ACTIVE");
        OrgMember target = member(NEW_OWNER_ID, "MANAGER", "ACTIVE");
        when(memberRepo.findByIdOrgIdAndIdUserId(ORG_ID, USER_ID)).thenReturn(Optional.of(owner));
        when(memberRepo.findByIdOrgIdAndIdUserId(ORG_ID, NEW_OWNER_ID)).thenReturn(Optional.of(target));

        service.transferOwnership(ORG_ID, ACTOR_SELF, NEW_OWNER_ID);

        verify(refreshTokenRepository).revokeAllByUserId(NEW_OWNER_ID);
        verify(refreshTokenRepository).revokeAllByUserId(USER_ID);
        assertThat(revokedTraceFor(ACTOR_SELF, NEW_OWNER_ID))
                .containsEntry("reason", OrgMembershipService.REVOKE_REASON_OWNERSHIP_TRANSFERRED);
        assertThat(revokedTraceFor(ACTOR_SELF, USER_ID))
                .containsEntry("reason", OrgMembershipService.REVOKE_REASON_OWNERSHIP_TRANSFERRED);
    }

    @Test
    @DisplayName("Gói 2 forceOwnership: chủ mới VÀ mọi chủ cũ bị hạ đều bị cắt phiên ngay trong lõi (façade không còn tự revoke)")
    void forceOwnership_revokesNewOwnerAndEveryDemotedOwner() {
        OrgMember owner1 = member(USER_ID, "OWNER", "ACTIVE");
        OrgMember owner2 = member(SECOND_OWNER_ID, "OWNER", "ACTIVE");
        OrgMember target = member(NEW_OWNER_ID, "TEACHER", "ACTIVE");
        when(memberRepo.findByIdOrgIdAndIdUserId(ORG_ID, NEW_OWNER_ID)).thenReturn(Optional.of(target));
        when(memberRepo.findByIdOrgIdAndRoleAndStatus(ORG_ID, "OWNER", "ACTIVE"))
                .thenReturn(activeOwners(owner1, owner2));
        when(userRepository.findById(NEW_OWNER_ID)).thenReturn(Optional.of(userWith(NEW_OWNER_ID, User.Role.TEACHER)));
        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(userWith(USER_ID, User.Role.OWNER)));
        when(userRepository.findById(SECOND_OWNER_ID)).thenReturn(Optional.of(userWith(SECOND_OWNER_ID, User.Role.OWNER)));

        service.forceOwnership(ADMIN_ACTOR, ORG_ID, NEW_OWNER_ID, FORCE_REASON);

        verify(refreshTokenRepository).revokeAllByUserId(NEW_OWNER_ID);
        verify(refreshTokenRepository).revokeAllByUserId(USER_ID);
        verify(refreshTokenRepository).revokeAllByUserId(SECOND_OWNER_ID);
        verify(auditLogService, times(3)).log(eq(REVOKED), eq(ADMIN_ACTOR), eq("ORG_MEMBER"),
                anyString(), eq(ORG_ID), any());
        assertThat(revokedTraceFor(ADMIN_ACTOR, SECOND_OWNER_ID))
                .containsEntry("reason", OrgMembershipService.REVOKE_REASON_OWNERSHIP_FORCED);
    }

    @Test
    @DisplayName("Gói 2: thao tác bị chặn (gỡ OWNER, đổi sang vai lạ) thì KHÔNG cắt phiên ai — cắt phiên chỉ đi kèm việc đã xảy ra")
    void blockedMutations_neverRevokeSessions() {
        when(memberRepo.findByIdOrgIdAndIdUserId(ORG_ID, USER_ID))
                .thenReturn(Optional.of(member("OWNER", "ACTIVE")));

        assertThatThrownBy(() -> service.removeMember(ORG_ID, USER_ID, ACTOR))
                .isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> service.changeRole(ORG_ID, USER_ID, "STUDENT", ACTOR))
                .isInstanceOf(BadRequestException.class);

        verify(refreshTokenRepository, never()).revokeAllByUserId(anyLong());
        verify(auditLogService, never()).log(eq(REVOKED), any(AuditActor.class), any(), any(), any(), any());
    }
}
