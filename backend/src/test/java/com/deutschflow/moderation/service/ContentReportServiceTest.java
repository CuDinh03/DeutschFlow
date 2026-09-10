package com.deutschflow.moderation.service;

import com.deutschflow.common.audit.AuditOrgResolver;
import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.common.exception.RateLimitExceededException;
import com.deutschflow.messaging.entity.ClassChannelMessage;
import com.deutschflow.messaging.entity.Message;
import com.deutschflow.messaging.repository.ClassChannelMessageRepository;
import com.deutschflow.messaging.repository.MessageRepository;
import com.deutschflow.moderation.dto.ModerationDtos.ReportRequest;
import com.deutschflow.moderation.entity.ContentReport;
import com.deutschflow.moderation.entity.ContentReport.Context;
import com.deutschflow.moderation.entity.ContentReport.Status;
import com.deutschflow.moderation.repository.ContentReportRepository;
import com.deutschflow.moderation.service.ContentReportService.ReportOutcome;
import com.deutschflow.moderation.service.ModerationRateLimiterService.Decision;
import com.deutschflow.teacher.repository.ClassStudentRepository;
import com.deutschflow.teacher.repository.ClassTeacherRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * GAP-12: report tin nhắn lớp chỉ dành cho thành viên lớp. Report sao chép nội dung tin vào
 * snapshot, nên thiếu bước kiểm này là một đường đọc tin của lớp khác chỉ bằng ID.
 *
 * <p>Từ 10/09/2026 (owner chốt): thêm ba lớp trên đường nộp — org ĐÓNG BĂNG theo người bị tố cáo,
 * khử trùng theo khoá khi còn PENDING, và throttle theo người — với thứ tự bắt buộc
 * ngữ cảnh → khử trùng → throttle → ghi. Các ca dưới chốt từng lớp và chốt cả thứ tự.
 */
@ExtendWith(MockitoExtension.class)
class ContentReportServiceTest {

    private static final long CLASS_ID = 7L;
    private static final long SENDER = 99L;
    private static final long REPORTER = 5L;
    private static final long MSG = 123L;
    private static final long ORG = 31L;

    @Mock ContentReportRepository reportRepository;
    @Mock MessageRepository messageRepository;
    @Mock ClassChannelMessageRepository classChannelMessageRepository;
    @Mock ClassStudentRepository classStudentRepository;
    @Mock ClassTeacherRepository classTeacherRepository;
    @Mock AuditOrgResolver orgResolver;
    @Mock ModerationRateLimiterService rateLimiter;
    @InjectMocks ContentReportService service;

    @BeforeEach
    void throttleAllowsByDefault() {
        // lenient: các ca 404 dừng TRƯỚC throttle nên stub này không được dùng — đó chính là điều
        // ca "ngữ cảnh trước throttle" muốn chứng minh, không phải stub thừa.
        lenient().when(rateLimiter.decide(anyLong())).thenReturn(Decision.allow());
    }

    private static ReportRequest classReport() {
        return new ReportRequest(Context.CLASS_MESSAGE, ContentReport.Reason.HARASSMENT,
                null, null, MSG, null, "chi tiết");
    }

    private static ReportRequest directReport() {
        return new ReportRequest(Context.DIRECT_MESSAGE, ContentReport.Reason.SPAM,
                null, MSG, null, null, null);
    }

    private static ReportRequest userReport(long targetUserId) {
        return new ReportRequest(Context.USER, ContentReport.Reason.OTHER,
                targetUserId, null, null, null, null);
    }

    private void stubMessage() {
        when(classChannelMessageRepository.findById(MSG)).thenReturn(Optional.of(ClassChannelMessage.builder()
                .id(MSG).classId(CLASS_ID).senderId(SENDER).body("tin trong lớp").build()));
    }

    private void stubClassMember() {
        stubMessage();
        when(classStudentRepository.existsByIdClassIdAndIdStudentId(CLASS_ID, REPORTER)).thenReturn(true);
    }

    private void stubSaveAssigningId(long id) {
        when(reportRepository.save(any())).thenAnswer(inv -> {
            ContentReport r = inv.getArgument(0);
            r.setId(id);
            return r;
        });
    }

