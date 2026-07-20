package com.deutschflow.teacher.service;

import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.common.exception.ConflictException;
import com.deutschflow.common.exception.ForbiddenException;
import com.deutschflow.organization.service.OrgGuard;
import com.deutschflow.teacher.dto.TimesheetPeriodDtos.PeriodDto;
import com.deutschflow.teacher.entity.TeacherSessionRecord;
import com.deutschflow.teacher.entity.TeacherTimesheetPeriod;
import com.deutschflow.teacher.entity.TeacherTimesheetPeriod.Status;
import com.deutschflow.teacher.repository.TeacherSessionRecordRepository;
import com.deutschflow.teacher.repository.TeacherTimesheetPeriodRepository;
import com.deutschflow.user.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("TimesheetPeriodService — kỳ công, duyệt và khoá sổ")
class TimesheetPeriodServiceTest {

    @Mock private TeacherTimesheetPeriodRepository periodRepository;
    @Mock private TeacherSessionRecordRepository recordRepository;
    @Mock private UserRepository userRepository;
    @Mock private OrgGuard orgGuard;

    private TimesheetPeriodService service;

    private static final Long TEACHER_ID = 1L;
    private static final Long MANAGER_ID = 2L;
    private static final Long ORG_ID = 42L;
    private static final Long PERIOD_ID = 300L;
    private static final LocalDate START = LocalDate.of(2026, 7, 1);
    private static final LocalDate END = LocalDate.of(2026, 7, 31);

    @BeforeEach
    void setUp() {
        service = new TimesheetPeriodService(periodRepository, recordRepository, userRepository, orgGuard);
    }

    // ── vòng đời ──────────────────────────────────────────────────────────────

