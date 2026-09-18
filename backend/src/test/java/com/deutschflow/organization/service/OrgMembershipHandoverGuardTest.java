package com.deutschflow.organization.service;

import com.deutschflow.common.audit.AuditActor;
import com.deutschflow.common.audit.AuditLogService;
import com.deutschflow.common.exception.ConflictException;
import com.deutschflow.organization.entity.OrgMember;
import com.deutschflow.organization.entity.OrgMemberId;
import com.deutschflow.organization.repository.OrgMemberRepository;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.RefreshTokenRepository;
import com.deutschflow.user.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * G-07 — chốt lớp mồ côi được NỐI vào hai đường rời trung tâm, và dòng phân công lớp được đóng
 * cùng lượt (Gói 2, 11/09/2026).
 *
 * <p>Ba điều ca ở đây chốt, đều là chỗ dễ hỏng lặng lẽ:
 * <ol>
 *   <li><b>Thứ tự.</b> Chốt phải chạy TRƯỚC mọi lệnh ghi. Đặt sau thì 409 vẫn ném nhưng thành viên
 *       đã bị đóng dấu, ghi danh học viên đã bị kết thúc — trạng thái đổi một nửa rồi mới báo lỗi.</li>
 *   <li><b>Phạm vi xoá.</b> Chỉ gỡ phân công của ĐÚNG trung tâm này; người dạy nhiều trung tâm rời
 *       chỗ này không được mất lớp ở chỗ kia, và lớp riêng ngoài trung tâm không bị đụng.</li>
 *   <li><b>Có thật xoá.</b> Trước đợt này {@code closeOrgFootprint} bỏ quên {@code class_teachers},
 *       nên người rời vẫn qua được cổng phân quyền theo lớp — gồm cả đường chấm bài.</li>
 * </ol>
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
@DisplayName("OrgMembershipService — chốt lớp mồ côi + đóng phân công lớp (G-07)")
class OrgMembershipHandoverGuardTest {

    private static final Long ORG_ID = 10L;
    private static final Long USER_ID = 99L;
    private static final AuditActor ADMIN = new AuditActor(2L, "owner@tt.vn", "OWNER");
    private static final AuditActor SELF = new AuditActor(USER_ID, "gv@tt.vn", "TEACHER");

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

    private OrgMembershipService service;

    @BeforeEach
    void setUp() {
        service = new OrgMembershipService(memberRepo, academicApproverRepo, classStudentRepository,
                userRepository, jdbcTemplate, auditLogService, organizationRepository,
                orgEntitlementService, refreshTokenRepository, teachingHandoverGuard);
    }

    private void memberIs(String role) {
        OrgMember m = new OrgMember();
        m.setId(new OrgMemberId(ORG_ID, USER_ID));
        m.setRole(role);
        m.setStatus("ACTIVE");
        when(memberRepo.findByIdOrgIdAndIdUserId(ORG_ID, USER_ID)).thenReturn(Optional.of(m));
        when(userRepository.findById(USER_ID))
                .thenReturn(Optional.of(User.builder().id(USER_ID).role(User.Role.TEACHER).build()));
    }

    private void guardBlocks(OrgTeachingHandoverGuard.Action action) {
        doThrow(new ConflictException("sẽ để lại 2 lớp không còn ai dạy"))
                .when(teachingHandoverGuard).assertNoOrphanedClasses(ORG_ID, USER_ID, action);
    }

    @Nested
    @DisplayName("Chốt chặn chạy TRƯỚC mọi lệnh ghi")
    class ChotChayTruoc {

        @Test
        @DisplayName("🔴 gỡ thành viên sẽ để lại lớp mồ côi ⇒ 409 và KHÔNG đổi gì cả")
        void removeMemberBlockedLeavesNothingChanged() {
            memberIs("TEACHER");
            guardBlocks(OrgTeachingHandoverGuard.Action.REMOVE_FROM_ORG);

            assertThatThrownBy(() -> service.removeMember(ORG_ID, USER_ID, ADMIN))
                    .isInstanceOf(ConflictException.class)
                    .hasMessageContaining("không còn ai dạy");

            verify(memberRepo, never()).save(any());
            verify(classStudentRepository, never())
                    .endEnrollmentsInOrg(anyLong(), anyLong(), any(), anyString());
            verify(jdbcTemplate, never()).update(anyString(), any(), any());
            verify(refreshTokenRepository, never()).revokeAllByUserId(anyLong());
        }

        @Test
        @DisplayName("🔴 tự rời sẽ để lại lớp mồ côi ⇒ 409 và KHÔNG đổi gì cả")
        void selfLeaveBlockedLeavesNothingChanged() {
            memberIs("TEACHER");
            guardBlocks(OrgTeachingHandoverGuard.Action.LEAVE_ORG);

            assertThatThrownBy(() -> service.selfLeave(ORG_ID, SELF))
                    .isInstanceOf(ConflictException.class);

            verify(memberRepo, never()).save(any());
            verify(jdbcTemplate, never()).update(anyString(), any(), any());
        }

        @Test
        @DisplayName("đường GỠ dùng Action REMOVE_FROM_ORG — thông điệp đổi ngôi theo thao tác")
        void removeUsesRemoveAction() {
            memberIs("TEACHER");

            service.removeMember(ORG_ID, USER_ID, ADMIN);

            verify(teachingHandoverGuard).assertNoOrphanedClasses(
                    ORG_ID, USER_ID, OrgTeachingHandoverGuard.Action.REMOVE_FROM_ORG);
            verify(teachingHandoverGuard, never()).assertNoOrphanedClasses(
                    ORG_ID, USER_ID, OrgTeachingHandoverGuard.Action.LEAVE_ORG);
        }

        @Test
        @DisplayName("đường TỰ RỜI dùng Action LEAVE_ORG")
        void selfLeaveUsesLeaveAction() {
            memberIs("TEACHER");

            service.selfLeave(ORG_ID, SELF);

            verify(teachingHandoverGuard).assertNoOrphanedClasses(
                    ORG_ID, USER_ID, OrgTeachingHandoverGuard.Action.LEAVE_ORG);
            verify(teachingHandoverGuard, never()).assertNoOrphanedClasses(
                    ORG_ID, USER_ID, OrgTeachingHandoverGuard.Action.REMOVE_FROM_ORG);
        }
    }

    @Nested
    @DisplayName("Đóng phân công lớp")
    class DongPhanCongLop {

        @Test
        @DisplayName("🔴 gỡ thành viên xoá dòng class_teachers, và CHỈ trong trung tâm này")
        void removeMemberDeletesTeachingRowsScopedToOrg() {
            memberIs("TEACHER");

            service.removeMember(ORG_ID, USER_ID, ADMIN);

            ArgumentCaptor<String> sql = ArgumentCaptor.forClass(String.class);
            verify(jdbcTemplate).update(sql.capture(), eq(USER_ID), eq(ORG_ID));
            assertThat(sql.getValue())
                    .contains("DELETE FROM class_teachers")
                    // Mệnh đề phạm vi là thứ giữ cho người dạy nhiều trung tâm không mất lớp chỗ khác.
                    .contains("teacher_classes")
                    .contains("org_id = ?");
        }

        @Test
        @DisplayName("tự rời cũng xoá — hai đường phải giống nhau, không đường nào bỏ sót")
        void selfLeaveDeletesTeachingRowsToo() {
            memberIs("TEACHER");

            service.selfLeave(ORG_ID, SELF);

            verify(jdbcTemplate).update(anyString(), eq(USER_ID), eq(ORG_ID));
        }
    }
}
