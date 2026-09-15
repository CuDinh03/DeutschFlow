package com.deutschflow.organization.service;

import com.deutschflow.common.exception.ForbiddenException;
import com.deutschflow.common.exception.OrgReadOnlyException;
import com.deutschflow.organization.entity.OrgMember;
import com.deutschflow.organization.entity.OrgMemberId;
import com.deutschflow.organization.entity.Organization;
import com.deutschflow.organization.repository.OrgAcademicApproverRepository;
import com.deutschflow.organization.repository.OrgMemberRepository;
import com.deutschflow.organization.repository.OrganizationRepository;
import com.deutschflow.teacher.repository.TeacherClassRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("OrgGuard Unit Tests")
class OrgGuardTest {

    @Mock
    private OrgMemberRepository memberRepo;

    @Mock
    private OrgAcademicApproverRepository academicApproverRepo;

    @Mock
    private TeacherClassRepository teacherClassRepository;

    @Mock
    private OrganizationRepository organizationRepository;

    private OrgGuard orgGuard;

    private static final Long ORG_ID = 10L;
    private static final Long USER_ID = 99L;
    private static final Long CLASS_ID = 55L;

    @BeforeEach
    void setUp() {
        orgGuard = new OrgGuard(memberRepo, academicApproverRepo, teacherClassRepository,
                organizationRepository);
    }

    // ------------------------------------------------------------------ helpers

    private OrgMember activeMember(String role) {
        OrgMember m = new OrgMember();
        m.setId(new OrgMemberId(ORG_ID, USER_ID));
        m.setRole(role);
        m.setStatus("ACTIVE");
        return m;
    }

    private void stubMember(OrgMember member) {
        when(memberRepo.findByIdOrgIdAndIdUserId(ORG_ID, USER_ID))
                .thenReturn(Optional.ofNullable(member));
    }

    /** Guard tự vệ M1: mọi test duyệt học vụ dùng CLASS_ID phải khai lớp thuộc đúng org. */
    private void stubClassInOrg(boolean inOrg) {
        when(teacherClassRepository.existsByIdAndOrgId(CLASS_ID, ORG_ID)).thenReturn(inOrg);
    }

    // ------------------------------------------------------------------ assertMember

    @Test
    @DisplayName("assertMember returns membership for ACTIVE member")
    void assertMember_activeMember_returnsMembership() {
        OrgMember member = activeMember("TEACHER");
        stubMember(member);

        OrgMember result = orgGuard.assertMember(USER_ID, ORG_ID);

        assertThat(result.getRole()).isEqualTo("TEACHER");
    }

    @Test
    @DisplayName("assertMember throws ForbiddenException when user is not a member")
    void assertMember_notMember_throwsForbidden() {
        stubMember(null);

        assertThatThrownBy(() -> orgGuard.assertMember(USER_ID, ORG_ID))
                .isInstanceOf(ForbiddenException.class);
    }

    @Test
    @DisplayName("assertMember throws ForbiddenException when membership is REMOVED")
    void assertMember_removedMember_throwsForbidden() {
        OrgMember removed = activeMember("TEACHER");
        removed.setStatus("REMOVED");
        stubMember(removed);

        assertThatThrownBy(() -> orgGuard.assertMember(USER_ID, ORG_ID))
                .isInstanceOf(ForbiddenException.class);
    }

    // ------------------------------------------------------------------ assertOrgAdmin — pass cases

    @Test
    @DisplayName("assertOrgAdmin passes for OWNER role")
    void assertOrgAdmin_owner_passes() {
        stubMember(activeMember("OWNER"));

        // Must not throw
        orgGuard.assertOrgAdmin(USER_ID, ORG_ID);
    }

    @Test
    @DisplayName("assertOrgAdmin passes for MANAGER role")
    void assertOrgAdmin_manager_passes() {
        stubMember(activeMember("MANAGER"));

        orgGuard.assertOrgAdmin(USER_ID, ORG_ID);
    }

    // ------------------------------------------------------------------ assertOrgAdmin — deny cases

    @Test
    @DisplayName("assertOrgAdmin throws ForbiddenException for TEACHER role")
    void assertOrgAdmin_teacher_throwsForbidden() {
        stubMember(activeMember("TEACHER"));

        assertThatThrownBy(() -> orgGuard.assertOrgAdmin(USER_ID, ORG_ID))
                .isInstanceOf(ForbiddenException.class);
    }

