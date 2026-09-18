package com.deutschflow.user.onboarding;

import com.deutschflow.common.quota.PlanBadge;
import com.deutschflow.common.quota.QuotaService;
import com.deutschflow.organization.entity.ClassCurriculumLink;
import com.deutschflow.organization.entity.OrgCurriculum;
import com.deutschflow.organization.entity.OrgCurriculumVersion;
import com.deutschflow.organization.entity.OrgMember;
import com.deutschflow.organization.entity.OrgMemberId;
import com.deutschflow.organization.entity.Organization;
import com.deutschflow.organization.repository.ClassCurriculumLinkRepository;
import com.deutschflow.organization.repository.OrgCurriculumRepository;
import com.deutschflow.organization.repository.OrgCurriculumVersionRepository;
import com.deutschflow.organization.repository.OrgMemberRepository;
import com.deutschflow.organization.repository.OrganizationRepository;
import com.deutschflow.teacher.entity.ClassStudent;
import com.deutschflow.teacher.entity.ClassStudentId;
import com.deutschflow.teacher.entity.TeacherClass;
import com.deutschflow.teacher.repository.ClassStudentRepository;
import com.deutschflow.teacher.repository.TeacherClassRepository;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.entity.UserLearningProfile;
import com.deutschflow.user.onboarding.dto.OnboardingContextDtos.AccountSource;
import com.deutschflow.user.onboarding.dto.OnboardingContextDtos.OnboardingContextResponse;
import com.deutschflow.user.onboarding.service.OnboardingContextService;
import com.deutschflow.user.repository.UserLearningProfileRepository;
import com.deutschflow.user.service.LearningPlanService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Instant;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Đợt 5 (17/09/2026): {@code GET /onboarding/context} — bảng chân trị cửa vào + các tra cứu phụ.
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("OnboardingContextService")
class OnboardingContextServiceTest {

    private static final long USER_ID = 501L;
    private static final long ORG_ID = 7L;
    private static final Instant NOW_PLUS_30D = Instant.parse("2026-10-17T00:00:00Z");

    @Mock LearningPlanService learningPlanService;
    @Mock OrgMemberRepository orgMemberRepository;
    @Mock OrganizationRepository organizationRepository;
    @Mock ClassStudentRepository classStudentRepository;
    @Mock TeacherClassRepository teacherClassRepository;
    @Mock ClassCurriculumLinkRepository classCurriculumLinkRepository;
    @Mock OrgCurriculumVersionRepository orgCurriculumVersionRepository;
    @Mock OrgCurriculumRepository orgCurriculumRepository;
    @Mock UserLearningProfileRepository learningProfileRepository;
    @Mock QuotaService quotaService;

    @InjectMocks OnboardingContextService service;

    private User user;

    @BeforeEach
    void setUp() {
        user = User.builder().email("hv@example.com").displayName("HV").role(User.Role.STUDENT).build();
        ReflectionTestUtils.setField(user, "id", USER_ID);
        lenient().when(quotaService.resolvePlanBadge(eq(USER_ID), any()))
                .thenReturn(new PlanBadge("PRO", "PRO", null, null, true, NOW_PLUS_30D, "WEB"));
        lenient().when(learningProfileRepository.findByUserId(USER_ID)).thenReturn(Optional.empty());
        lenient().when(learningPlanService.hasPlan(user)).thenReturn(false);
    }

    @Nested
    @DisplayName("bảng chân trị accountSource (thuần)")
    class AccountSourceTable {

        @ParameterizedTest(name = "createdVia={0}, memberActive={1} → {2}")
        @CsvSource({
                "SELF,    true,  SELF",
                "SELF,    false, SELF",
                "CSV,     true,  ORG_ROSTER",
                "CSV,     false, SELF",
                "OWNER,   true,  ORG_INVITE",
                "MANAGER, true,  ORG_INVITE",
                "ADMIN,   true,  ORG_INVITE",
                "OWNER,   false, SELF",
        })
        void resolves(User.CreatedVia via, boolean active, AccountSource expected) {
            assertThat(OnboardingContextService.resolveAccountSource(via, active)).isEqualTo(expected);
        }

        @Test
        @DisplayName("created_via null (tài khoản cũ trước khi có cột) = SELF dù có membership")
        void nullCreatedViaIsSelf() {
            assertThat(OnboardingContextService.resolveAccountSource(null, true)).isEqualTo(AccountSource.SELF);
        }
    }

    @Test
    @DisplayName("tự đăng ký: SELF, org null, không tra trung tâm/lớp, trial đi thẳng từ PlanBadge")
    void selfAccount() {
        ReflectionTestUtils.setField(user, "createdVia", User.CreatedVia.SELF);
        when(orgMemberRepository.findByIdUserIdAndRoleAndStatus(USER_ID, "STUDENT", "ACTIVE")).thenReturn(List.of());
        when(learningPlanService.hasPlan(user)).thenReturn(true);

        OnboardingContextResponse ctx = service.contextFor(user);

        assertThat(ctx.accountSource()).isEqualTo(AccountSource.SELF);
        assertThat(ctx.hasPlan()).isTrue();
        assertThat(ctx.org()).isNull();
        assertThat(ctx.presetCurrentLevel()).isNull();
        assertThat(ctx.trial().isTrial()).isTrue();
        assertThat(ctx.trial().trialEndsAt()).isEqualTo(NOW_PLUS_30D);
        verify(organizationRepository, never()).findById(anyLong());
        verify(classStudentRepository, never()).findByIdStudentId(anyLong());
    }