    private ContentReport captureSaved() {
        ArgumentCaptor<ContentReport> saved = ArgumentCaptor.forClass(ContentReport.class);
        verify(reportRepository).save(saved.capture());
        return saved.getValue();
    }

    // ── GAP-12 / GAP-12b (giữ nguyên hành vi 404) ────────────────────────────

    @Test
    @DisplayName("người ngoài lớp report tin lớp → 404 và KHÔNG có report/snapshot nào được lưu")
    void outsiderCannotReportClassMessage() {
        stubMessage();
        when(classStudentRepository.existsByIdClassIdAndIdStudentId(CLASS_ID, REPORTER)).thenReturn(false);
        when(classTeacherRepository.existsByIdClassIdAndIdTeacherId(CLASS_ID, REPORTER)).thenReturn(false);

        // GAP-12b: người ngoài lớp nhận ĐÚNG lỗi như khi ID không tồn tại — không có cách nào
        // phân biệt "ID có thật ở lớp khác" với "ID không tồn tại".
        assertThrows(NotFoundException.class, () -> service.report(REPORTER, classReport()));

        verify(reportRepository, never()).save(any());
    }

    @Test
    @DisplayName("GAP-12b: ID không tồn tại và ID thuộc lớp khác ném CÙNG loại lỗi — không dò được ID")
    void unknownIdAndOutsiderAreIndistinguishable() {
        when(classChannelMessageRepository.findById(MSG)).thenReturn(Optional.empty());
        Throwable unknown = assertThrows(NotFoundException.class, () -> service.report(REPORTER, classReport()));

        stubMessage();
        when(classStudentRepository.existsByIdClassIdAndIdStudentId(CLASS_ID, REPORTER)).thenReturn(false);
        when(classTeacherRepository.existsByIdClassIdAndIdTeacherId(CLASS_ID, REPORTER)).thenReturn(false);
        Throwable outsider = assertThrows(NotFoundException.class, () -> service.report(REPORTER, classReport()));

        assertThat(unknown.getMessage()).isEqualTo(outsider.getMessage());
        verify(reportRepository, never()).save(any());
    }

    @Test
    @DisplayName("học viên trong lớp report được; snapshot và người bị báo lấy từ chính tin")
    void classStudentCanReport() {
        stubClassMember();
        stubSaveAssigningId(42L);

        ReportOutcome outcome = service.report(REPORTER, classReport());

        assertEquals(42L, outcome.id());
        assertThat(outcome.duplicate()).isFalse();
        ContentReport saved = captureSaved();
        assertEquals("tin trong lớp", saved.getSnapshotBody());
        assertEquals(SENDER, saved.getReportedUserId());
        assertEquals(REPORTER, saved.getReporterId());
    }

    @Test
    @DisplayName("giáo viên của lớp (không nằm trong class_students) cũng report được")
    void classTeacherCanReport() {
        stubMessage();
        when(classStudentRepository.existsByIdClassIdAndIdStudentId(CLASS_ID, REPORTER)).thenReturn(false);
        when(classTeacherRepository.existsByIdClassIdAndIdTeacherId(CLASS_ID, REPORTER)).thenReturn(true);
        stubSaveAssigningId(1L);

        assertEquals(1L, service.report(REPORTER, classReport()).id());
    }

    // ── Quyết định 3: org ĐÓNG BĂNG theo NGƯỜI BỊ TỐ CÁO ─────────────────────

    @Test
    @DisplayName("CLASS_MESSAGE: org_id = trung tâm của LỚP chứa tin")
    void classMessageFreezesClassOrg() {
        stubClassMember();
        when(orgResolver.forClass(CLASS_ID)).thenReturn(ORG);
        stubSaveAssigningId(1L);

        service.report(REPORTER, classReport());

        assertThat(captureSaved().getOrgId()).isEqualTo(ORG);
        verify(orgResolver, never()).forActiveMember(anyLong());
    }