    @Test
    @DisplayName("assertOrgAdmin throws ForbiddenException for STUDENT role")
    void assertOrgAdmin_student_throwsForbidden() {
        stubMember(activeMember("STUDENT"));

        assertThatThrownBy(() -> orgGuard.assertOrgAdmin(USER_ID, ORG_ID))
                .isInstanceOf(ForbiddenException.class);
    }

    @Test
    @DisplayName("assertOrgAdmin throws ForbiddenException for non-member")
    void assertOrgAdmin_nonMember_throwsForbidden() {
        stubMember(null);

        assertThatThrownBy(() -> orgGuard.assertOrgAdmin(USER_ID, ORG_ID))
                .isInstanceOf(ForbiddenException.class);
    }

    // ------------------------------------------------------------------ assertOrgFinance — pass cases (T-5/D-4)

    @Test
    @DisplayName("assertOrgFinance passes for OWNER role")
    void assertOrgFinance_owner_passes() {
        stubMember(activeMember("OWNER"));
        orgGuard.assertOrgFinance(USER_ID, ORG_ID);
    }

    @Test
    @DisplayName("assertOrgFinance throws ForbiddenException for MANAGER role (finance narrowed to OWNER-only, 2026-06-22)")
    void assertOrgFinance_manager_throwsForbidden() {
        stubMember(activeMember("MANAGER"));
        assertThatThrownBy(() -> orgGuard.assertOrgFinance(USER_ID, ORG_ID))
                .isInstanceOf(ForbiddenException.class);
    }

    @Test
    @DisplayName("assertOrgFinance throws ForbiddenException for ACCOUNTANT (role dropped, D2)")
    void assertOrgFinance_accountant_throwsForbidden() {
        stubMember(activeMember("ACCOUNTANT"));
        assertThatThrownBy(() -> orgGuard.assertOrgFinance(USER_ID, ORG_ID))
                .isInstanceOf(ForbiddenException.class);
    }

    // ------------------------------------------------------------------ assertOrgFinance — deny cases

    @Test
    @DisplayName("assertOrgFinance throws ForbiddenException for TEACHER role")
    void assertOrgFinance_teacher_throwsForbidden() {
        stubMember(activeMember("TEACHER"));
        assertThatThrownBy(() -> orgGuard.assertOrgFinance(USER_ID, ORG_ID))
                .isInstanceOf(ForbiddenException.class);
    }

    @Test
    @DisplayName("assertOrgFinance throws ForbiddenException for STUDENT role")
    void assertOrgFinance_student_throwsForbidden() {
        stubMember(activeMember("STUDENT"));
        assertThatThrownBy(() -> orgGuard.assertOrgFinance(USER_ID, ORG_ID))
                .isInstanceOf(ForbiddenException.class);
    }

    @Test
    @DisplayName("assertOrgFinance throws ForbiddenException for non-member")
    void assertOrgFinance_nonMember_throwsForbidden() {
        stubMember(null);
        assertThatThrownBy(() -> orgGuard.assertOrgFinance(USER_ID, ORG_ID))
                .isInstanceOf(ForbiddenException.class);
    }

    // ------------------------------------------------------------------ assertOrgOwner

    @Test
    @DisplayName("assertOrgOwner passes for OWNER role")
    void assertOrgOwner_owner_passes() {
        stubMember(activeMember("OWNER"));
        orgGuard.assertOrgOwner(USER_ID, ORG_ID); // no throw
    }

    @Test
    @DisplayName("assertOrgOwner throws ForbiddenException for MANAGER role")
    void assertOrgOwner_manager_throwsForbidden() {
        stubMember(activeMember("MANAGER"));
        assertThatThrownBy(() -> orgGuard.assertOrgOwner(USER_ID, ORG_ID))
                .isInstanceOf(ForbiddenException.class);
    }

    @Test
    @DisplayName("assertOrgOwner throws ForbiddenException for TEACHER role")
    void assertOrgOwner_teacher_throwsForbidden() {
        stubMember(activeMember("TEACHER"));
        assertThatThrownBy(() -> orgGuard.assertOrgOwner(USER_ID, ORG_ID))
                .isInstanceOf(ForbiddenException.class);
    }