    @Test
    @DisplayName("C3: tự đăng ký rồi vào lớp bằng mã — có membership nhưng vẫn SELF (không làm lại onboarding)")
    void selfRegisteredThenJoinedByCodeStaysSelf() {
        ReflectionTestUtils.setField(user, "createdVia", User.CreatedVia.SELF);
        when(orgMemberRepository.findByIdUserIdAndRoleAndStatus(USER_ID, "STUDENT", "ACTIVE"))
                .thenReturn(List.of(member(ORG_ID)));

        OnboardingContextResponse ctx = service.contextFor(user);

        assertThat(ctx.accountSource()).isEqualTo(AccountSource.SELF);
        assertThat(ctx.org()).isNull();
    }

    @Test
    @DisplayName("CSV + membership ACTIVE: ORG_ROSTER, tên trung tâm + lớp mới nhất trong trung tâm")
    void rosterAccountWithClass() {
        ReflectionTestUtils.setField(user, "createdVia", User.CreatedVia.CSV);
        when(orgMemberRepository.findByIdUserIdAndRoleAndStatus(USER_ID, "STUDENT", "ACTIVE"))
                .thenReturn(List.of(member(ORG_ID)));
        when(organizationRepository.findById(ORG_ID)).thenReturn(Optional.of(org("Trung tâm Sao Việt")));
        // Hai lớp: lớp cũ (id 41) và lớp mới hơn (id 42); lớp 99 của trung tâm KHÁC phải bị bỏ qua.
        when(classStudentRepository.findByIdStudentId(USER_ID)).thenReturn(List.of(
                enrollment(41L, LocalDateTime.of(2026, 8, 1, 0, 0)),
                enrollment(42L, LocalDateTime.of(2026, 9, 10, 0, 0)),
                enrollment(99L, LocalDateTime.of(2026, 9, 15, 0, 0))));
        when(teacherClassRepository.findAllById(anyList())).thenReturn(List.of(
                teacherClass(41L, ORG_ID, "A1 sáng"),
                teacherClass(42L, ORG_ID, "B1 tối thứ 3"),
                teacherClass(99L, 8L, "Lớp trung tâm khác")));
        when(classCurriculumLinkRepository.findByClassId(42L)).thenReturn(Optional.empty());

        OnboardingContextResponse ctx = service.contextFor(user);

        assertThat(ctx.accountSource()).isEqualTo(AccountSource.ORG_ROSTER);
        assertThat(ctx.hasPlan()).isFalse();
        assertThat(ctx.org().orgId()).isEqualTo(ORG_ID);
        assertThat(ctx.org().name()).isEqualTo("Trung tâm Sao Việt");
        assertThat(ctx.org().classId()).isEqualTo(42L);
        assertThat(ctx.org().className()).isEqualTo("B1 tối thứ 3");
        assertThat(ctx.presetCurrentLevel()).isNull();
    }

    @Test
    @DisplayName("nhân sự tạo tay (OWNER) + membership ACTIVE, chưa xếp lớp: ORG_INVITE, className null")
    void invitedAccountWithoutClass() {
        ReflectionTestUtils.setField(user, "createdVia", User.CreatedVia.OWNER);
        when(orgMemberRepository.findByIdUserIdAndRoleAndStatus(USER_ID, "STUDENT", "ACTIVE"))
                .thenReturn(List.of(member(ORG_ID)));
        when(organizationRepository.findById(ORG_ID)).thenReturn(Optional.of(org("Trung tâm Sao Việt")));
        when(classStudentRepository.findByIdStudentId(USER_ID)).thenReturn(List.of());

        OnboardingContextResponse ctx = service.contextFor(user);

        assertThat(ctx.accountSource()).isEqualTo(AccountSource.ORG_INVITE);
        assertThat(ctx.org().name()).isEqualTo("Trung tâm Sao Việt");
        assertThat(ctx.org().classId()).isNull();
        assertThat(ctx.org().className()).isNull();
        verify(teacherClassRepository, never()).findAllById(anyList());
    }

    @Test
    @DisplayName("CSV nhưng membership đã REVOKED/LEFT: học viên thường — SELF, không lộ tên trung tâm cũ")
    void rosterAccountLeftOrgIsSelf() {
        ReflectionTestUtils.setField(user, "createdVia", User.CreatedVia.CSV);
        when(orgMemberRepository.findByIdUserIdAndRoleAndStatus(USER_ID, "STUDENT", "ACTIVE")).thenReturn(List.of());

        OnboardingContextResponse ctx = service.contextFor(user);

        assertThat(ctx.accountSource()).isEqualTo(AccountSource.SELF);
        assertThat(ctx.org()).isNull();
        verify(organizationRepository, never()).findById(anyLong());
    }

