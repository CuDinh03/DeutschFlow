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
    // Kỳ mẫu phải ĐÃ KẾT THÚC: submit() nay từ chối kỳ chưa hết hạn. Dùng ngày ĐỘNG thay vì ngày cứng
    // để test không tự hỏng khi thời gian trôi qua một mốc cố định.
    private static final LocalDate END = TeacherTimesheetService.todayVn().minusDays(1);
    private static final LocalDate START = END.minusDays(30);

    @BeforeEach
    void setUp() {
        service = new TimesheetPeriodService(periodRepository, recordRepository, userRepository, orgGuard);
    }

    // ── mở kỳ: chống chồng ngày (HIGH-3) ─────────────────────────────────────

    @Test
    @DisplayName("openPeriod() từ chối kỳ mới chồng ngày với kỳ đã có — chống trả lương hai lần + 500")
    void openPeriod_overlappingRange_isRejected() {
        LocalDate newStart = LocalDate.of(2026, 7, 15);   // chồng 15–31/07 với kỳ [01/07, 31/07]
        LocalDate newEnd = LocalDate.of(2026, 8, 15);
        when(periodRepository.findByTeacherIdAndPeriodStart(TEACHER_ID, newStart))
                .thenReturn(Optional.empty());
        when(periodRepository
                .findByTeacherIdAndPeriodStartLessThanEqualAndPeriodEndGreaterThanEqual(
                        eq(TEACHER_ID), any(), any()))
                .thenReturn(List.of(period(Status.OPEN)));   // kỳ [01/07, 31/07] đã tồn tại

        assertThatThrownBy(() -> service.openPeriod(TEACHER_ID, newStart, newEnd))
                .isInstanceOf(ConflictException.class)
                .hasMessageContaining("chồng lấp");

        verify(periodRepository, never()).save(any());
    }

    @Test
    @DisplayName("openPeriod() idempotent: mở lại cùng mốc bắt đầu trả về kỳ cũ, không tạo trùng")
    void openPeriod_sameStart_isReused() {
        when(periodRepository.findByTeacherIdAndPeriodStart(TEACHER_ID, START))
                .thenReturn(Optional.of(period(Status.OPEN)));

        PeriodDto dto = service.openPeriod(TEACHER_ID, START, END);

        assertThat(dto.periodStart()).isEqualTo(START);
        verify(periodRepository, never()).save(any());
    }

    @Test
    @DisplayName("openPeriod() tạo kỳ mới (upsert atomic) khi không chồng, snapshot org của giáo viên lúc mở")
    void openPeriod_nonOverlapping_createsAndSnapshotsOrg() {
        LocalDate newStart = LocalDate.of(2026, 8, 1);
        LocalDate newEnd = LocalDate.of(2026, 8, 31);
        TeacherTimesheetPeriod created = TeacherTimesheetPeriod.builder()
                .id(PERIOD_ID).teacherId(TEACHER_ID).orgId(ORG_ID)
                .periodStart(newStart).periodEnd(newEnd).status(Status.OPEN).build();
        when(periodRepository.findByTeacherIdAndPeriodStart(TEACHER_ID, newStart))
                .thenReturn(Optional.empty())        // lần 1: chưa có → đi tạo
                .thenReturn(Optional.of(created));   // lần 2: sau insertIfAbsent → tra lại
        when(periodRepository
                .findByTeacherIdAndPeriodStartLessThanEqualAndPeriodEndGreaterThanEqual(
                        eq(TEACHER_ID), any(), any()))
                .thenReturn(List.of());
        when(userRepository.findById(TEACHER_ID)).thenReturn(Optional.of(
                com.deutschflow.user.entity.User.builder().id(TEACHER_ID).orgId(ORG_ID).build()));

        PeriodDto dto = service.openPeriod(TEACHER_ID, newStart, newEnd);

        // Chèn atomic với org snapshot từ user, KHÔNG dùng save() nữa.
        verify(periodRepository).insertIfAbsent(TEACHER_ID, ORG_ID, newStart, newEnd);
        verify(periodRepository, never()).save(any());
        assertThat(dto.status()).isEqualTo("OPEN");
        assertThat(dto.periodStart()).isEqualTo(newStart);
        assertThat(dto.periodEnd()).isEqualTo(newEnd);
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
                        TeacherSessionRecord.builder().orgId(ORG_ID).durationMinutes(90).build(),
                        TeacherSessionRecord.builder().orgId(ORG_ID).durationMinutes(105).build()));
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
    @DisplayName("submit() KHÔNG dồn công org khác vào kỳ — chống rò payroll xuyên tổ chức")
    void submit_excludesCrossOrgRecords() {
        TeacherTimesheetPeriod p = period(Status.OPEN);   // orgId = ORG_ID (42)
        when(periodRepository.findById(PERIOD_ID)).thenReturn(Optional.of(p));
        when(recordRepository
                .findByTeacherIdAndStartedAtGreaterThanEqualAndStartedAtLessThanOrderByStartedAt(
                        eq(TEACHER_ID), any(), any()))
                .thenReturn(List.of(
                        TeacherSessionRecord.builder().orgId(ORG_ID).durationMinutes(90).build(),  // cùng org → tính
                        TeacherSessionRecord.builder().orgId(999L).durationMinutes(105).build(),   // org khác → loại
                        TeacherSessionRecord.builder().durationMinutes(60).build()));              // org=null → LOẠI
        when(periodRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        PeriodDto dto = service.submit(TEACHER_ID, PERIOD_ID);

        // FAIL-CLOSED: kỳ của org 42 chỉ tính dòng công của chính org 42. Dòng công org=null (lớp tư,
        // hoặc lớp chưa gắn tổ chức) KHÔNG được trung tâm trả — trả thiếu dễ phát hiện hơn trả thừa.
        assertThat(dto.totalSessions()).isEqualTo(1);
        assertThat(dto.totalMinutes()).isEqualTo(90);
    }

    @Test
    @DisplayName("submit() từ chối kỳ CHƯA kết thúc — nộp sớm sẽ đóng băng vĩnh viễn phần còn lại của kỳ")
    void submit_beforePeriodEnd_isRejected() {
        TeacherTimesheetPeriod p = period(Status.OPEN);
        p.setPeriodEnd(TeacherTimesheetService.todayVn().plusDays(5));   // kỳ còn 5 ngày nữa mới hết
        when(periodRepository.findById(PERIOD_ID)).thenReturn(Optional.of(p));

        assertThatThrownBy(() -> service.submit(TEACHER_ID, PERIOD_ID))
                .isInstanceOf(ConflictException.class)
                .hasMessageContaining("chưa nộp được");

        verify(periodRepository, never()).save(any());
    }

    @Test
    @DisplayName("approve() chốt LẠI số công tại thời điểm duyệt và ghi người duyệt")
    void approve_resnapshotsAndStampsReviewer() {
        TeacherTimesheetPeriod p = period(Status.SUBMITTED);
        when(periodRepository.findById(PERIOD_ID)).thenReturn(Optional.of(p));
        when(recordRepository
                .findByTeacherIdAndStartedAtGreaterThanEqualAndStartedAtLessThanOrderByStartedAt(
                        eq(TEACHER_ID), any(), any()))
                .thenReturn(List.of(TeacherSessionRecord.builder().orgId(ORG_ID).durationMinutes(60).build()));
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
                    .thenReturn(List.of(period(closed)));

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
                    .thenReturn(List.of(period(open)));

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
                .thenReturn(List.of());

        assertThatCode(() -> service.assertRecordEditable(TEACHER_ID, LocalDate.of(2026, 7, 15)))
                .doesNotThrowAnyException();
    }

    @Test
    @DisplayName("orgSummary() đếm đúng giáo viên (distinct) và cộng tổng buổi/phút toàn tổ chức")
    void orgSummary_aggregatesAcrossTeachers() {
        TeacherTimesheetPeriod p1 = orgPeriod(1L, 3, 270);
        TeacherTimesheetPeriod p2 = orgPeriod(1L, 2, 180);   // cùng giáo viên, kỳ thứ hai
        TeacherTimesheetPeriod p3 = orgPeriod(5L, 4, 360);
        when(periodRepository
                .findByOrgIdAndPeriodStartGreaterThanEqualAndPeriodStartLessThanEqualOrderByPeriodStartDescTeacherIdAsc(
                        eq(ORG_ID), any(), any()))
                .thenReturn(List.of(p1, p2, p3));
        when(userRepository.findAllById(any())).thenReturn(List.of(
                com.deutschflow.user.entity.User.builder().id(1L).displayName("GV Một").build(),
                com.deutschflow.user.entity.User.builder().id(5L).displayName("GV Năm").build()));

        var summary = service.orgSummary(MANAGER_ID, ORG_ID, START, END);

        assertThat(summary.teacherCount()).isEqualTo(2);     // distinct {1, 5}
        assertThat(summary.totalSessions()).isEqualTo(9);    // 3 + 2 + 4
        assertThat(summary.totalMinutes()).isEqualTo(810);   // 270 + 180 + 360
        assertThat(summary.periods()).hasSize(3);
    }

    // ── xuất CSV cho kế toán ──────────────────────────────────────────────────

    @Test
    @DisplayName("exportOrgCsv() bọc ô và escape nháy — tên lớp/giáo viên có dấu phẩy không làm vỡ cột")
    void exportOrgCsv_quotesAndEscapes() {
        TeacherTimesheetPeriod p = period(Status.APPROVED);
        p.setTotalSessions(3);
        p.setTotalMinutes(270);
        when(periodRepository
                .findByOrgIdAndPeriodStartGreaterThanEqualAndPeriodStartLessThanEqualOrderByPeriodStartDescTeacherIdAsc(
                        eq(ORG_ID), any(), any()))
                .thenReturn(List.of(p));
        when(userRepository.findAllById(any()))
                .thenReturn(List.of(com.deutschflow.user.entity.User.builder()
                        .id(TEACHER_ID).displayName("Nguyễn, Văn \"A\"").build()));

        String csv = service.exportOrgCsv(MANAGER_ID, ORG_ID, START, END);

        assertThat(csv).startsWith("\uFEFF");                       // BOM cho Excel Windows
        assertThat(csv).contains("\"Nguyễn, Văn \"\"A\"\"\"");  // dấu phẩy + nháy escape đúng
        assertThat(csv).contains(",3,270,");                       // số công không bọc nháy
        assertThat(csv).contains("\"APPROVED\"");
    }

    @Test
    @DisplayName("exportOrgCsv() vẫn qua OrgGuard — người ngoài tổ chức không xuất được dữ liệu")
    void exportOrgCsv_notOrgAdmin_isBlocked() {
        doThrow(new ForbiddenException("không đủ quyền"))
                .when(orgGuard).assertOrgAdmin(MANAGER_ID, ORG_ID);

        assertThatThrownBy(() -> service.exportOrgCsv(MANAGER_ID, ORG_ID, START, END))
                .isInstanceOf(ForbiddenException.class);
    }

    @Test
    @DisplayName("exportOrgCsv() CHỈ xuất kỳ đã duyệt/đã khoá — không đưa con số chưa có thẩm quyền cho kế toán")
    void exportOrgCsv_onlyApprovedAndLocked() {
        when(periodRepository
                .findByOrgIdAndPeriodStartGreaterThanEqualAndPeriodStartLessThanEqualOrderByPeriodStartDescTeacherIdAsc(
                        eq(ORG_ID), any(), any()))
                .thenReturn(List.of(
                        orgPeriodWith(1L, Status.APPROVED, 3, 270),
                        orgPeriodWith(2L, Status.LOCKED, 4, 360),
                        orgPeriodWith(3L, Status.OPEN, 0, 0),          // chưa nộp: tổng còn mặc định 0
                        orgPeriodWith(4L, Status.SUBMITTED, 5, 450),   // chưa ai duyệt
                        orgPeriodWith(5L, Status.REJECTED, 9, 810)));  // snapshot đang bị tranh chấp
        when(userRepository.findAllById(any())).thenReturn(List.of());

        String csv = service.exportOrgCsv(MANAGER_ID, ORG_ID, START, END);

        assertThat(csv).contains("\"APPROVED\"").contains("\"LOCKED\"");
        assertThat(csv).doesNotContain("\"OPEN\"")
                       .doesNotContain("\"SUBMITTED\"")
                       .doesNotContain("\"REJECTED\"");
        assertThat(csv.lines().count()).isEqualTo(3);   // 1 dòng tiêu đề + đúng 2 kỳ được trả
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    private static TeacherTimesheetPeriod period(Status status) {
        return TeacherTimesheetPeriod.builder()
                .id(PERIOD_ID).teacherId(TEACHER_ID).orgId(ORG_ID)
                .periodStart(START).periodEnd(END)
                .status(status)
                .build();
    }

    private static TeacherTimesheetPeriod orgPeriod(Long teacherId, int sessions, int minutes) {
        return orgPeriodWith(teacherId, Status.APPROVED, sessions, minutes);
    }

    private static TeacherTimesheetPeriod orgPeriodWith(Long teacherId, Status status, int sessions, int minutes) {
        return TeacherTimesheetPeriod.builder()
                .id(teacherId * 100).teacherId(teacherId).orgId(ORG_ID)
                .periodStart(START).periodEnd(END).status(status)
                .totalSessions(sessions).totalMinutes(minutes)
                .build();
    }
}