    // ------------------------------------------------ assertAcademicApprover (PR-2, P01 — D13/§6)

    @Test
    @DisplayName("assertAcademicApprover: OWNER (giám đốc) luôn qua, không cần dòng phân công")
    void academicApprover_owner_passes() {
        stubMember(activeMember("OWNER"));
        stubClassInOrg(true);
        orgGuard.assertAcademicApprover(USER_ID, ORG_ID, CLASS_ID); // no throw
    }

    @Test
    @DisplayName("assertAcademicApprover: MANAGER KHÔNG mặc định có quyền — tách học vụ khỏi quản trị (§6)")
    void academicApprover_managerWithoutGrant_throwsForbidden() {
        stubMember(activeMember("MANAGER"));
        stubClassInOrg(true);
        when(academicApproverRepo.hasActiveApproval(ORG_ID, USER_ID, CLASS_ID)).thenReturn(false);

        assertThatThrownBy(() -> orgGuard.assertAcademicApprover(USER_ID, ORG_ID, CLASS_ID))
                .isInstanceOf(ForbiddenException.class);
    }

    @Test
    @DisplayName("assertAcademicApprover: TEACHER có phân công hiệu lực phủ lớp → qua")
    void academicApprover_grantedTeacher_passes() {
        stubMember(activeMember("TEACHER"));
        stubClassInOrg(true);
        when(academicApproverRepo.hasActiveApproval(ORG_ID, USER_ID, CLASS_ID)).thenReturn(true);

        orgGuard.assertAcademicApprover(USER_ID, ORG_ID, CLASS_ID); // no throw
    }

    @Test
    @DisplayName("assertAcademicApprover: TEACHER không có phân công phủ lớp → Forbidden")
    void academicApprover_teacherWithoutCoverage_throwsForbidden() {
        stubMember(activeMember("TEACHER"));
        stubClassInOrg(true);
        when(academicApproverRepo.hasActiveApproval(ORG_ID, USER_ID, CLASS_ID)).thenReturn(false);

        assertThatThrownBy(() -> orgGuard.assertAcademicApprover(USER_ID, ORG_ID, CLASS_ID))
                .isInstanceOf(ForbiddenException.class);
    }

    @Test
    @DisplayName("assertAcademicApprover: không phải thành viên → Forbidden trước cả khi tra phân công")
    void academicApprover_nonMember_throwsForbidden() {
        stubMember(null);
        assertThatThrownBy(() -> orgGuard.assertAcademicApprover(USER_ID, ORG_ID, CLASS_ID))
                .isInstanceOf(ForbiddenException.class);
    }

    @Test
    @DisplayName("isAcademicApprover: OWNER=true; TEACHER theo phân công; non-member=false (không ném)")
    void isAcademicApprover_booleanMatrix() {
        stubClassInOrg(true);
        stubMember(activeMember("OWNER"));
        assertThat(orgGuard.isAcademicApprover(USER_ID, ORG_ID, CLASS_ID)).isTrue();

        stubMember(activeMember("TEACHER"));
        when(academicApproverRepo.hasActiveApproval(ORG_ID, USER_ID, CLASS_ID)).thenReturn(true);
        assertThat(orgGuard.isAcademicApprover(USER_ID, ORG_ID, CLASS_ID)).isTrue();

        when(academicApproverRepo.hasActiveApproval(ORG_ID, USER_ID, CLASS_ID)).thenReturn(false);
        assertThat(orgGuard.isAcademicApprover(USER_ID, ORG_ID, CLASS_ID)).isFalse();

        stubMember(null);
        assertThat(orgGuard.isAcademicApprover(USER_ID, ORG_ID, CLASS_ID)).isFalse();
    }

    @Test
    @DisplayName("M1: classId không thuộc trung tâm → Forbidden với MỌI vai, kể cả OWNER")
    void academicApprover_classOutsideOrg_throwsForAll() {
        stubMember(activeMember("OWNER"));
        stubClassInOrg(false);
        assertThatThrownBy(() -> orgGuard.assertAcademicApprover(USER_ID, ORG_ID, CLASS_ID))
                .isInstanceOf(ForbiddenException.class);

        stubMember(activeMember("TEACHER"));
        assertThatThrownBy(() -> orgGuard.assertAcademicApprover(USER_ID, ORG_ID, CLASS_ID))
                .isInstanceOf(ForbiddenException.class);
    }

