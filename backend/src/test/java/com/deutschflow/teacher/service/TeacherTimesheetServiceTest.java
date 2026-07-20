package com.deutschflow.teacher.service;

import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.common.exception.ConflictException;
import com.deutschflow.common.exception.ForbiddenException;
import com.deutschflow.teacher.dto.TimesheetDtos.RecordTeachingRequest;
import com.deutschflow.teacher.dto.TimesheetDtos.SessionRecordDto;
import com.deutschflow.teacher.dto.TimesheetDtos.SuggestionDto;
import com.deutschflow.teacher.dto.TimesheetDtos.TimesheetSummaryDto;
import com.deutschflow.teacher.entity.ClassSession;
import com.deutschflow.teacher.entity.ClassTeacher;
import com.deutschflow.teacher.entity.ClassTeacherId;
import com.deutschflow.teacher.entity.TeacherClass;
import com.deutschflow.teacher.entity.TeacherSessionRecord;
import com.deutschflow.teacher.repository.ClassSessionRepository;
import com.deutschflow.teacher.repository.ClassTeacherRepository;
import com.deutschflow.teacher.repository.TeacherClassRepository;
import com.deutschflow.teacher.repository.TeacherSessionRecordRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("TeacherTimesheetService — bảng công giáo viên")
class TeacherTimesheetServiceTest {

    @Mock private TeacherSessionRecordRepository recordRepository;
    @Mock private ClassSessionRepository sessionRepository;
    @Mock private ClassTeacherRepository classTeacherRepository;
    @Mock private TeacherClassRepository classRepository;
    @Mock private TimesheetPeriodService periodService;

    private TeacherTimesheetService service;

    private static final Long TEACHER_ID = 1L;
    private static final Long CLASS_ID = 10L;
    private static final Long ORG_ID = 42L;
    private static final Long SESSION_ID = 500L;

    @BeforeEach
    void setUp() {
        service = new TeacherTimesheetService(
                recordRepository, sessionRepository, classTeacherRepository, classRepository, periodService);
    }

    // ── snapshot: số công phải tự đứng vững ───────────────────────────────────

    /**
     * Điểm cốt lõi của cả bảng này. regenerate() xoá thật buổi tương lai chưa chỉnh tay và sinh lại,
     * xoá lớp thì cascade xuống buổi — nên nếu dòng công join live sang class_sessions thì số công
     * đã chốt sẽ đổi hoặc biến mất sau lưng người duyệt.
     */
    @Test
    @DisplayName("record() chốt snapshot thời gian, thời lượng, lớp và org vào chính dòng công")
    void record_snapshotsEverythingNeededForPay() {
        LocalDateTime start = LocalDateTime.now().minusDays(1).withHour(18).withMinute(0).withSecond(0).withNano(0);
        allowTeaches();
        when(sessionRepository.findById(SESSION_ID)).thenReturn(Optional.of(session(start, 90)));
        when(classRepository.findById(CLASS_ID)).thenReturn(Optional.of(
                TeacherClass.builder().id(CLASS_ID).name("K30 · B1").orgId(ORG_ID).build()));
        when(recordRepository.findByTeacherIdAndStartedAt(TEACHER_ID, start)).thenReturn(Optional.empty());
        when(recordRepository.save(any())).thenAnswer(inv -> {
            TeacherSessionRecord r = inv.getArgument(0);
            r.setId(7L);
            return r;
        });

        SessionRecordDto dto = service.record(TEACHER_ID,
                new RecordTeachingRequest(SESSION_ID, null, null, null, null, null));

        assertThat(dto.startedAt()).isEqualTo(start);
        assertThat(dto.durationMinutes()).isEqualTo(90);
        assertThat(dto.className()).isEqualTo("K30 · B1");   // snapshot, không join live
        assertThat(dto.sessionId()).isEqualTo(SESSION_ID);
    }

