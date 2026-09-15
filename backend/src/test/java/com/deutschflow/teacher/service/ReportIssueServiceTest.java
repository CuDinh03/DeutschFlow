package com.deutschflow.teacher.service;

import com.deutschflow.common.audit.AuditActor;
import com.deutschflow.common.audit.AuditLogService;
import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.common.exception.ForbiddenException;
import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.common.exception.OrgReadOnlyException;
import com.deutschflow.common.minor.ConsentState;
import com.deutschflow.common.minor.MinorLearnerService;
import com.deutschflow.common.minor.MinorPolicy;
import com.deutschflow.common.minor.ReportIssueBlockedException;
import com.deutschflow.common.minor.StudentConsent;
import com.deutschflow.notification.NotificationType;
import com.deutschflow.notification.entity.NotificationOutbox;
import com.deutschflow.notification.repository.NotificationOutboxRepository;
import com.deutschflow.organization.entity.OrgMember;
import com.deutschflow.organization.entity.Organization;
import com.deutschflow.organization.repository.OrganizationRepository;
import com.deutschflow.organization.service.OrgGuard;
import com.deutschflow.organization.service.OrgLicenseState;
import com.deutschflow.teacher.dto.ReportIssueDtos.PublicReportIssueDto;
import com.deutschflow.teacher.dto.ReportIssueDtos.ReportIssueDto;
import com.deutschflow.teacher.dto.ReportIssueDtos.ReportIssueSummaryDto;
import com.deutschflow.teacher.entity.ClassStudentId;
import com.deutschflow.teacher.entity.StudentReportIssue;
import com.deutschflow.teacher.entity.TeacherClass;
import com.deutschflow.teacher.repository.ClassStudentRepository;
import com.deutschflow.teacher.repository.ClassTeacherRepository;
import com.deutschflow.teacher.repository.StudentReportIssueRepository;
import com.deutschflow.teacher.repository.TeacherClassRepository;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicLong;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * Khoá hành vi {@link ReportIssueService} (PR-R2): cổng đồng ý theo tuổi (R6), phát hành lại = SUPERSEDED
 * (R2), token 40 hex + 30 ngày (R9), thông báo qua outbox (G2), vết mang định danh không nội dung (DEC-13),
 * thu hồi idempotent (R5), trang công khai 404 đồng nhất, và lộ token CHỈ khi ACTIVE.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class ReportIssueServiceTest {

    private static final long TEACHER_ID = 99L;
    private static final long OWNER_ID = 77L;
    private static final long CLASS_ID = 10L;
    private static final long STUDENT_ID = 20L;
    private static final long ORG_ID = 5L;
    private static final AuditActor TEACHER = new AuditActor(TEACHER_ID, "gv@tt.vn", "TEACHER");
    private static final AuditActor OWNER = new AuditActor(OWNER_ID, "gd@tt.vn", "OWNER");

    @Mock StudentReportIssueRepository issueRepository;
    @Mock TeacherService teacherService;
    @Mock TeacherClassRepository classRepository;
    @Mock ClassStudentRepository classStudentRepository;
    @Mock ClassTeacherRepository classTeacherRepository;
    @Mock UserRepository userRepository;
    @Mock OrganizationRepository organizationRepository;
    @Mock OrgGuard orgGuard;
    @Mock MinorLearnerService minorLearnerService;
    @Mock ReportPayloadBuilder payloadBuilder;
    @Mock AuditLogService auditLogService;
    @Mock NotificationOutboxRepository outboxRepository;

    @InjectMocks ReportIssueService service;

    private final AtomicLong ids = new AtomicLong(500);

    @BeforeEach
    void setUp() {
        when(classRepository.findById(CLASS_ID)).thenReturn(Optional.of(TeacherClass.builder()
                .id(CLASS_ID).orgId(ORG_ID).teacherId(TEACHER_ID).name("B1 tối").inviteCode("INV").build()));
        when(classStudentRepository.existsById(new ClassStudentId(CLASS_ID, STUDENT_ID))).thenReturn(true);
        when(userRepository.findById(STUDENT_ID)).thenReturn(Optional.of(user(STUDENT_ID, "Nguyễn Đức Ánh", User.Role.STUDENT)));
        when(userRepository.findById(TEACHER_ID)).thenReturn(Optional.of(user(TEACHER_ID, "Cô Hạnh", User.Role.TEACHER)));
        when(organizationRepository.findById(ORG_ID)).thenReturn(Optional.of(Organization.builder()
                .id(ORG_ID).name("TT Hoa Sen").slug("hoa-sen").logoUrl("https://cdn/logo.png").build()));
        when(minorLearnerService.statusOf(STUDENT_ID)).thenReturn(MinorPolicy.Status.ADULT);
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("class", Map.of("id", CLASS_ID, "name", "B1 tối"));
        payload.put("skills", List.of(Map.of("code", "HOREN", "score", 8.5, "grade", "GOOD")));
        when(payloadBuilder.build(any(), any(), any(), anyString(), any(), any(), any())).thenReturn(payload);
        when(issueRepository.findByClassIdAndStudentIdAndPeriodAndRevokedAtIsNull(anyLong(), anyLong(), any()))
                .thenReturn(List.of());
        when(issueRepository.save(any(StudentReportIssue.class))).thenAnswer(inv -> {
            StudentReportIssue i = inv.getArgument(0);
            if (i.getId() == null) {
                ReflectionTestUtils.setField(i, "id", ids.incrementAndGet());
            }
            return i;
        });
    }

    // ── Phát hành ───────────────────────────────────────────────────────────

    @Nested
    @DisplayName("issue()")
    class Issue {

        @Test
        @DisplayName("Người ≥ 18: không cần đồng ý; dòng mới có token 40 hex, hạn 30 ngày, snapshot tên/trung tâm, payload đóng băng")
        void adult_issuesWithoutConsent() {
            Instant before = Instant.now();
            ReportIssueDto dto = service.issue(TEACHER, CLASS_ID, STUDENT_ID, "midterm", null);

            verify(minorLearnerService, never()).consentStatus(anyLong(), any());
            ArgumentCaptor<StudentReportIssue> saved = ArgumentCaptor.forClass(StudentReportIssue.class);
            verify(issueRepository).save(saved.capture());
            StudentReportIssue i = saved.getValue();
            assertThat(i.getToken()).matches("[0-9a-f]{40}");
            assertThat(Duration.between(i.getIssuedAt(), i.getTokenExpiresAt())).isEqualTo(ReportIssueService.TOKEN_TTL);
            assertThat(i.getIssuedAt()).isAfterOrEqualTo(before.minusSeconds(1));
            assertThat(i.getOrgId()).isEqualTo(ORG_ID);
            assertThat(i.getOrgNameSnapshot()).isEqualTo("TT Hoa Sen");
            assertThat(i.getOrgLogoUrlSnapshot()).isEqualTo("https://cdn/logo.png");
            assertThat(i.getStudentNameSnapshot()).isEqualTo("Nguyễn Đức Ánh");
            assertThat(i.getIssuedByNameSnapshot()).isEqualTo("Cô Hạnh");
            assertThat(i.getIssuedBy()).isEqualTo(TEACHER_ID);
            assertThat(i.getPeriod()).isEqualTo(StudentReportIssue.Period.MIDTERM);
            assertThat(i.getLang()).as("lang trống ⇒ vi (R8)").isEqualTo("vi");
            assertThat(i.getPayload()).containsKey("skills");

            assertThat(dto.issue().status()).isEqualTo("ACTIVE");
            assertThat(dto.issue().token()).isEqualTo(i.getToken());
            assertThat(dto.issue().publicPath()).isEqualTo("/phieu/" + i.getToken() + "?lang=vi");
            assertThat(dto.issue().verificationCode()).isEqualTo(i.getToken().substring(0, 8).toUpperCase());
            assertThat(dto.issue().className()).isEqualTo("B1 tối");
            assertThat(dto.payload()).isSameAs(i.getPayload());
        }

        @Test
        @DisplayName("🔴 R2: phát hành lại cùng kỳ ⇒ dòng cũ SUPERSEDED (revoked_by NULL), dòng mới độc lập; kỳ khác không bị đụng")
        void reissue_supersedesPreviousOfSamePeriod() {
            StudentReportIssue old = issue(StudentReportIssue.Period.FINAL, Instant.now().minusSeconds(3600), null);
            when(issueRepository.findByClassIdAndStudentIdAndPeriodAndRevokedAtIsNull(CLASS_ID, STUDENT_ID, StudentReportIssue.Period.FINAL))
                    .thenReturn(List.of(old));

            service.issue(TEACHER, CLASS_ID, STUDENT_ID, "FINAL", "de");

            assertThat(old.isRevoked()).isTrue();
            assertThat(old.getRevokeReason()).isEqualTo(StudentReportIssue.REVOKE_SUPERSEDED);
            assertThat(old.getRevokedBy()).isNull();
            ArgumentCaptor<StudentReportIssue> saved = ArgumentCaptor.forClass(StudentReportIssue.class);
            verify(issueRepository, org.mockito.Mockito.times(2)).save(saved.capture());
            assertThat(saved.getAllValues().get(0)).isSameAs(old);
            StudentReportIssue fresh = saved.getAllValues().get(1);
            assertThat(fresh.isRevoked()).isFalse();
            assertThat(fresh.getToken()).isNotEqualTo(old.getToken());
            ArgumentCaptor<Map<String, Object>> meta = ArgumentCaptor.forClass(Map.class);
            verify(auditLogService).log(eq(ReportIssueService.EVENT_ISSUED), eq(TEACHER), eq(ReportIssueService.AUDIT_TARGET_TYPE),
                    eq(String.valueOf(fresh.getId())), eq(ORG_ID), meta.capture());
            assertThat(meta.getValue()).containsEntry("supersededCount", 1);
        }

        @Test
        @DisplayName("Thông báo REPORT_ISSUED vào outbox trong giao dịch: người nhận = học viên, payload không điểm/không nhận xét")
        void enqueuesStudentNotification_withoutContent() {
            service.issue(TEACHER, CLASS_ID, STUDENT_ID, "MIDTERM", "en");

            ArgumentCaptor<NotificationOutbox> row = ArgumentCaptor.forClass(NotificationOutbox.class);
            verify(outboxRepository).save(row.capture());
            NotificationOutbox n = row.getValue();
            assertThat(n.getNotificationType()).isEqualTo(NotificationType.REPORT_ISSUED);
            assertThat(n.getRecipientId()).isEqualTo(STUDENT_ID);
            assertThat(n.getClassId()).isEqualTo(CLASS_ID);
            assertThat(n.getDedupKey()).startsWith("report-issue:");
            assertThat(n.getPayload()).containsEntry("period", "MIDTERM").containsEntry("lang", "en")
                    .containsEntry("className", "B1 tối").containsKey("publicPath")
                    .doesNotContainKeys("skills", "score", "teacherComment", "payload");
        }

        @Test
        @DisplayName("Vết report.issued: org = org của LỚP (đóng băng), metadata chỉ định danh — không tên, không điểm, không nhận xét")
        void audit_identityOnly() {
            service.issue(TEACHER, CLASS_ID, STUDENT_ID, "MIDTERM", "vi");

            ArgumentCaptor<Map<String, Object>> meta = ArgumentCaptor.forClass(Map.class);
            verify(auditLogService).log(eq(ReportIssueService.EVENT_ISSUED), eq(TEACHER),
                    eq(ReportIssueService.AUDIT_TARGET_TYPE), anyString(), eq(ORG_ID), meta.capture());
            Map<String, Object> m = meta.getValue();
            assertThat(m).containsEntry("classId", CLASS_ID).containsEntry("studentUserId", STUDENT_ID)
                    .containsEntry("orgId", ORG_ID).containsEntry("period", "MIDTERM").containsEntry("lang", "vi")
                    .containsEntry("by", "TEACHER").containsKey("issueId");
            assertThat(String.valueOf(m)).doesNotContain("Nguyễn").doesNotContain("8.5").doesNotContain("skills");
        }

        @Test
        @DisplayName("Thứ tự cổng: không phải GV phụ trách ⇒ 403 trước khi dựng payload; trung tâm khoá ghi ⇒ ORG_READ_ONLY")
        void guardsBeforePayload() {
            doThrow(new ForbiddenException("Chỉ giáo viên chính")).when(teacherService).assertPrimaryTeacherOfClass(TEACHER_ID, CLASS_ID);
            assertThatThrownBy(() -> service.issue(TEACHER, CLASS_ID, STUDENT_ID, "MIDTERM", "vi"))
                    .isInstanceOf(ForbiddenException.class);
            verifyNoInteractions(payloadBuilder, outboxRepository, auditLogService);

            org.mockito.Mockito.reset(teacherService);
            doThrow(new OrgReadOnlyException(ORG_ID, OrgLicenseState.Reason.SUSPENDED)).when(orgGuard).assertOrgWritable(ORG_ID);
            assertThatThrownBy(() -> service.issue(TEACHER, CLASS_ID, STUDENT_ID, "MIDTERM", "vi"))
                    .isInstanceOf(OrgReadOnlyException.class);
            verifyNoInteractions(payloadBuilder);
        }

        @Test
        @DisplayName("Đầu vào: kỳ lạ / ngôn ngữ lạ / thiếu actor ⇒ 400; học viên ngoài lớp ⇒ 404")
        void inputValidation() {
            assertThatThrownBy(() -> service.issue(TEACHER, CLASS_ID, STUDENT_ID, "THANG10", "vi"))
                    .isInstanceOf(BadRequestException.class).hasMessageContaining("MIDTERM | FINAL");
            assertThatThrownBy(() -> service.issue(TEACHER, CLASS_ID, STUDENT_ID, "MIDTERM", "fr"))
                    .isInstanceOf(BadRequestException.class).hasMessageContaining("vi | en | de");
            assertThatThrownBy(() -> service.issue(new AuditActor(null, null, null), CLASS_ID, STUDENT_ID, "MIDTERM", "vi"))
                    .isInstanceOf(BadRequestException.class);
            when(classStudentRepository.existsById(new ClassStudentId(CLASS_ID, STUDENT_ID))).thenReturn(false);
            assertThatThrownBy(() -> service.issue(TEACHER, CLASS_ID, STUDENT_ID, "MIDTERM", "vi"))
                    .isInstanceOf(NotFoundException.class);
            verify(issueRepository, never()).save(any());
        }
    }

    // ── Cổng đồng ý theo tuổi (R6) ──────────────────────────────────────────

    @Nested
    @DisplayName("Cổng đồng ý GUARDIAN_REPORT_SHARING")
    class ConsentGate {

        @Test
        @DisplayName("🔴 17 tuổi (MINOR_CENTER_POLICY) chưa có đồng ý ⇒ 409 GUARDIAN_REPORT_CONSENT_REQUIRED, KHÔNG tạo dòng, không thông báo, không vết")
        void minorWithoutConsent_blocked() {
            when(minorLearnerService.statusOf(STUDENT_ID)).thenReturn(MinorPolicy.Status.MINOR_CENTER_POLICY);
            when(minorLearnerService.consentStatus(STUDENT_ID, StudentConsent.Scope.GUARDIAN_REPORT_SHARING))
                    .thenReturn(ConsentState.NEVER_RECORDED);

            assertThatThrownBy(() -> service.issue(TEACHER, CLASS_ID, STUDENT_ID, "MIDTERM", "vi"))
                    .isInstanceOf(ReportIssueBlockedException.class)
                    .extracting(ex -> ((ReportIssueBlockedException) ex).getReason())
                    .isEqualTo(ReportIssueBlockedException.Reason.GUARDIAN_REPORT_CONSENT_REQUIRED);
            verify(issueRepository, never()).save(any());
            verifyNoInteractions(outboxRepository, auditLogService, payloadBuilder);
        }

        @Test
        @DisplayName("Đồng ý đã THU HỒI ⇒ 409 GUARDIAN_REPORT_CONSENT_REVOKED (không mời đồng ý lại)")
        void minorRevokedConsent_blocked() {
            when(minorLearnerService.statusOf(STUDENT_ID)).thenReturn(MinorPolicy.Status.MINOR_LEGAL);
            when(minorLearnerService.consentStatus(STUDENT_ID, StudentConsent.Scope.GUARDIAN_REPORT_SHARING))
                    .thenReturn(ConsentState.REVOKED);

            assertThatThrownBy(() -> service.issue(TEACHER, CLASS_ID, STUDENT_ID, "MIDTERM", "vi"))
                    .isInstanceOf(ReportIssueBlockedException.class)
                    .extracting(ex -> ((ReportIssueBlockedException) ex).getReason())
                    .isEqualTo(ReportIssueBlockedException.Reason.GUARDIAN_REPORT_CONSENT_REVOKED);
        }

        @Test
        @DisplayName("Chưa khai ngày sinh ⇒ fail-closed 409 BIRTH_DATE_REQUIRED — không hỏi sổ đồng ý")
        void unknownAge_blocked() {
            when(minorLearnerService.statusOf(STUDENT_ID)).thenReturn(MinorPolicy.Status.UNKNOWN);

            assertThatThrownBy(() -> service.issue(TEACHER, CLASS_ID, STUDENT_ID, "MIDTERM", "vi"))
                    .isInstanceOf(ReportIssueBlockedException.class)
                    .extracting(ex -> ((ReportIssueBlockedException) ex).getReason())
                    .isEqualTo(ReportIssueBlockedException.Reason.BIRTH_DATE_REQUIRED);
            verify(minorLearnerService, never()).consentStatus(anyLong(), any());
        }

        @Test
        @DisplayName("Chưa thành niên CÓ đồng ý GRANTED ⇒ phát hành được (cả MINOR_LEGAL lẫn MINOR_CENTER_POLICY)")
        void minorWithConsent_allowed() {
            for (MinorPolicy.Status status : List.of(MinorPolicy.Status.MINOR_LEGAL, MinorPolicy.Status.MINOR_CENTER_POLICY)) {
                when(minorLearnerService.statusOf(STUDENT_ID)).thenReturn(status);
                when(minorLearnerService.consentStatus(STUDENT_ID, StudentConsent.Scope.GUARDIAN_REPORT_SHARING))
                        .thenReturn(ConsentState.GRANTED);
                ReportIssueDto dto = service.issue(TEACHER, CLASS_ID, STUDENT_ID, "FINAL", "vi");
                assertThat(dto.issue().status()).isEqualTo("ACTIVE");
            }
        }
    }

    // ── Thu hồi (R5) ───────────────────────────────────────────────────────

    @Nested
    @DisplayName("revokeByOrgAdmin()")
    class Revoke {

        @Test
        @DisplayName("OWNER thu hồi kèm lý do ⇒ mã OWNER, link chết, vết mang lý do; MANAGER ⇒ mã MANAGER")
        void revokes_withReasonInAudit() {
            StudentReportIssue i = issue(StudentReportIssue.Period.MIDTERM, Instant.now(), null);
            when(issueRepository.findByIdAndOrgId(i.getId(), ORG_ID)).thenReturn(Optional.of(i));
            when(orgGuard.assertMember(OWNER_ID, ORG_ID)).thenReturn(member("OWNER"));

            ReportIssueSummaryDto dto = service.revokeByOrgAdmin(OWNER, ORG_ID, i.getId(), "  Sai điểm nghe, phát hành lại  ");

            assertThat(dto.status()).isEqualTo("REVOKED");
            assertThat(dto.revokeReason()).isEqualTo(StudentReportIssue.REVOKE_BY_OWNER);
            assertThat(dto.token()).as("token không phát lại sau khi thu hồi").isNull();
            assertThat(dto.publicPath()).isNull();
            assertThat(i.getRevokedBy()).isEqualTo(OWNER_ID);
            verify(orgGuard).assertOrgAdmin(OWNER_ID, ORG_ID);
            verify(orgGuard).assertOrgWritable(ORG_ID);
            ArgumentCaptor<Map<String, Object>> meta = ArgumentCaptor.forClass(Map.class);
            verify(auditLogService).log(eq(ReportIssueService.EVENT_REVOKED), eq(OWNER), eq(ReportIssueService.AUDIT_TARGET_TYPE),
                    eq(String.valueOf(i.getId())), eq(ORG_ID), meta.capture());
            assertThat(meta.getValue()).containsEntry("by", "OWNER").containsEntry("reason", "Sai điểm nghe, phát hành lại");

            StudentReportIssue j = issue(StudentReportIssue.Period.FINAL, Instant.now(), null);
            when(issueRepository.findByIdAndOrgId(j.getId(), ORG_ID)).thenReturn(Optional.of(j));
            when(orgGuard.assertMember(OWNER_ID, ORG_ID)).thenReturn(member("MANAGER"));
            assertThat(service.revokeByOrgAdmin(OWNER, ORG_ID, j.getId(), "Nhân sự thu hồi").revokeReason())
                    .isEqualTo(StudentReportIssue.REVOKE_BY_MANAGER);
        }

        @Test
        @DisplayName("Idempotent: đã thu hồi rồi ⇒ trả dòng hiện tại, không ghi vết lần hai; lý do ngắn ⇒ 400 trước mọi guard; khác trung tâm ⇒ 404")
        void idempotent_validation_notFound() {
            StudentReportIssue i = issue(StudentReportIssue.Period.MIDTERM, Instant.now(), null);
            i.revoke(OWNER_ID, StudentReportIssue.REVOKE_BY_OWNER, Instant.now());
            when(issueRepository.findByIdAndOrgId(i.getId(), ORG_ID)).thenReturn(Optional.of(i));
            when(orgGuard.assertMember(OWNER_ID, ORG_ID)).thenReturn(member("OWNER"));

            ReportIssueSummaryDto dto = service.revokeByOrgAdmin(OWNER, ORG_ID, i.getId(), "Thu hồi lần hai");
            assertThat(dto.status()).isEqualTo("REVOKED");
            verifyNoInteractions(auditLogService);

            assertThatThrownBy(() -> service.revokeByOrgAdmin(OWNER, ORG_ID, i.getId(), "ngắn"))
                    .isInstanceOf(BadRequestException.class);
            verify(orgGuard, never()).assertOrgAdmin(OWNER_ID, 999L);

            when(issueRepository.findByIdAndOrgId(4242L, ORG_ID)).thenReturn(Optional.empty());
            assertThatThrownBy(() -> service.revokeByOrgAdmin(OWNER, ORG_ID, 4242L, "Không phải của tôi"))
                    .isInstanceOf(NotFoundException.class);
        }
    }

    // ── Trang công khai ─────────────────────────────────────────────────────

    @Nested
    @DisplayName("openByToken()")
    class PublicOpen {

        @Test
        @DisplayName("🔴 Sai hình dạng / không tồn tại / hết hạn / thu hồi ⇒ cùng MỘT 404; token sai hình dạng không chạm DB")
        void failClosed_uniform404() {
            when(issueRepository.findActiveByToken(anyString(), any())).thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.openByToken("abc")).isInstanceOf(NotFoundException.class)
                    .hasMessage(ReportIssueService.NOT_FOUND_MESSAGE);
            assertThatThrownBy(() -> service.openByToken("ZZ" + "0".repeat(38))).isInstanceOf(NotFoundException.class)
                    .hasMessage(ReportIssueService.NOT_FOUND_MESSAGE);
            verify(issueRepository, never()).findActiveByToken(anyString(), any());

            assertThatThrownBy(() -> service.openByToken("0".repeat(40))).isInstanceOf(NotFoundException.class)
                    .hasMessage(ReportIssueService.NOT_FOUND_MESSAGE);
            verify(issueRepository, never()).recordView(anyLong(), any());
            verifyNoInteractions(auditLogService);
        }

        @Test
        @DisplayName("Token đúng ⇒ payload + tăng lượt xem nguyên tử + vết report.viewed (actor ẩn danh, org đóng băng); không lộ token/id")
        void success_recordsViewAndAudits() {
            StudentReportIssue i = issue(StudentReportIssue.Period.FINAL, Instant.now(), null);
            when(issueRepository.findActiveByToken(eq(i.getToken()), any())).thenReturn(Optional.of(i));

            PublicReportIssueDto dto = service.openByToken(i.getToken());

            verify(issueRepository).recordView(eq(i.getId()), any());
            ArgumentCaptor<AuditActor> actor = ArgumentCaptor.forClass(AuditActor.class);
            ArgumentCaptor<Map<String, Object>> meta = ArgumentCaptor.forClass(Map.class);
            verify(auditLogService).log(eq(ReportIssueService.EVENT_VIEWED), actor.capture(),
                    eq(ReportIssueService.AUDIT_TARGET_TYPE), eq(String.valueOf(i.getId())), eq(ORG_ID), meta.capture());
            assertThat(actor.getValue().id()).isNull();
            assertThat(meta.getValue()).containsEntry("channel", "PUBLIC_LINK").doesNotContainKey("ip");
            assertThat(dto.studentName()).isEqualTo("Nguyễn Đức Ánh");
            assertThat(dto.orgName()).isEqualTo("TT Hoa Sen");
            assertThat(dto.verificationCode()).hasSize(8);
            assertThat(dto.payload()).containsKey("skills");
            assertThat(String.valueOf(dto)).doesNotContain(i.getToken());
        }
    }

    // ── Đọc / trạng thái ────────────────────────────────────────────────────

    @Test
    @DisplayName("listForStudentInClass: giáo viên của lớp OK; OWNER/MANAGER của trung tâm lớp OK; người khác 403")
    void listForStudentInClass_authz() {
        when(issueRepository.findByClassIdAndStudentIdOrderByIssuedAtDesc(CLASS_ID, STUDENT_ID)).thenReturn(List.of());

        when(classTeacherRepository.existsByIdClassIdAndIdTeacherId(CLASS_ID, TEACHER_ID)).thenReturn(true);
        assertThat(service.listForStudentInClass(TEACHER_ID, CLASS_ID, STUDENT_ID)).isEmpty();

        when(classTeacherRepository.existsByIdClassIdAndIdTeacherId(CLASS_ID, OWNER_ID)).thenReturn(false);
        assertThat(service.listForStudentInClass(OWNER_ID, CLASS_ID, STUDENT_ID)).isEmpty();
        verify(orgGuard).assertOrgAdmin(OWNER_ID, ORG_ID);

        long stranger = 4L;
        when(classTeacherRepository.existsByIdClassIdAndIdTeacherId(CLASS_ID, stranger)).thenReturn(false);
        doThrow(new ForbiddenException("no")).when(orgGuard).assertOrgAdmin(stranger, ORG_ID);
        assertThatThrownBy(() -> service.listForStudentInClass(stranger, CLASS_ID, STUDENT_ID))
                .isInstanceOf(ForbiddenException.class);
    }

    @Test
    @DisplayName("Trạng thái đọc được: ACTIVE lộ token/publicPath; EXPIRED / SUPERSEDED / REVOKED thì không; mã phiếu luôn có")
    void summary_statusAndTokenExposure() {
        Instant now = Instant.now();
        StudentReportIssue active = issue(StudentReportIssue.Period.MIDTERM, now, null);
        StudentReportIssue expired = issue(StudentReportIssue.Period.MIDTERM, now.minus(Duration.ofDays(31)), null);
        StudentReportIssue superseded = issue(StudentReportIssue.Period.MIDTERM, now, null);
        superseded.revoke(null, StudentReportIssue.REVOKE_SUPERSEDED, now);
        StudentReportIssue revoked = issue(StudentReportIssue.Period.MIDTERM, now, null);
        revoked.revoke(OWNER_ID, StudentReportIssue.REVOKE_BY_OWNER, now);

        assertThat(service.toSummary(active, now).status()).isEqualTo("ACTIVE");
        assertThat(service.toSummary(active, now).token()).isEqualTo(active.getToken());
        assertThat(service.toSummary(expired, now).status()).isEqualTo("EXPIRED");
        assertThat(service.toSummary(expired, now).token()).isNull();
        assertThat(service.toSummary(superseded, now).status()).isEqualTo("SUPERSEDED");
        assertThat(service.toSummary(superseded, now).publicPath()).isNull();
        assertThat(service.toSummary(revoked, now).status()).isEqualTo("REVOKED");
        assertThat(service.toSummary(revoked, now).verificationCode()).isEqualTo(revoked.getToken().substring(0, 8).toUpperCase());
    }

    @Test
    @DisplayName("Token: 40 hex chữ thường, ngẫu nhiên; looksLikeToken từ chối mọi thứ khác")
    void tokenShape() {
        String a = ReportIssueService.newToken();
        String b = ReportIssueService.newToken();
        assertThat(a).matches("[0-9a-f]{40}");
        assertThat(a).isNotEqualTo(b);
        assertThat(ReportIssueService.looksLikeToken(a)).isTrue();
        assertThat(ReportIssueService.looksLikeToken(a.toUpperCase())).isFalse();
        assertThat(ReportIssueService.looksLikeToken(a.substring(1))).isFalse();
        assertThat(ReportIssueService.looksLikeToken(null)).isFalse();
        assertThat(ReportIssueService.looksLikeToken(a + "0")).isFalse();
    }

    // ── helpers ─────────────────────────────────────────────────────────────

    private StudentReportIssue issue(StudentReportIssue.Period period, Instant issuedAt, Long revokedBy) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("class", Map.of("id", CLASS_ID, "name", "B1 tối"));
        payload.put("skills", List.of());
        StudentReportIssue i = StudentReportIssue.builder()
                .classId(CLASS_ID).studentId(STUDENT_ID).orgId(ORG_ID).period(period).lang("vi")
                .payload(payload).orgNameSnapshot("TT Hoa Sen").studentNameSnapshot("Nguyễn Đức Ánh")
                .issuedBy(TEACHER_ID).issuedByNameSnapshot("Cô Hạnh").issuedAt(issuedAt)
                .token(ReportIssueService.newToken()).tokenExpiresAt(issuedAt.plus(ReportIssueService.TOKEN_TTL))
                .build();
        ReflectionTestUtils.setField(i, "id", ids.incrementAndGet());
        return i;
    }

    private static OrgMember member(String role) {
        OrgMember m = new OrgMember();
        m.setRole(role);
        m.setStatus("ACTIVE");
        return m;
    }

    private static User user(long id, String name, User.Role role) {
        return User.builder().id(id).email("u" + id + "@test.local").passwordHash("x").displayName(name).role(role).build();
    }
}