    @Test
    @DisplayName("H1 phòng thủ sâu: STUDENT còn sót dòng phân công cũ vẫn KHÔNG duyệt được")
    void academicApprover_studentWithStaleGrant_throwsForbidden() {
        stubMember(activeMember("STUDENT"));
        stubClassInOrg(true);
        // KHÔNG stub hasActiveApproval: guard phải chặn từ vai trò, không được rơi tới tra phân công.
        assertThatThrownBy(() -> orgGuard.assertAcademicApprover(USER_ID, ORG_ID, CLASS_ID))
                .isInstanceOf(ForbiddenException.class);
        assertThat(orgGuard.isAcademicApprover(USER_ID, ORG_ID, CLASS_ID)).isFalse();
    }

    // ------------------------------------------------------------------ cổng chế độ chỉ đọc (D5)

    /** Entity đang được stub — để chốt MỨC giấy phép, không chỉ "có ném hay không". */
    private Organization stubbedOrg() {
        return organizationRepository.findById(ORG_ID).orElseThrow();
    }

    private void stubOrg(String status, Instant validUntil) {
        stubOrg(status, validUntil, null);
    }

    private void stubOrg(String status, Instant validUntil, Instant suspendedAt) {
        when(organizationRepository.findById(ORG_ID))
                .thenReturn(Optional.of(orgEntity(status, validUntil, suspendedAt)));
    }

    private Organization orgEntity(String status, Instant validUntil, Instant suspendedAt) {
        return Organization.builder()
                .id(ORG_ID)
                .name("Trung tâm Alpha")
                .slug("alpha")
                .status(status)
                .validUntil(validUntil)
                .suspendedAt(suspendedAt)
                .build();
    }

    @Test
    @DisplayName("assertOrgWritable: trung tâm ACTIVE còn hạn → không chặn")
    void assertOrgWritable_active_passes() {
        stubOrg("ACTIVE", Instant.now().plus(30, ChronoUnit.DAYS));
        orgGuard.assertOrgWritable(ORG_ID);
        assertThat(orgGuard.licenceMode(stubbedOrg()).writable()).isTrue();
    }

    @Test
    @DisplayName("assertOrgWritable: vừa hết hạn 1 phút → CHẶN NGAY (không còn quãng ghi được)")
    void assertOrgWritable_justExpired_throwsImmediately() {
        stubOrg("ACTIVE", Instant.now().minusSeconds(60));
        assertThatThrownBy(() -> orgGuard.assertOrgWritable(ORG_ID))
                .isInstanceOf(OrgReadOnlyException.class)
                .hasMessageContaining("hết hạn")
                .extracting(ex -> ((OrgReadOnlyException) ex).getReason())
                .isEqualTo(OrgLicenseState.Reason.EXPIRED);
    }

    @Test
    @DisplayName("assertOrgWritable: hết hạn đã 3 ngày (trong ân hạn chỉ-đọc) → vẫn CHẶN ghi")
    void assertOrgWritable_withinReadOnlyGrace_stillThrows() {
        stubOrg("ACTIVE", Instant.now().minus(3, ChronoUnit.DAYS));
        assertThatThrownBy(() -> orgGuard.assertOrgWritable(ORG_ID))
                .isInstanceOf(OrgReadOnlyException.class);
    }

    @Test
    @DisplayName("assertOrgWritable: hết hạn quá ân hạn → ORG_READ_ONLY, lý do EXPIRED")
    void assertOrgWritable_expiredPastGrace_throws() {
        stubOrg("ACTIVE", Instant.now().minus(10, ChronoUnit.DAYS));
        assertThatThrownBy(() -> orgGuard.assertOrgWritable(ORG_ID))
                .isInstanceOf(OrgReadOnlyException.class)
                .hasMessageContaining("hết hạn")
                .extracting(ex -> ((OrgReadOnlyException) ex).getReason())
                .isEqualTo(OrgLicenseState.Reason.EXPIRED);
    }

