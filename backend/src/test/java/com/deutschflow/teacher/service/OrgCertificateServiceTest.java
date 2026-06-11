package com.deutschflow.teacher.service;

import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.common.exception.ForbiddenException;
import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.organization.entity.Organization;
import com.deutschflow.organization.repository.OrganizationRepository;
import com.deutschflow.teacher.dto.CertificateDto;
import com.deutschflow.teacher.dto.IssueCertificateRequest;
import com.deutschflow.teacher.entity.OrgCertificate;
import com.deutschflow.teacher.repository.ClassStudentRepository;
import com.deutschflow.teacher.repository.OrgCertificateRepository;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Khoá hành vi của {@link OrgCertificateService} (D5 cert-lite co-brand): xác thực đầu vào,
 * guard quyền (sở hữu lớp + HV thuộc lớp), snapshot co-brand/tên, và verify công khai.
 */
@ExtendWith(MockitoExtension.class)
class OrgCertificateServiceTest {

    private static final long ISSUER_ID = 99L;
    private static final long CLASS_ID = 10L;
    private static final long STUDENT_ID = 20L;
    private static final long ORG_ID = 5L;

    @Mock OrgCertificateRepository certificateRepository;
    @Mock TeacherService teacherService;
    @Mock ClassStudentRepository classStudentRepository;
    @Mock UserRepository userRepository;
    @Mock OrganizationRepository organizationRepository;

    @InjectMocks OrgCertificateService service;

    private IssueCertificateRequest req(String level, Integer score, String note) {
        return new IssueCertificateRequest(CLASS_ID, STUDENT_ID, level, score, note);
    }

    private User userMock(String displayName) {
        User u = org.mockito.Mockito.mock(User.class);
        when(u.getDisplayName()).thenReturn(displayName);
        return u;
    }

    @Test
    @DisplayName("issue: happy path snapshot co-brand + tên HV/GV, sinh token + mã, active=true")
    void issue_happyPath_snapshotsEverything() {
        when(classStudentRepository.existsByIdClassIdAndIdStudentId(CLASS_ID, STUDENT_ID)).thenReturn(true);
        User student = userMock("Nguyễn Văn A");
        when(student.getId()).thenReturn(STUDENT_ID);
        User issuer = userMock("Cô Lan");
        when(issuer.getOrgId()).thenReturn(ORG_ID);
        when(userRepository.findById(STUDENT_ID)).thenReturn(Optional.of(student));
        when(userRepository.findById(ISSUER_ID)).thenReturn(Optional.of(issuer));
        when(organizationRepository.findById(ORG_ID)).thenReturn(Optional.of(
                Organization.builder().name("Trung tâm ABC").slug("abc").logoUrl("https://cdn/abc.png").build()));
        when(certificateRepository.save(any(OrgCertificate.class))).thenAnswer(inv -> inv.getArgument(0));

        CertificateDto dto = service.issue(ISSUER_ID, req("b1", 88, "  Tiến bộ rõ rệt  "));

        assertThat(dto.studentName()).isEqualTo("Nguyễn Văn A");
        assertThat(dto.cefrLevel()).isEqualTo("B1");
        assertThat(dto.score()).isEqualTo(88);
        assertThat(dto.note()).isEqualTo("Tiến bộ rõ rệt"); // trimmed
        assertThat(dto.orgName()).isEqualTo("Trung tâm ABC");
        assertThat(dto.orgLogoUrl()).isEqualTo("https://cdn/abc.png");
        assertThat(dto.issuedByName()).isEqualTo("Cô Lan");
        assertThat(dto.active()).isTrue();
        assertThat(dto.verifyToken()).isNotBlank().doesNotContain("-");
        assertThat(dto.certificateCode()).startsWith("DF-B1-").contains(dto.verifyToken().substring(0, 8).toUpperCase());

        ArgumentCaptor<OrgCertificate> saved = ArgumentCaptor.forClass(OrgCertificate.class);
        verify(certificateRepository).save(saved.capture());
        OrgCertificate row = saved.getValue();
        assertThat(row.getStudentUserId()).isEqualTo(STUDENT_ID);
        assertThat(row.getStudentNameSnapshot()).isEqualTo("Nguyễn Văn A");
        assertThat(row.getOrgId()).isEqualTo(ORG_ID);
        assertThat(row.getOrgNameSnapshot()).isEqualTo("Trung tâm ABC");
        assertThat(row.getClassId()).isEqualTo(CLASS_ID);
        assertThat(row.isActive()).isTrue();
    }

    @Test
    @DisplayName("issue: GV không sở hữu lớp → Forbidden, KHÔNG lưu")
    void issue_notOwner_throwsForbidden() {
        doThrow(new ForbiddenException("Bạn không có quyền xem lớp này"))
                .when(teacherService).assertTeacherOwnsClass(ISSUER_ID, CLASS_ID);

        assertThatThrownBy(() -> service.issue(ISSUER_ID, req("B1", null, null)))
                .isInstanceOf(ForbiddenException.class);
        verify(certificateRepository, never()).save(any());
    }

