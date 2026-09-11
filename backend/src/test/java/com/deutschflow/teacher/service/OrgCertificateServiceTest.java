package com.deutschflow.teacher.service;

import com.deutschflow.common.audit.AuditActor;
import com.deutschflow.common.audit.AuditLogService;
import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.common.exception.ForbiddenException;
import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.common.exception.OrgReadOnlyException;
import com.deutschflow.organization.dto.OrgCertificateRowDto;
import com.deutschflow.organization.entity.Organization;
import com.deutschflow.organization.repository.OrganizationRepository;
import com.deutschflow.organization.service.OrgGuard;
import com.deutschflow.organization.service.OrgLicenseState;
import com.deutschflow.teacher.dto.CertificateDto;
import com.deutschflow.teacher.dto.IssueCertificateRequest;
import com.deutschflow.teacher.entity.OrgCertificate;
import com.deutschflow.teacher.entity.TeacherClass;
import com.deutschflow.teacher.repository.ClassStudentRepository;
import com.deutschflow.teacher.repository.OrgCertificateRepository;
import com.deutschflow.teacher.repository.TeacherClassRepository;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * Khoá hành vi của {@link OrgCertificateService} (D5 cert-lite co-brand + DEC-20): xác thực đầu
 * vào, guard quyền (sở hữu lớp + HV thuộc lớp; giám đốc theo trung tâm), snapshot co-brand/tên,
 * verify công khai (kể cả đã thu hồi), và VẾT cấp/thu hồi không mang tên học viên hay điểm.
 */
@ExtendWith(MockitoExtension.class)
class OrgCertificateServiceTest {

    private static final long ISSUER_ID = 99L;
    private static final long OWNER_ID = 77L;
    private static final long CLASS_ID = 10L;
    private static final long STUDENT_ID = 20L;
    private static final long ORG_ID = 5L;
    private static final long CERT_ID = 7L;
    private static final String CLASS_NAME = "B1 tối thứ Ba";

    private static final AuditActor ISSUER = new AuditActor(ISSUER_ID, "gv@tt.vn", "TEACHER");
    private static final AuditActor OWNER = new AuditActor(OWNER_ID, "giamdoc@tt.vn", "OWNER");

    @Mock OrgCertificateRepository certificateRepository;
    @Mock TeacherService teacherService;
    @Mock ClassStudentRepository classStudentRepository;
    @Mock TeacherClassRepository classRepository;
    @Mock UserRepository userRepository;
    @Mock OrganizationRepository organizationRepository;
    @Mock OrgGuard orgGuard;
    @Mock AuditLogService auditLogService;

    @InjectMocks OrgCertificateService service;

    /** A class stamped with the given org (audit M-7 co-brand source). */
    private void stubClassOrg(Long orgId) {
        TeacherClass cls = org.mockito.Mockito.mock(TeacherClass.class);
        when(cls.getOrgId()).thenReturn(orgId);
        when(classRepository.findById(CLASS_ID)).thenReturn(Optional.of(cls));
    }

    /** Tên lớp cho dòng sổ trung tâm — MỘT truy vấn findAllById. */
    private void stubClassName() {
        when(classRepository.findAllById(any())).thenReturn(
                List.of(TeacherClass.builder().id(CLASS_ID).name(CLASS_NAME).build()));
    }

    private IssueCertificateRequest req(String level, Integer score, String note) {
        return new IssueCertificateRequest(CLASS_ID, STUDENT_ID, level, score, note);
    }

    private User userMock(String displayName) {
        User u = org.mockito.Mockito.mock(User.class);
        when(u.getDisplayName()).thenReturn(displayName);
        return u;
    }