    @Test
    @DisplayName("presetCurrentLevel: hồ sơ học có currentLevel thì lấy hồ sơ, không tra giáo trình")
    void presetLevelFromProfile() {
        ReflectionTestUtils.setField(user, "createdVia", User.CreatedVia.CSV);
        when(orgMemberRepository.findByIdUserIdAndRoleAndStatus(USER_ID, "STUDENT", "ACTIVE"))
                .thenReturn(List.of(member(ORG_ID)));
        when(organizationRepository.findById(ORG_ID)).thenReturn(Optional.of(org("TT")));
        when(classStudentRepository.findByIdStudentId(USER_ID)).thenReturn(List.of(enrollment(42L, LocalDateTime.now())));
        when(teacherClassRepository.findAllById(anyList())).thenReturn(List.of(teacherClass(42L, ORG_ID, "B1")));
        when(learningProfileRepository.findByUserId(USER_ID)).thenReturn(Optional.of(
                UserLearningProfile.builder().user(user).currentLevel(UserLearningProfile.CurrentLevel.B1).build()));

        OnboardingContextResponse ctx = service.contextFor(user);

        assertThat(ctx.presetCurrentLevel()).isEqualTo("B1");
        verify(classCurriculumLinkRepository, never()).findByClassId(anyLong());
    }

    @Test
    @DisplayName("presetCurrentLevel: không có hồ sơ thì lấy cefr_level của giáo trình gắn vào lớp đang học")
    void presetLevelFromClassCurriculum() {
        ReflectionTestUtils.setField(user, "createdVia", User.CreatedVia.CSV);
        when(orgMemberRepository.findByIdUserIdAndRoleAndStatus(USER_ID, "STUDENT", "ACTIVE"))
                .thenReturn(List.of(member(ORG_ID)));
        when(organizationRepository.findById(ORG_ID)).thenReturn(Optional.of(org("TT")));
        when(classStudentRepository.findByIdStudentId(USER_ID)).thenReturn(List.of(enrollment(42L, LocalDateTime.now())));
        when(teacherClassRepository.findAllById(anyList())).thenReturn(List.of(teacherClass(42L, ORG_ID, "B1")));
        ClassCurriculumLink link = new ClassCurriculumLink();
        ReflectionTestUtils.setField(link, "versionId", 300L);
        when(classCurriculumLinkRepository.findByClassId(42L)).thenReturn(Optional.of(link));
        OrgCurriculumVersion version = new OrgCurriculumVersion();
        ReflectionTestUtils.setField(version, "curriculumId", 20L);
        when(orgCurriculumVersionRepository.findById(300L)).thenReturn(Optional.of(version));
        OrgCurriculum curriculum = new OrgCurriculum();
        ReflectionTestUtils.setField(curriculum, "cefrLevel", "A2");
        when(orgCurriculumRepository.findById(20L)).thenReturn(Optional.of(curriculum));

        OnboardingContextResponse ctx = service.contextFor(user);

        assertThat(ctx.presetCurrentLevel()).isEqualTo("A2");
    }

    @Test
    @DisplayName("trung tâm bị xoá/không tìm thấy: vẫn trả ORG_ROSTER với name null — client vẫn rẽ lối được")
    void missingOrgRowDoesNotBreakResponse() {
        ReflectionTestUtils.setField(user, "createdVia", User.CreatedVia.CSV);
        when(orgMemberRepository.findByIdUserIdAndRoleAndStatus(USER_ID, "STUDENT", "ACTIVE"))
                .thenReturn(List.of(member(ORG_ID)));
        when(organizationRepository.findById(ORG_ID)).thenReturn(Optional.empty());
        when(classStudentRepository.findByIdStudentId(USER_ID)).thenReturn(List.of());

        OnboardingContextResponse ctx = service.contextFor(user);

        assertThat(ctx.accountSource()).isEqualTo(AccountSource.ORG_ROSTER);
        assertThat(ctx.org().orgId()).isEqualTo(ORG_ID);
        assertThat(ctx.org().name()).isNull();
    }

    // ── fixtures ──────────────────────────────────────────────────────────────

    private static OrgMember member(long orgId) {
        return OrgMember.builder().id(new OrgMemberId(orgId, USER_ID)).role("STUDENT").status("ACTIVE")
                .joinedAt(Instant.parse("2026-09-01T00:00:00Z")).build();
    }

    private static Organization org(String name) {
        Organization org = new Organization();
        ReflectionTestUtils.setField(org, "id", ORG_ID);
        ReflectionTestUtils.setField(org, "name", name);
        return org;
    }

    private static ClassStudent enrollment(long classId, LocalDateTime joinedAt) {
        return ClassStudent.builder().id(new ClassStudentId(classId, USER_ID)).joinedAt(joinedAt).status("ACTIVE").build();
    }

    private static TeacherClass teacherClass(long id, long orgId, String name) {
        return TeacherClass.builder().id(id).orgId(orgId).name(name).teacherId(1L).inviteCode("C" + id).build();
    }
}