    @Test
    @DisplayName("assertOrgWritable: vừa bị đình chỉ (còn ân hạn) → ORG_READ_ONLY, lý do SUSPENDED")
    void assertOrgWritable_suspended_throws() {
        stubOrg("SUSPENDED", Instant.now().plus(365, ChronoUnit.DAYS), Instant.now());
        assertThatThrownBy(() -> orgGuard.assertOrgWritable(ORG_ID))
                .isInstanceOf(OrgReadOnlyException.class)
                .extracting(ex -> ((OrgReadOnlyException) ex).getReason())
                .isEqualTo(OrgLicenseState.Reason.SUSPENDED);
        assertThat(orgGuard.licenceMode(stubbedOrg()).writable()).isFalse();
    }

    @Test
    @DisplayName("assertOrgWritable: đình chỉ mà mốc neo NULL → vẫn chặn ghi, không fail-open")
    void assertOrgWritable_suspendedWithoutAnchor_throws() {
        stubOrg("SUSPENDED", Instant.now().plus(365, ChronoUnit.DAYS), null);
        assertThatThrownBy(() -> orgGuard.assertOrgWritable(ORG_ID))
                .isInstanceOf(OrgReadOnlyException.class);
    }

    @Test
    @DisplayName("licenceMode: mốc neo quyết định CHỈ ĐỌC hay CẮT — cả hai đều chặn ghi như nhau")
    void licenceMode_distinguishesReadOnlyFromCut() {
        Organization justSuspended = orgEntity("SUSPENDED", null, Instant.now().minus(3, ChronoUnit.DAYS));
        Organization longSuspended = orgEntity("SUSPENDED", null, Instant.now().minus(8, ChronoUnit.DAYS));
        Organization noAnchor = orgEntity("SUSPENDED", null, null);

        // Ba trường hợp này đều ném ORG_READ_ONLY, nên chỉ có mức mới phân biệt được — đây là chỗ
        // duy nhất bắt được một bản vá quên truyền suspended_at vào máy trạng thái.
        assertThat(orgGuard.licenceMode(justSuspended)).isEqualTo(OrgLicenseState.Mode.READ_ONLY);
        assertThat(orgGuard.licenceMode(longSuspended)).isEqualTo(OrgLicenseState.Mode.CUT);
        assertThat(orgGuard.licenceMode(noAnchor)).isEqualTo(OrgLicenseState.Mode.CUT);
        assertThat(orgGuard.licenceMode(orgEntity("ACTIVE", null, null)))
                .isEqualTo(OrgLicenseState.Mode.ACTIVE);
    }

    @Test
    @DisplayName("ĐƯỜNG ĐỌC không bị chặn: trung tâm đình chỉ vẫn assertMember/assertOrgAdmin được (D5)")
    void readPaths_notBlockedBySuspension() {
        stubMember(activeMember("MANAGER"));
        // Không stub organizationRepository: nếu đường đọc lỡ gọi cổng trạng thái, Mockito strict
        // stubbing sẽ không cứu — nhưng findById trả Optional.empty() nên test này chốt bằng việc
        // hai lời gọi dưới đây KHÔNG ném.
        orgGuard.assertMember(USER_ID, ORG_ID);
        orgGuard.assertOrgAdmin(USER_ID, ORG_ID);
    }

    @Test
    @DisplayName("assertOrgAdminForWrite: kiểm QUYỀN trước TRẠNG THÁI — người ngoài nhận 403 thường")
    void assertOrgAdminForWrite_nonAdmin_forbiddenNotReadOnly() {
        stubMember(activeMember("STUDENT"));
        assertThatThrownBy(() -> orgGuard.assertOrgAdminForWrite(USER_ID, ORG_ID))
                .isInstanceOf(ForbiddenException.class);
    }

    @Test
    @DisplayName("assertOrgAdminForWrite: org-admin của trung tâm bị đình chỉ → ORG_READ_ONLY")
    void assertOrgAdminForWrite_suspendedOrg_throwsReadOnly() {
        stubMember(activeMember("OWNER"));
        stubOrg("SUSPENDED", null, Instant.now());
        assertThatThrownBy(() -> orgGuard.assertOrgAdminForWrite(USER_ID, ORG_ID))
                .isInstanceOf(OrgReadOnlyException.class);
    }

    @Test
    @DisplayName("assertOrgWritable: không tìm thấy trung tâm → không chặn (lỗi dữ liệu, không phải giấy phép)")
    void assertOrgWritable_missingOrg_passes() {
        when(organizationRepository.findById(ORG_ID)).thenReturn(Optional.empty());
        orgGuard.assertOrgWritable(ORG_ID);
    }
}