    private OrgCertificate orgCert(boolean active) {
        return OrgCertificate.builder()
                .id(CERT_ID).verifyToken("tok").certificateCode("DF-B1-2026-TOK00000")
                .classId(CLASS_ID).orgId(ORG_ID).studentUserId(STUDENT_ID)
                .studentNameSnapshot("Nguyễn Văn A").cefrLevel("B1").score(88)
                .issuedByUserId(ISSUER_ID).issuedByNameSnapshot("Cô Lan")
                .active(active).build();
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> capturedMetadata(String event, AuditActor actor) {
        ArgumentCaptor<Map<String, Object>> meta = ArgumentCaptor.forClass(Map.class);
        verify(auditLogService).log(eq(event), eq(actor), eq(OrgCertificateService.AUDIT_TARGET_TYPE),
                any(), meta.capture());
        return meta.getValue();
    }

    // ── issue ────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("issue: happy path snapshot co-brand + tên HV/GV, sinh token + mã, active=true, GHI VẾT không tên/điểm")
    void issue_happyPath_snapshotsEverythingAndAudits() {
        when(classStudentRepository.existsByIdClassIdAndIdStudentId(CLASS_ID, STUDENT_ID)).thenReturn(true);
        User student = userMock("Nguyễn Văn A");
        when(student.getId()).thenReturn(STUDENT_ID);
        User issuer = userMock("Cô Lan");
        stubClassOrg(ORG_ID);   // M-7: co-brand comes from the class's org, not the issuer's
        when(userRepository.findById(STUDENT_ID)).thenReturn(Optional.of(student));
        when(userRepository.findById(ISSUER_ID)).thenReturn(Optional.of(issuer));
        when(organizationRepository.findById(ORG_ID)).thenReturn(Optional.of(
                Organization.builder().name("Trung tâm ABC").slug("abc").logoUrl("https://cdn/abc.png").build()));
        when(certificateRepository.save(any(OrgCertificate.class))).thenAnswer(inv -> inv.getArgument(0));

        CertificateDto dto = service.issue(ISSUER, req("b1", 88, "  Tiến bộ rõ rệt  "));

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

        // DEC-13: vết mang định danh + trình độ, KHÔNG tên học viên, KHÔNG điểm, KHÔNG nhận xét.
        Map<String, Object> meta = capturedMetadata(OrgCertificateService.EVENT_ISSUED, ISSUER);
        assertThat(meta).containsEntry("classId", CLASS_ID)
                .containsEntry("studentUserId", STUDENT_ID)
                .containsEntry("orgId", ORG_ID)
                .containsEntry("cefrLevel", "B1")
                .doesNotContainKeys("studentName", "score", "note");
        assertThat(meta.toString()).doesNotContain("Nguyễn Văn A").doesNotContain("88");
    }

    @Test
    @DisplayName("issue: thiếu actor (id null) → BadRequest, không đụng DB")
    void issue_missingActor_throwsBadRequest() {
        assertThatThrownBy(() -> service.issue(null, req("B1", null, null)))
                .isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> service.issue(new AuditActor(null, "x@y", "TEACHER"), req("B1", null, null)))
                .isInstanceOf(BadRequestException.class);
        verifyNoInteractions(certificateRepository, auditLogService);
    }

    @Test
    @DisplayName("issue: GV không sở hữu lớp → Forbidden, KHÔNG lưu, KHÔNG vết")
    void issue_notOwner_throwsForbidden() {
        doThrow(new ForbiddenException("Bạn không có quyền xem lớp này"))
                .when(teacherService).assertPrimaryTeacherOfClass(ISSUER_ID, CLASS_ID);

        assertThatThrownBy(() -> service.issue(ISSUER, req("B1", null, null)))
                .isInstanceOf(ForbiddenException.class);
        verify(certificateRepository, never()).save(any());
        verifyNoInteractions(auditLogService);
    }

    @Test
    @DisplayName("issue: HV không thuộc lớp → BadRequest, KHÔNG lưu")
    void issue_studentNotInClass_throwsBadRequest() {
        when(classStudentRepository.existsByIdClassIdAndIdStudentId(CLASS_ID, STUDENT_ID)).thenReturn(false);

        assertThatThrownBy(() -> service.issue(ISSUER, req("B1", null, null)))
                .isInstanceOf(BadRequestException.class);
        verify(certificateRepository, never()).save(any());
    }