    @Test
    @DisplayName("issue: HV không thuộc lớp → BadRequest, KHÔNG lưu")
    void issue_studentNotInClass_throwsBadRequest() {
        when(classStudentRepository.existsByIdClassIdAndIdStudentId(CLASS_ID, STUDENT_ID)).thenReturn(false);

        assertThatThrownBy(() -> service.issue(ISSUER_ID, req("B1", null, null)))
                .isInstanceOf(BadRequestException.class);
        verify(certificateRepository, never()).save(any());
    }

    @Test
    @DisplayName("issue: CEFR không hợp lệ → BadRequest (chặn trước cả authz)")
    void issue_invalidLevel_throwsBadRequest() {
        assertThatThrownBy(() -> service.issue(ISSUER_ID, req("Z9", null, null)))
                .isInstanceOf(BadRequestException.class);
        verify(teacherService, never()).assertTeacherOwnsClass(anyLong(), anyLong());
    }

    @Test
    @DisplayName("issue: điểm ngoài 0–100 → BadRequest")
    void issue_scoreOutOfRange_throwsBadRequest() {
        assertThatThrownBy(() -> service.issue(ISSUER_ID, req("B1", 150, null)))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    @DisplayName("issue: GV không thuộc org → vẫn cấp được, không co-brand (orgName null)")
    void issue_noOrg_issuesWithoutCoBrand() {
        when(classStudentRepository.existsByIdClassIdAndIdStudentId(CLASS_ID, STUDENT_ID)).thenReturn(true);
        User student = userMock("Trần Thị B");
        when(student.getId()).thenReturn(STUDENT_ID);
        User issuer = userMock("Thầy Nam");
        when(issuer.getOrgId()).thenReturn(null); // no org → no co-brand, no lookup
        when(userRepository.findById(STUDENT_ID)).thenReturn(Optional.of(student));
        when(userRepository.findById(ISSUER_ID)).thenReturn(Optional.of(issuer));
        when(certificateRepository.save(any(OrgCertificate.class))).thenAnswer(inv -> inv.getArgument(0));

        CertificateDto dto = service.issue(ISSUER_ID, req("A2", null, null));

        assertThat(dto.orgName()).isNull();
        assertThat(dto.orgLogoUrl()).isNull();
        assertThat(dto.cefrLevel()).isEqualTo("A2");
        assertThat(dto.active()).isTrue();
        verify(organizationRepository, never()).findById(anyLong());
    }

    @Test
    @DisplayName("getByToken: cert ACTIVE → trả DTO")
    void getByToken_active_returnsDto() {
        when(certificateRepository.findByVerifyToken("tok123")).thenReturn(Optional.of(
                OrgCertificate.builder()
                        .verifyToken("tok123").certificateCode("DF-B1-2026-TOK12345")
                        .studentNameSnapshot("HV X").cefrLevel("B1").active(true).build()));

        CertificateDto dto = service.getByToken("tok123");

        assertThat(dto.studentName()).isEqualTo("HV X");
        assertThat(dto.cefrLevel()).isEqualTo("B1");
    }

    @Test
    @DisplayName("getByToken: không tồn tại → NotFound")
    void getByToken_missing_throwsNotFound() {
        when(certificateRepository.findByVerifyToken("nope")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.getByToken("nope")).isInstanceOf(NotFoundException.class);
    }

    @Test
    @DisplayName("getByToken: cert đã thu hồi (inactive) → NotFound")
    void getByToken_revoked_throwsNotFound() {
        when(certificateRepository.findByVerifyToken("rev")).thenReturn(Optional.of(
                OrgCertificate.builder().verifyToken("rev").active(false).build()));

        assertThatThrownBy(() -> service.getByToken("rev")).isInstanceOf(NotFoundException.class);
    }

    @Test
    @DisplayName("revoke: GV sở hữu lớp → set active=false")
    void revoke_setsInactive() {
        OrgCertificate cert = OrgCertificate.builder()
                .verifyToken("t").classId(CLASS_ID).active(true).build();
        when(certificateRepository.findById(7L)).thenReturn(Optional.of(cert));

        service.revoke(ISSUER_ID, 7L);

        assertThat(cert.isActive()).isFalse();
        verify(teacherService).assertTeacherOwnsClass(ISSUER_ID, CLASS_ID);
        verify(certificateRepository).save(cert);
    }

    @Test
    @DisplayName("revoke: GV không sở hữu lớp của cert → Forbidden, KHÔNG đổi active, KHÔNG lưu")
    void revoke_notOwner_throwsForbidden() {
        OrgCertificate cert = OrgCertificate.builder().classId(CLASS_ID).active(true).build();
        when(certificateRepository.findById(7L)).thenReturn(Optional.of(cert));
        doThrow(new ForbiddenException("Bạn không có quyền xem lớp này"))
                .when(teacherService).assertTeacherOwnsClass(ISSUER_ID, CLASS_ID);

        assertThatThrownBy(() -> service.revoke(ISSUER_ID, 7L)).isInstanceOf(ForbiddenException.class);
        assertThat(cert.isActive()).isTrue();
        verify(certificateRepository, never()).save(any());
    }
}