    @Test
    @DisplayName("DIRECT_MESSAGE: org_id = membership ACTIVE của NGƯỜI GỬI (bị tố cáo), không phải của người tố cáo")
    void directMessageFreezesSenderOrg() {
        when(messageRepository.findById(MSG)).thenReturn(Optional.of(Message.builder()
                .id(MSG).senderId(SENDER).recipientId(REPORTER).body("tin riêng").build()));
        when(orgResolver.forActiveMember(SENDER)).thenReturn(ORG);
        stubSaveAssigningId(1L);

        service.report(REPORTER, directReport());

        ContentReport saved = captureSaved();
        assertThat(saved.getOrgId()).isEqualTo(ORG);
        assertThat(saved.getReportedUserId()).isEqualTo(SENDER);
        assertThat(saved.getSnapshotBody()).isEqualTo("tin riêng");
        verify(orgResolver, never()).forActiveMember(REPORTER);
    }

    @Test
    @DisplayName("USER: org_id = membership ACTIVE của người bị tố cáo; không có ⇒ NULL (B2C)")
    void userReportFreezesTargetOrgOrNull() {
        when(orgResolver.forActiveMember(77L)).thenReturn(null);
        stubSaveAssigningId(1L);

        service.report(REPORTER, userReport(77L));

        ContentReport saved = captureSaved();
        assertThat(saved.getOrgId()).isNull();
        assertThat(saved.getReportedUserId()).isEqualTo(77L);
        assertThat(saved.getSnapshotBody()).isNull();
        verify(orgResolver).forActiveMember(77L);
    }

    // ── B2: khử trùng ────────────────────────────────────────────────────────

    @Test
    @DisplayName("đã có báo cáo PENDING cùng khoá ⇒ trả id CŨ, duplicate=true, không tạo dòng, KHÔNG tính throttle")
    void pendingDuplicateReturnsOldIdWithoutSaveOrThrottle() {
        stubClassMember();
        when(reportRepository.findFirstByReporterIdAndContextAndClassMessageIdAndStatusOrderByCreatedAtDesc(
                REPORTER, Context.CLASS_MESSAGE, MSG, Status.PENDING))
                .thenReturn(Optional.of(ContentReport.builder().id(42L).status(Status.PENDING).build()));

        ReportOutcome outcome = service.report(REPORTER, classReport());

        assertThat(outcome.id()).isEqualTo(42L);
        assertThat(outcome.duplicate()).isTrue();
        verify(reportRepository, never()).save(any());
        // Bấm hai lần vì mạng chậm không phải lạm dụng — lần trùng không "mua" slot nào.
        verify(rateLimiter, never()).decide(anyLong());
    }

    @Test
    @DisplayName("khử trùng chỉ so với PENDING: repository được hỏi đúng Status.PENDING, không phải mọi trạng thái")
    void duplicateLookupIsPendingOnly() {
        stubClassMember();
        stubSaveAssigningId(1L);

        service.report(REPORTER, classReport());

        verify(reportRepository).findFirstByReporterIdAndContextAndClassMessageIdAndStatusOrderByCreatedAtDesc(
                REPORTER, Context.CLASS_MESSAGE, MSG, Status.PENDING);
    }

    // ── B2: throttle ─────────────────────────────────────────────────────────

    @Test
    @DisplayName("quá ngưỡng ⇒ 429 (RateLimitExceededException) mang Retry-After của limiter, không ghi gì")
    void throttledReportThrows429WithRetryAfter() {
        stubClassMember();
        when(rateLimiter.decide(REPORTER)).thenReturn(Decision.blocked(37));

        RateLimitExceededException ex = assertThrows(RateLimitExceededException.class,
                () -> service.report(REPORTER, classReport()));

        assertThat(ex.getRetryAfterSeconds()).isEqualTo(37);
        verify(reportRepository, never()).save(any());
    }

    @Test
    @DisplayName("thứ tự: ngữ cảnh TRƯỚC throttle — 404 không tiêu tốn slot (kẻ dò ID không mua được lượt)")
    void contextIsCheckedBeforeThrottle() {
        when(classChannelMessageRepository.findById(MSG)).thenReturn(Optional.empty());

        assertThrows(NotFoundException.class, () -> service.report(REPORTER, classReport()));

        verify(rateLimiter, never()).decide(anyLong());
    }
}