    @Test
    @DisplayName("issue: CEFR không hợp lệ → BadRequest (chặn trước cả authz)")
    void issue_invalidLevel_throwsBadRequest() {
        assertThatThrownBy(() -> service.issue(ISSUER, req("Z9", null, null)))
                .isInstanceOf(BadRequestException.class);
        verify(teacherService, never()).assertPrimaryTeacherOfClass(anyLong(), anyLong());
    }

    @Test
    @DisplayName("issue: điểm ngoài 0–100 → BadRequest")
    void issue_scoreOutOfRange_throwsBadRequest() {
        assertThatThrownBy(() -> service.issue(ISSUER, req("B1", 150, null)))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    @DisplayName("issue: lớp không thuộc org → vẫn cấp được, không co-brand (orgName null)")
    void issue_noOrg_issuesWithoutCoBrand() {
        when(classStudentRepository.existsByIdClassIdAndIdStudentId(CLASS_ID, STUDENT_ID)).thenReturn(true);
        User student = userMock("Trần Thị B");
        when(student.getId()).thenReturn(STUDENT_ID);
        User issuer = userMock("Thầy Nam");
        stubClassOrg(null); // class has no org → no co-brand, no org lookup (M-7)
        when(userRepository.findById(STUDENT_ID)).thenReturn(Optional.of(student));
        when(userRepository.findById(ISSUER_ID)).thenReturn(Optional.of(issuer));
        when(certificateRepository.save(any(OrgCertificate.class))).thenAnswer(inv -> inv.getArgument(0));

        CertificateDto dto = service.issue(ISSUER, req("A2", null, null));

        assertThat(dto.orgName()).isNull();
        assertThat(dto.orgLogoUrl()).isNull();
        assertThat(dto.cefrLevel()).isEqualTo("A2");
        assertThat(dto.active()).isTrue();
        verify(organizationRepository, never()).findById(anyLong());
    }

    // ── getByToken (verify công khai) ────────────────────────────────────────

    @Test
    @DisplayName("getByToken: cert ACTIVE → trả DTO active=true")
    void getByToken_active_returnsDto() {
        when(certificateRepository.findByVerifyToken("tok123")).thenReturn(Optional.of(
                OrgCertificate.builder()
                        .verifyToken("tok123").certificateCode("DF-B1-2026-TOK12345")
                        .studentNameSnapshot("HV X").cefrLevel("B1").active(true).build()));

        CertificateDto dto = service.getByToken("tok123");

        assertThat(dto.studentName()).isEqualTo("HV X");
        assertThat(dto.cefrLevel()).isEqualTo("B1");
        assertThat(dto.active()).isTrue();
    }

    @Test
    @DisplayName("getByToken: không tồn tại → NotFound")
    void getByToken_missing_throwsNotFound() {
        when(certificateRepository.findByVerifyToken("nope")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.getByToken("nope")).isInstanceOf(NotFoundException.class);
    }

    @Test
    @DisplayName("getByToken: cert đã thu hồi → vẫn trả DTO nhưng active=false (DEC-20: link báo 'đã thu hồi', không 404)")
    void getByToken_revoked_returnsInactiveDto() {
        when(certificateRepository.findByVerifyToken("rev")).thenReturn(Optional.of(
                OrgCertificate.builder().verifyToken("rev").certificateCode("DF-A2-2026-REV00000")
                        .studentNameSnapshot("HV Y").cefrLevel("A2").active(false).build()));

        CertificateDto dto = service.getByToken("rev");

        assertThat(dto.active()).isFalse();
        assertThat(dto.certificateCode()).isEqualTo("DF-A2-2026-REV00000");
    }

    // ── revokeByTeacher (đường cũ, GV phụ trách) ─────────────────────────────

    @Test
    @DisplayName("revokeByTeacher: GV phụ trách → active=false + vết by=TEACHER, không lý do")
    void revokeByTeacher_setsInactiveAndAudits() {
        OrgCertificate cert = orgCert(true);
        when(certificateRepository.findById(CERT_ID)).thenReturn(Optional.of(cert));

        service.revokeByTeacher(ISSUER, CERT_ID);

        assertThat(cert.isActive()).isFalse();
        verify(teacherService).assertPrimaryTeacherOfClass(ISSUER_ID, CLASS_ID);
        verify(certificateRepository).save(cert);
        Map<String, Object> meta = capturedMetadata(OrgCertificateService.EVENT_REVOKED, ISSUER);
        assertThat(meta).containsEntry("by", "TEACHER")
                .containsEntry("certificateId", CERT_ID)
                .containsEntry("studentUserId", STUDENT_ID)
                .doesNotContainKeys("reason", "studentName", "score");
        assertThat(meta.toString()).doesNotContain("Nguyễn Văn A");
    }

    @Test
    @DisplayName("revokeByTeacher: GV không phụ trách lớp của cert → Forbidden, KHÔNG đổi active, KHÔNG lưu, KHÔNG vết")
    void revokeByTeacher_notOwner_throwsForbidden() {
        OrgCertificate cert = orgCert(true);
        when(certificateRepository.findById(CERT_ID)).thenReturn(Optional.of(cert));
        doThrow(new ForbiddenException("Bạn không có quyền xem lớp này"))
                .when(teacherService).assertPrimaryTeacherOfClass(ISSUER_ID, CLASS_ID);

        assertThatThrownBy(() -> service.revokeByTeacher(ISSUER, CERT_ID)).isInstanceOf(ForbiddenException.class);
        assertThat(cert.isActive()).isTrue();
        verify(certificateRepository, never()).save(any());
        verifyNoInteractions(auditLogService);
    }

    @Test
    @DisplayName("revokeByTeacher: đã thu hồi rồi → idempotent, KHÔNG lưu, KHÔNG vết lần hai")
    void revokeByTeacher_alreadyRevoked_isIdempotent() {
        OrgCertificate cert = orgCert(false);
        when(certificateRepository.findById(CERT_ID)).thenReturn(Optional.of(cert));

        service.revokeByTeacher(ISSUER, CERT_ID);

        verify(certificateRepository, never()).save(any());
        verifyNoInteractions(auditLogService);
    }

    // ── revokeByOrgOwner (DEC-20) ─────────────────────────────────────────────

    @Test
    @DisplayName("revokeByOrgOwner: OWNER đúng trung tâm + lý do hợp lệ → active=false, vết by=OWNER mang lý do, không tên/điểm")
    void revokeByOrgOwner_happyPath() {
        OrgCertificate cert = orgCert(true);
        when(certificateRepository.findByIdAndOrgId(CERT_ID, ORG_ID)).thenReturn(Optional.of(cert));
        when(certificateRepository.save(any(OrgCertificate.class))).thenAnswer(inv -> inv.getArgument(0));
        stubClassName();

        OrgCertificateRowDto row = service.revokeByOrgOwner(OWNER, ORG_ID, CERT_ID, "  Cấp nhầm trình độ  ");

        assertThat(row.active()).isFalse();
        assertThat(row.id()).isEqualTo(CERT_ID);
        assertThat(row.className()).isEqualTo(CLASS_NAME);
        assertThat(row.studentName()).isEqualTo("Nguyễn Văn A");
        assertThat(cert.isActive()).isFalse();
        verify(orgGuard).assertOrgOwner(OWNER_ID, ORG_ID);
        verify(orgGuard).assertOrgWritable(ORG_ID);
        verify(certificateRepository).save(cert);
        Map<String, Object> meta = capturedMetadata(OrgCertificateService.EVENT_REVOKED, OWNER);
        assertThat(meta).containsEntry("by", "OWNER")
                .containsEntry("reason", "Cấp nhầm trình độ")
                .containsEntry("certificateId", CERT_ID)
                .containsEntry("classId", CLASS_ID)
                .containsEntry("studentUserId", STUDENT_ID)
                .containsEntry("orgId", ORG_ID)
                .doesNotContainKeys("studentName", "score", "note");
        assertThat(meta.toString()).doesNotContain("Nguyễn Văn A").doesNotContain("88");
    }

    @Test
    @DisplayName("revokeByOrgOwner: chứng nhận của trung tâm KHÁC → NotFound (không lộ tồn tại), KHÔNG lưu, KHÔNG vết")
    void revokeByOrgOwner_otherOrg_throwsNotFound() {
        when(certificateRepository.findByIdAndOrgId(CERT_ID, ORG_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.revokeByOrgOwner(OWNER, ORG_ID, CERT_ID, "Cấp nhầm trình độ"))
                .isInstanceOf(NotFoundException.class);
        verify(certificateRepository, never()).save(any());
        verifyNoInteractions(auditLogService);
    }

    @Test
    @DisplayName("revokeByOrgOwner: MANAGER (guard OWNER ném) → Forbidden, KHÔNG tra cert, KHÔNG lưu")
    void revokeByOrgOwner_manager_throwsForbidden() {
        doThrow(new ForbiddenException("Chỉ chủ sở hữu tổ chức mới được thao tác này"))
                .when(orgGuard).assertOrgOwner(OWNER_ID, ORG_ID);

        assertThatThrownBy(() -> service.revokeByOrgOwner(OWNER, ORG_ID, CERT_ID, "Cấp nhầm trình độ"))
                .isInstanceOf(ForbiddenException.class);
        verify(certificateRepository, never()).findByIdAndOrgId(anyLong(), anyLong());
        verify(certificateRepository, never()).save(any());
        verifyNoInteractions(auditLogService);
    }

    @Test
    @DisplayName("revokeByOrgOwner: trung tâm chỉ-đọc (đình chỉ/hết hạn) → ném ORG_READ_ONLY, KHÔNG lưu")
    void revokeByOrgOwner_readOnlyOrg_blocked() {
        doThrow(new OrgReadOnlyException(ORG_ID, OrgLicenseState.Reason.SUSPENDED))
                .when(orgGuard).assertOrgWritable(ORG_ID);

        assertThatThrownBy(() -> service.revokeByOrgOwner(OWNER, ORG_ID, CERT_ID, "Cấp nhầm trình độ"))
                .isInstanceOf(OrgReadOnlyException.class);
        verify(certificateRepository, never()).save(any());
        verifyNoInteractions(auditLogService);
    }

    @Test
    @DisplayName("revokeByOrgOwner: lý do trống / quá ngắn / quá dài → BadRequest TRƯỚC cả guard")
    void revokeByOrgOwner_invalidReason_throwsBadRequest() {
        for (String bad : new String[] {null, "", "   ", "abc", "x".repeat(301)}) {
            assertThatThrownBy(() -> service.revokeByOrgOwner(OWNER, ORG_ID, CERT_ID, bad))
                    .as("reason=%s", bad)
                    .isInstanceOf(BadRequestException.class);
        }
        verify(orgGuard, never()).assertOrgOwner(anyLong(), anyLong());
        verifyNoInteractions(certificateRepository, auditLogService);
    }

    @Test
    @DisplayName("revokeByOrgOwner: đã thu hồi rồi → idempotent: trả dòng active=false, KHÔNG lưu, KHÔNG vết lần hai")
    void revokeByOrgOwner_alreadyRevoked_isIdempotent() {
        OrgCertificate cert = orgCert(false);
        when(certificateRepository.findByIdAndOrgId(CERT_ID, ORG_ID)).thenReturn(Optional.of(cert));
        stubClassName();

        OrgCertificateRowDto row = service.revokeByOrgOwner(OWNER, ORG_ID, CERT_ID, "Cấp nhầm trình độ");

        assertThat(row.active()).isFalse();
        verify(certificateRepository, never()).save(any());
        verifyNoInteractions(auditLogService);
    }

    // ── listByOrg (DEC-20) ───────────────────────────────────────────────────

    @Test
    @DisplayName("listByOrg: guard org-admin, cắt q, kẹp page/size vào [0..] và [1..100], ghép tên lớp, phong bì {items,total,page,size}")
    void listByOrg_mapsRowsAndClampsPaging() {
        OrgCertificate cert = orgCert(true);
        ArgumentCaptor<Pageable> pageable = ArgumentCaptor.forClass(Pageable.class);
        when(certificateRepository.searchByOrg(eq(ORG_ID), isNull(), eq(Boolean.TRUE), eq("an"), pageable.capture()))
                .thenReturn(new PageImpl<>(List.of(cert), PageRequest.of(0, 100), 1));
        stubClassName();

        Map<String, Object> out = service.listByOrg(OWNER_ID, ORG_ID, null, true, "  an ", -3, 500);

        verify(orgGuard).assertOrgAdmin(OWNER_ID, ORG_ID);
        assertThat(pageable.getValue().getPageNumber()).isZero();
        assertThat(pageable.getValue().getPageSize()).isEqualTo(100);
        assertThat(out).containsEntry("total", 1L).containsEntry("page", 0).containsEntry("size", 100);
        @SuppressWarnings("unchecked")
        List<OrgCertificateRowDto> items = (List<OrgCertificateRowDto>) out.get("items");
        assertThat(items).hasSize(1);
        assertThat(items.get(0).className()).isEqualTo(CLASS_NAME);
        assertThat(items.get(0).studentName()).isEqualTo("Nguyễn Văn A");
        assertThat(items.get(0).issuedByName()).isEqualTo("Cô Lan");
        assertThat(items.get(0).verifyToken()).isEqualTo("tok");
        assertThat(items.get(0).active()).isTrue();
    }

    @Test
    @DisplayName("listByOrg: không phải OWNER/MANAGER → Forbidden, KHÔNG truy vấn")
    void listByOrg_notAdmin_throwsForbidden() {
        doThrow(new ForbiddenException("Chỉ quản trị viên tổ chức mới được thao tác này"))
                .when(orgGuard).assertOrgAdmin(OWNER_ID, ORG_ID);

        assertThatThrownBy(() -> service.listByOrg(OWNER_ID, ORG_ID, null, null, null, 0, 20))
                .isInstanceOf(ForbiddenException.class);
        verify(certificateRepository, never()).searchByOrg(anyLong(), any(), any(), anyString(), any());
    }

    // ── listByClass ──────────────────────────────────────────────────────────

    @Test
    @DisplayName("listByClass: GV không sở hữu lớp → Forbidden, KHÔNG truy vấn cert (L2)")
    void listByClass_notOwner_throwsForbidden() {
        doThrow(new ForbiddenException("Bạn không có quyền xem lớp này"))
                .when(teacherService).assertTeacherOwnsClass(ISSUER_ID, CLASS_ID);

        assertThatThrownBy(() -> service.listByClass(ISSUER_ID, CLASS_ID))
                .isInstanceOf(ForbiddenException.class);
        verify(certificateRepository, never()).findByClassIdOrderByCreatedAtDesc(anyLong());
    }

    // ─── D5: trung tâm chỉ-đọc không phát hành thêm chứng nhận ───────────────────────────────

    @Test
    @DisplayName("issue: trung tâm chỉ-đọc → ORG_READ_ONLY, KHÔNG lưu chứng nhận")
    void issue_readOnlyOrg_blocked() {
        doThrow(new com.deutschflow.common.exception.OrgReadOnlyException(9L, com.deutschflow.organization.service.OrgLicenseState.Reason.SUSPENDED))
                .when(orgGuard).assertClassOrgWritable(CLASS_ID);

        assertThatThrownBy(() -> service.issue(ISSUER, req("B1", null, null)))
                .isInstanceOf(com.deutschflow.common.exception.OrgReadOnlyException.class);
        verify(certificateRepository, never()).save(any());
    }

}