    @Test
    @DisplayName("record() lấy thời lượng THỰC TẾ do giáo viên khai, không phải thời lượng theo lịch")
    void record_actualDurationOverridesPlanned() {
        LocalDateTime start = LocalDateTime.now().minusDays(1).withNano(0);
        allowTeaches();
        when(sessionRepository.findById(SESSION_ID)).thenReturn(Optional.of(session(start, 90)));
        when(classRepository.findById(CLASS_ID)).thenReturn(Optional.of(
                TeacherClass.builder().id(CLASS_ID).name("K30").orgId(ORG_ID).build()));
        when(recordRepository.findByTeacherIdAndStartedAt(TEACHER_ID, start)).thenReturn(Optional.empty());
        when(recordRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        // Buổi kéo dài hơn kế hoạch 15 phút — hợp đồng tính theo giờ phải ăn theo con số này.
        SessionRecordDto dto = service.record(TEACHER_ID,
                new RecordTeachingRequest(SESSION_ID, null, null, 105, null, null));

        assertThat(dto.durationMinutes()).isEqualTo(105);
    }

    // ── chốt chặn tài chính ───────────────────────────────────────────────────

    @Test
    @DisplayName("record() từ chối buổi chưa diễn ra (không khai công trước khi làm)")
    void record_futureSession_isRejected() {
        LocalDateTime future = LocalDateTime.now().plusDays(3);
        allowTeaches();

        assertThatThrownBy(() -> service.record(TEACHER_ID,
                new RecordTeachingRequest(null, CLASS_ID, future, 90, null, null)))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("chưa diễn ra");

        verify(recordRepository, never()).save(any());
    }

    @Test
    @DisplayName("record() từ chối ghi công trùng một mốc bắt đầu (chống trả thừa công)")
    void record_duplicateStart_isRejected() {
        LocalDateTime start = LocalDateTime.now().minusDays(1).withNano(0);
        allowTeaches();
        when(recordRepository.findByTeacherIdAndStartedAt(TEACHER_ID, start))
                .thenReturn(Optional.of(TeacherSessionRecord.builder().id(3L).build()));

        assertThatThrownBy(() -> service.record(TEACHER_ID,
                new RecordTeachingRequest(null, CLASS_ID, start, 90, null, null)))
                .isInstanceOf(ConflictException.class);

        verify(recordRepository, never()).save(any());
    }

    @Test
    @DisplayName("record() từ chối lớp mà giáo viên không dạy")
    void record_classNotTaught_isForbidden() {
        when(classTeacherRepository.existsByIdClassIdAndIdTeacherId(CLASS_ID, TEACHER_ID)).thenReturn(false);

        assertThatThrownBy(() -> service.record(TEACHER_ID,
                new RecordTeachingRequest(null, CLASS_ID, LocalDateTime.now().minusDays(1), 90, null, null)))
                .isInstanceOf(ForbiddenException.class);

        verify(recordRepository, never()).save(any());
    }

    @Test
    @DisplayName("record() từ chối buổi đã bị huỷ")
    void record_cancelledSession_isRejected() {
        LocalDateTime start = LocalDateTime.now().minusDays(1).withNano(0);
        ClassSession s = session(start, 90);
        s.setStatus(ClassSession.Status.CANCELLED);
        when(sessionRepository.findById(SESSION_ID)).thenReturn(Optional.of(s));

        assertThatThrownBy(() -> service.record(TEACHER_ID,
                new RecordTeachingRequest(SESSION_ID, null, null, null, null, null)))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("huỷ");
    }

    @Test
    @DisplayName("updateRecord() không cho sửa dòng công của giáo viên khác")
    void updateRecord_otherTeachersRow_isForbidden() {
        when(recordRepository.findById(7L)).thenReturn(Optional.of(
                TeacherSessionRecord.builder().id(7L).teacherId(999L).build()));

        assertThatThrownBy(() -> service.updateRecord(TEACHER_ID, 7L,
                new RecordTeachingRequest(null, null, null, 60, null, null)))
                .isInstanceOf(ForbiddenException.class);
    }

    @Test
    @DisplayName("record() bị chặn khi ngày đó rơi vào kỳ công đã nộp/duyệt/khoá")
    void record_insideClosedPeriod_isRejected() {
        LocalDateTime start = LocalDateTime.now().minusDays(1).withNano(0);
        allowTeaches();
        when(recordRepository.findByTeacherIdAndStartedAt(TEACHER_ID, start)).thenReturn(Optional.empty());
        doThrow(new ConflictException("Kỳ công đang ở trạng thái APPROVED"))
                .when(periodService).assertRecordEditable(TEACHER_ID, start.toLocalDate());

        assertThatThrownBy(() -> service.record(TEACHER_ID,
                new RecordTeachingRequest(null, CLASS_ID, start, 90, null, null)))
                .isInstanceOf(ConflictException.class);

        verify(recordRepository, never()).save(any());
    }

    // ── đề xuất buổi chưa ghi công ────────────────────────────────────────────

    @Test
    @DisplayName("suggestions() bỏ buổi đã huỷ, buổi đã ghi công và buổi chưa diễn ra")
    void suggestions_filtersCancelledRecordedAndFuture() {
        LocalDateTime from = LocalDateTime.now().minusDays(7);
        LocalDateTime to = LocalDateTime.now().plusDays(7);
        LocalDateTime past = LocalDateTime.now().minusDays(2).withNano(0);
        LocalDateTime pastCancelled = LocalDateTime.now().minusDays(3).withNano(0);
        LocalDateTime pastRecorded = LocalDateTime.now().minusDays(4).withNano(0);

        when(classTeacherRepository.findByIdTeacherId(TEACHER_ID)).thenReturn(List.of(
                ClassTeacher.builder().id(new ClassTeacherId(CLASS_ID, TEACHER_ID)).role("PRIMARY").build()));

        ClassSession ok = session(past, 90);
        ok.setId(501L);
        ClassSession cancelled = session(pastCancelled, 90);
        cancelled.setId(502L);
        cancelled.setStatus(ClassSession.Status.CANCELLED);
        ClassSession recorded = session(pastRecorded, 90);
        recorded.setId(503L);

        when(sessionRepository.findForClassesInRange(anyList(), any(), any()))
                .thenReturn(List.of(ok, cancelled, recorded));
        when(recordRepository.findByTeacherIdAndSessionIdIn(eq(TEACHER_ID), anyList()))
                .thenReturn(List.of(TeacherSessionRecord.builder().id(9L).sessionId(503L).build()));
        when(recordRepository
                .findByTeacherIdAndStartedAtGreaterThanEqualAndStartedAtLessThanOrderByStartedAt(
                        eq(TEACHER_ID), any(), any()))
                .thenReturn(List.of());
        when(classRepository.findAllById(anyList())).thenReturn(List.of(
                TeacherClass.builder().id(CLASS_ID).name("K30").build()));

        List<SuggestionDto> result = service.suggestions(TEACHER_ID, from, to);

        assertThat(result).extracting(SuggestionDto::sessionId).containsExactly(501L);
        assertThat(result.get(0).className()).isEqualTo("K30");
    }

    @Test
    @DisplayName("suggestions() trả rỗng khi giáo viên chưa dạy lớp nào (không truy vấn buổi)")
    void suggestions_noClasses_returnsEmpty() {
        when(classTeacherRepository.findByIdTeacherId(TEACHER_ID)).thenReturn(List.of());

        List<SuggestionDto> result = service.suggestions(
                TEACHER_ID, LocalDateTime.now().minusDays(7), LocalDateTime.now());

        assertThat(result).isEmpty();
        verify(sessionRepository, never()).findForClassesInRange(anyList(), any(), any());
    }

    // ── tổng hợp kỳ ───────────────────────────────────────────────────────────

    @Test
    @DisplayName("mySheet() cộng đúng số buổi và tổng số phút (hợp đồng theo giờ dùng tổng phút)")
    void mySheet_sumsSessionsAndMinutes() {
        LocalDateTime from = LocalDateTime.now().minusDays(30);
        LocalDateTime to = LocalDateTime.now().plusDays(1);
        when(recordRepository
                .findByTeacherIdAndStartedAtGreaterThanEqualAndStartedAtLessThanOrderByStartedAt(
                        eq(TEACHER_ID), any(), any()))
                .thenReturn(List.of(
                        TeacherSessionRecord.builder().id(1L).teacherId(TEACHER_ID)
                                .startedAt(from.plusDays(1)).durationMinutes(90).build(),
                        TeacherSessionRecord.builder().id(2L).teacherId(TEACHER_ID)
                                .startedAt(from.plusDays(2)).durationMinutes(105).build()));
        when(classTeacherRepository.findByIdTeacherId(TEACHER_ID)).thenReturn(List.of());

        TimesheetSummaryDto sheet = service.mySheet(TEACHER_ID, from, to);

        assertThat(sheet.totalSessions()).isEqualTo(2);
        assertThat(sheet.totalMinutes()).isEqualTo(195);
        assertThat(sheet.records()).hasSize(2);
    }

    @Test
    @DisplayName("mySheet() từ chối kỳ không hợp lệ trước khi truy vấn")
    void mySheet_invalidRange_throws() {
        assertThatThrownBy(() -> service.mySheet(
                TEACHER_ID, LocalDateTime.now(), LocalDateTime.now().minusDays(1)))
                .isInstanceOf(BadRequestException.class);
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    private void allowTeaches() {
        when(classTeacherRepository.existsByIdClassIdAndIdTeacherId(CLASS_ID, TEACHER_ID)).thenReturn(true);
    }

    private static ClassSession session(LocalDateTime startAt, int minutes) {
        return ClassSession.builder()
                .id(SESSION_ID).classId(CLASS_ID).startAt(startAt).durationMinutes(minutes)
                .mode(ClassSession.Mode.OFFLINE).status(ClassSession.Status.SCHEDULED)
                .overridden(false).build();
    }
}
