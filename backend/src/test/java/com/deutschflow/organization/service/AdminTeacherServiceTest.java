package com.deutschflow.organization.service;

import com.deutschflow.common.audit.AuditLogService;
import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.organization.dto.FreeTeacherDto;
import com.deutschflow.organization.dto.OrgMemberDto;
import com.deutschflow.organization.entity.OrgMember;
import com.deutschflow.organization.entity.OrgMemberId;
import com.deutschflow.organization.repository.OrgMemberRepository;
import com.deutschflow.organization.repository.OrganizationRepository;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("AdminTeacherService Unit Tests")
class AdminTeacherServiceTest {

    private static final Long ORG_ID = 10L;
    private static final Long TEACHER_ID = 7L;

    @Mock private UserRepository userRepository;
    @Mock private OrgMemberRepository orgMemberRepository;
    @Mock private OrganizationRepository organizationRepository;
    @Mock private AuditLogService auditLogService;

    private AdminTeacherService service;

    @BeforeEach
    void setUp() {
        service = new AdminTeacherService(userRepository, orgMemberRepository,
                organizationRepository, auditLogService);
    }

    private OrgMember member(String role, String status) {
        OrgMember m = new OrgMember();
        m.setId(new OrgMemberId(ORG_ID, TEACHER_ID));
        m.setRole(role);
        m.setStatus(status);
        m.setJoinedAt(Instant.now());
        return m;
    }

    private User admin() {
        return User.builder().id(1L).email("admin@x.com").role(User.Role.ADMIN).build();
    }

    // ------------------------------------------------------------------ free teachers

    @Test
    @DisplayName("listFreeTeachers maps TEACHERs with no ACTIVE org membership (org_id null)")
    void listFreeTeachers_mapsDerivedFreeTeachers() {
        when(userRepository.findByRoleAndOrgIdIsNullAndActiveTrue(User.Role.TEACHER))
                .thenReturn(List.of(User.builder().id(7L).email("free@x").displayName("GV Tự Do").build()));

        List<FreeTeacherDto> out = service.listFreeTeachers();

        assertThat(out).singleElement().satisfies(t -> {
            assertThat(t.userId()).isEqualTo(7L);
            assertThat(t.email()).isEqualTo("free@x");
        });
    }

    // ------------------------------------------------------------------ break-glass

    @Test
    @DisplayName("breakGlassViewTeacher returns the member detail AND writes one audit row")
    void breakGlass_writesAuditAndReturnsDetail() {
        when(orgMemberRepository.findByIdOrgIdAndIdUserId(ORG_ID, TEACHER_ID))
                .thenReturn(Optional.of(member("TEACHER", "ACTIVE")));
        when(userRepository.findById(TEACHER_ID))
                .thenReturn(Optional.of(User.builder().id(TEACHER_ID).email("t@x").displayName("Cô T").build()));
        when(organizationRepository.findById(ORG_ID)).thenReturn(Optional.empty());

        OrgMemberDto dto = service.breakGlassViewTeacher(ORG_ID, TEACHER_ID, admin());

        assertThat(dto.userId()).isEqualTo(TEACHER_ID);
        assertThat(dto.role()).isEqualTo("TEACHER");
        verify(auditLogService).log(
                eq("ORG_TEACHER_BREAK_GLASS_VIEW"), eq(1L), eq("admin@x.com"), eq("ADMIN"),
                eq("ORG_TEACHER"), eq("7"), any(Map.class));
    }

    @Test
    @DisplayName("breakGlassViewTeacher 404s for a non-teaching member and writes NO audit row")
    void breakGlass_studentTarget_throwsAndNoAudit() {
        when(orgMemberRepository.findByIdOrgIdAndIdUserId(ORG_ID, TEACHER_ID))
                .thenReturn(Optional.of(member("STUDENT", "ACTIVE")));

        assertThatThrownBy(() -> service.breakGlassViewTeacher(ORG_ID, TEACHER_ID, admin()))
                .isInstanceOf(NotFoundException.class);

        verify(auditLogService, never()).log(any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    @DisplayName("breakGlassViewTeacher 404s when the user is not a member of the org")
    void breakGlass_notMember_throws() {
        when(orgMemberRepository.findByIdOrgIdAndIdUserId(ORG_ID, TEACHER_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.breakGlassViewTeacher(ORG_ID, TEACHER_ID, admin()))
                .isInstanceOf(NotFoundException.class);
        verify(auditLogService, never()).log(any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    @DisplayName("breakGlassViewTeacher 404s a REVOKED/LEFT ex-member and writes NO audit row")
    void breakGlass_revokedMember_throwsAndNoAudit() {
        when(orgMemberRepository.findByIdOrgIdAndIdUserId(ORG_ID, TEACHER_ID))
                .thenReturn(Optional.of(member("TEACHER", "REVOKED")));

        assertThatThrownBy(() -> service.breakGlassViewTeacher(ORG_ID, TEACHER_ID, admin()))
                .isInstanceOf(NotFoundException.class);
        verify(auditLogService, never()).log(any(), any(), any(), any(), any(), any(), any());
    }
}