    @Test
    @DisplayName("submit() chốt số công tại thời điểm nộp — đó là con số manager sẽ xem")
    void submit_snapshotsTotals() {
        TeacherTimesheetPeriod p = period(Status.OPEN);
        when(periodRepository.findById(PERIOD_ID)).thenReturn(Optional.of(p));
        when(recordRepository
                .findByTeacherIdAndStartedAtGreaterThanEqualAndStartedAtLessThanOrderByStartedAt(
                        eq(TEACHER_ID), any(), any()))
                .thenReturn(List.of(
                        TeacherSessionRecord.builder().durationMinutes(90).build(),
                        TeacherSessionRecord.builder().durationMinutes(105).build()));
        when(periodRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        PeriodDto dto = service.submit(TEACHER_ID, PERIOD_ID);

        assertThat(dto.status()).isEqualTo("SUBMITTED");
        assertThat(dto.totalSessions()).isEqualTo(2);
        assertThat(dto.totalMinutes()).isEqualTo(195);
        assertThat(dto.editable()).isFalse();
    }

    @Test
    @DisplayName("submit() từ chối kỳ đã nộp (không nộp đè lên bản manager đang xem)")
    void submit_alreadySubmitted_isRejected() {
        when(periodRepository.findById(PERIOD_ID)).thenReturn(Optional.of(period(Status.SUBMITTED)));

        assertThatThrownBy(() -> service.submit(TEACHER_ID, PERIOD_ID))
                .isInstanceOf(ConflictException.class);
        verify(periodRepository, never()).save(any());
    }

    @Test
    @DisplayName("submit() cho phép nộp lại kỳ đã bị trả về, và xoá lý do trả cũ")
    void submit_afterReject_isAllowed() {
        TeacherTimesheetPeriod p = period(Status.REJECTED);
        p.setRejectReason("Thiếu buổi 12/07");
        when(periodRepository.findById(PERIOD_ID)).thenReturn(Optional.of(p));
        when(recordRepository
                .findByTeacherIdAndStartedAtGreaterThanEqualAndStartedAtLessThanOrderByStartedAt(
                        eq(TEACHER_ID), any(), any())).thenReturn(List.of());
        when(periodRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        PeriodDto dto = service.submit(TEACHER_ID, PERIOD_ID);

        assertThat(dto.status()).isEqualTo("SUBMITTED");
        assertThat(dto.rejectReason()).isNull();
    }

    @Test
    @DisplayName("approve() chốt LẠI số công tại thời điểm duyệt và ghi người duyệt")
    void approve_resnapshotsAndStampsReviewer() {
        TeacherTimesheetPeriod p = period(Status.SUBMITTED);
        when(periodRepository.findById(PERIOD_ID)).thenReturn(Optional.of(p));
        when(recordRepository
                .findByTeacherIdAndStartedAtGreaterThanEqualAndStartedAtLessThanOrderByStartedAt(
                        eq(TEACHER_ID), any(), any()))
                .thenReturn(List.of(TeacherSessionRecord.builder().durationMinutes(60).build()));
        when(periodRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        PeriodDto dto = service.approve(MANAGER_ID, ORG_ID, PERIOD_ID);

        assertThat(dto.status()).isEqualTo("APPROVED");
        assertThat(dto.totalMinutes()).isEqualTo(60);
        assertThat(p.getReviewedBy()).isEqualTo(MANAGER_ID);
        assertThat(p.getReviewedAt()).isNotNull();
    }

    @Test
    @DisplayName("approve() chỉ nhận kỳ đã nộp")
    void approve_notSubmitted_isRejected() {
        when(periodRepository.findById(PERIOD_ID)).thenReturn(Optional.of(period(Status.OPEN)));

        assertThatThrownBy(() -> service.approve(MANAGER_ID, ORG_ID, PERIOD_ID))
                .isInstanceOf(ConflictException.class);
    }

    @Test
    @DisplayName("reject() bắt buộc có lý do — giáo viên phải biết sửa gì")
    void reject_requiresReason() {
        assertThatThrownBy(() -> service.reject(MANAGER_ID, ORG_ID, PERIOD_ID, "  "))
                .isInstanceOf(BadRequestException.class);
        verify(periodRepository, never()).save(any());
    }

    @Test
    @DisplayName("reject() trả kỳ về cho giáo viên sửa, kèm lý do")
    void reject_returnsPeriodToTeacher() {
        TeacherTimesheetPeriod p = period(Status.SUBMITTED);
        when(periodRepository.findById(PERIOD_ID)).thenReturn(Optional.of(p));
        when(periodRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        PeriodDto dto = service.reject(MANAGER_ID, ORG_ID, PERIOD_ID, "Thiếu buổi 12/07");

        assertThat(dto.status()).isEqualTo("REJECTED");
        assertThat(dto.rejectReason()).isEqualTo("Thiếu buổi 12/07");
        assertThat(dto.editable()).isTrue();          // mở lại để sửa
    }

    @Test
    @DisplayName("lock() chỉ khoá được kỳ đã duyệt")
    void lock_onlyAfterApproved() {
        when(periodRepository.findById(PERIOD_ID)).thenReturn(Optional.of(period(Status.SUBMITTED)));
        assertThatThrownBy(() -> service.lock(MANAGER_ID, ORG_ID, PERIOD_ID))
                .isInstanceOf(ConflictException.class);
    }

    @Test
    @DisplayName("lock() đưa kỳ về trạng thái cuối")
    void lock_locksApprovedPeriod() {
        TeacherTimesheetPeriod p = period(Status.APPROVED);
        when(periodRepository.findById(PERIOD_ID)).thenReturn(Optional.of(p));
        when(periodRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        PeriodDto dto = service.lock(MANAGER_ID, ORG_ID, PERIOD_ID);

        assertThat(dto.status()).isEqualTo("LOCKED");
        assertThat(dto.editable()).isFalse();
    }

    // ── cách ly tổ chức ───────────────────────────────────────────────────────

    @Test
    @DisplayName("manager không duyệt được kỳ của tổ chức khác")
    void approve_crossOrg_isForbidden() {
        TeacherTimesheetPeriod other = period(Status.SUBMITTED);
        other.setOrgId(999L);                                   // kỳ thuộc org khác
        when(periodRepository.findById(PERIOD_ID)).thenReturn(Optional.of(other));

        assertThatThrownBy(() -> service.approve(MANAGER_ID, ORG_ID, PERIOD_ID))
                .isInstanceOf(ForbiddenException.class);
        verify(periodRepository, never()).save(any());
    }

    @Test
    @DisplayName("người không phải OWNER/MANAGER của tổ chức bị OrgGuard chặn trước mọi thao tác")
    void approve_notOrgAdmin_isBlockedByGuard() {
        doThrow(new ForbiddenException("không đủ quyền"))
                .when(orgGuard).assertOrgAdmin(MANAGER_ID, ORG_ID);

        assertThatThrownBy(() -> service.approve(MANAGER_ID, ORG_ID, PERIOD_ID))
                .isInstanceOf(ForbiddenException.class);
        verify(periodRepository, never()).findById(any());
    }

    // ── chốt khoá: thứ làm cho quy trình duyệt có nghĩa ───────────────────────

    @Test
    @DisplayName("assertRecordEditable() chặn sửa dòng công khi kỳ đã nộp/duyệt/khoá")
    void assertRecordEditable_blocksClosedPeriods() {
        for (Status closed : List.of(Status.SUBMITTED, Status.APPROVED, Status.LOCKED)) {
            when(periodRepository
                    .findByTeacherIdAndPeriodStartLessThanEqualAndPeriodEndGreaterThanEqual(
                            eq(TEACHER_ID), any(), any()))
                    .thenReturn(Optional.of(period(closed)));

            assertThatThrownBy(() -> service.assertRecordEditable(TEACHER_ID, LocalDate.of(2026, 7, 15)))
                    .as("trạng thái %s phải chặn", closed)
                    .isInstanceOf(ConflictException.class);
        }
    }

    @Test
    @DisplayName("assertRecordEditable() cho qua khi kỳ còn mở hoặc bị trả lại")
    void assertRecordEditable_allowsOpenAndRejected() {
        for (Status open : List.of(Status.OPEN, Status.REJECTED)) {
            when(periodRepository
                    .findByTeacherIdAndPeriodStartLessThanEqualAndPeriodEndGreaterThanEqual(
                            eq(TEACHER_ID), any(), any()))
                    .thenReturn(Optional.of(period(open)));

            assertThatCode(() -> service.assertRecordEditable(TEACHER_ID, LocalDate.of(2026, 7, 15)))
                    .as("trạng thái %s phải cho qua", open)
                    .doesNotThrowAnyException();
        }
    }

    @Test
    @DisplayName("assertRecordEditable() cho qua khi ngày đó chưa thuộc kỳ nào")
    void assertRecordEditable_noPeriod_allows() {
        when(periodRepository
                .findByTeacherIdAndPeriodStartLessThanEqualAndPeriodEndGreaterThanEqual(
                        eq(TEACHER_ID), any(), any()))
                .thenReturn(Optional.empty());

        assertThatCode(() -> service.assertRecordEditable(TEACHER_ID, LocalDate.of(2026, 7, 15)))
                .doesNotThrowAnyException();
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    private static TeacherTimesheetPeriod period(Status status) {
        return TeacherTimesheetPeriod.builder()
                .id(PERIOD_ID).teacherId(TEACHER_ID).orgId(ORG_ID)
                .periodStart(START).periodEnd(END)
                .status(status)
                .build();
    }
}
