package com.deutschflow.teacher.service;

import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.common.exception.ConflictException;
import com.deutschflow.common.exception.ForbiddenException;
import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.teacher.dto.ClassLessonLogDto;
import com.deutschflow.teacher.dto.CreateLessonLogRequest;
import com.deutschflow.teacher.entity.ClassAttendance;
import com.deutschflow.teacher.entity.ClassAttendanceId;
import com.deutschflow.teacher.entity.ClassLesson;
import com.deutschflow.teacher.entity.ClassLessonLog;
import com.deutschflow.teacher.entity.ClassStudent;
import com.deutschflow.teacher.entity.ClassStudentId;
import com.deutschflow.teacher.repository.ClassAttendanceRepository;
import com.deutschflow.teacher.repository.ClassLessonLogRepository;
import com.deutschflow.teacher.repository.ClassLessonRepository;
import com.deutschflow.teacher.repository.ClassStudentRepository;
import com.deutschflow.teacher.repository.ClassTeacherRepository;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class LessonLogServiceTest {

    @Mock private ClassLessonLogRepository lessonLogRepository;
    @Mock private ClassAttendanceRepository attendanceRepository;
    @Mock private ClassTeacherRepository classTeacherRepository;
    @Mock private ClassStudentRepository classStudentRepository;
    @Mock private ClassLessonRepository lessonRepository;
    @Mock private UserRepository userRepository;
    @Mock private com.deutschflow.teacher.repository.TeacherClassRepository teacherClassRepository;

    private LessonLogService service;

    private static final Long TEACHER_ID = 1L;
    private static final Long CLASS_ID   = 10L;
    private static final Long LOG_ID     = 100L;
    private static final Long STUDENT_ID = 200L;
    private static final Long LESSON_ID  = 300L;

    @BeforeEach
    void setUp() {
        service = new LessonLogService(
                lessonLogRepository, attendanceRepository,
                classTeacherRepository, classStudentRepository, lessonRepository, userRepository,
                teacherClassRepository);
    }

    // ── getLogs ───────────────────────────────────────────────────────────────

    @Test
    @DisplayName("getLogs returns empty list when no logs exist")
    void getLogs_noLogs_returnsEmpty() {
        allowAccess();
        when(lessonLogRepository.findByClassIdOrderBySessionDateAscSessionNumberAsc(CLASS_ID))
                .thenReturn(List.of());

        List<ClassLessonLogDto> result = service.getLogs(TEACHER_ID, CLASS_ID);

        assertThat(result).isEmpty();
        verify(attendanceRepository, never()).findByLessonLogIds(any());
    }

    @Test
    @DisplayName("getLogs assembles attendance entries and student names")
    void getLogs_withLogsAndAttendance_returnsDtos() {
        allowAccess();
        ClassLessonLog log = buildLog(LOG_ID, CLASS_ID, LocalDate.of(2026, 6, 10));
        when(lessonLogRepository.findByClassIdOrderBySessionDateAscSessionNumberAsc(CLASS_ID))
                .thenReturn(List.of(log));

        ClassAttendance att = buildAttendance(LOG_ID, STUDENT_ID, "PRESENT");
        when(attendanceRepository.findByLessonLogIds(List.of(LOG_ID))).thenReturn(List.of(att));

        User student = buildUser(STUDENT_ID, "Nguyen Van A", "a@test.com");
        when(userRepository.findAllById(List.of(STUDENT_ID))).thenReturn(List.of(student));

        List<ClassLessonLogDto> result = service.getLogs(TEACHER_ID, CLASS_ID);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).attendance()).hasSize(1);
        assertThat(result.get(0).attendance().get(0).name()).isEqualTo("Nguyen Van A");
        assertThat(result.get(0).attendance().get(0).status()).isEqualTo("PRESENT");
    }

    @Test
    @DisplayName("getLogs throws ForbiddenException when teacher does not own class")
    void getLogs_notOwner_throwsForbidden() {
        denyAccess();
        assertThatThrownBy(() -> service.getLogs(TEACHER_ID, CLASS_ID))
                .isInstanceOf(ForbiddenException.class);
    }

    // ── createLog ─────────────────────────────────────────────────────────────

    @Test
    @DisplayName("createLog persists log and attendance records")
    void createLog_validRequest_savesLogAndAttendance() {
        allowAccess();
        rosterOf(STUDENT_ID);
        CreateLessonLogRequest req = new CreateLessonLogRequest(
                LocalDate.of(2026, 6, 10), 1, "Lektion 3", "Write sentences", null,
                List.of(new CreateLessonLogRequest.AttendanceInput(STUDENT_ID, "PRESENT", null)), null);

        ClassLessonLog saved = buildLog(LOG_ID, CLASS_ID, req.sessionDate());
        when(lessonLogRepository.save(any())).thenReturn(saved);
        when(userRepository.findAllById(List.of(STUDENT_ID))).thenReturn(List.of(
                buildUser(STUDENT_ID, "Nguyen Van A", "a@test.com")));

        ClassLessonLogDto result = service.createLog(TEACHER_ID, CLASS_ID, req);

        assertThat(result.id()).isEqualTo(LOG_ID);
        assertThat(result.topic()).isEqualTo("Lektion 3");

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<ClassAttendance>> captor = ArgumentCaptor.forClass(List.class);
        verify(attendanceRepository).saveAll(captor.capture());
        assertThat(captor.getValue()).hasSize(1);
        assertThat(captor.getValue().get(0).getStatus()).isEqualTo("PRESENT");
    }

    /**
     * This test used to assert that a null status "defaults to PRESENT" — i.e. it locked in the bug.
     * Defaulting to PRESENT is exactly how a caller that says nothing about a student ends up marking
     * them present, which then feeds the attendance rate and the certificate gate. A missing status is
     * now a client error; a student the caller does not mention simply gets no attendance row.
     */
    @Test
    @DisplayName("createLog rejects a null attendance status instead of defaulting it to PRESENT")
    void createLog_nullStatus_isRejected() {
        allowAccess();
        CreateLessonLogRequest req = new CreateLessonLogRequest(
                LocalDate.of(2026, 6, 10), null, null, null, null,
                List.of(new CreateLessonLogRequest.AttendanceInput(STUDENT_ID, null, null)), null);

        when(lessonLogRepository.save(any())).thenReturn(buildLog(LOG_ID, CLASS_ID, req.sessionDate()));

        assertThatThrownBy(() -> service.createLog(TEACHER_ID, CLASS_ID, req))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("PRESENT");

        verify(attendanceRepository, never()).saveAll(any());
    }

    @Test
    @DisplayName("createLog rejects an unknown attendance status")
    void createLog_unknownStatus_isRejected() {
        allowAccess();
        CreateLessonLogRequest req = new CreateLessonLogRequest(
                LocalDate.of(2026, 6, 10), null, null, null, null,
                List.of(new CreateLessonLogRequest.AttendanceInput(STUDENT_ID, "MAYBE", null)), null);

        when(lessonLogRepository.save(any())).thenReturn(buildLog(LOG_ID, CLASS_ID, req.sessionDate()));

        assertThatThrownBy(() -> service.createLog(TEACHER_ID, CLASS_ID, req))
                .isInstanceOf(BadRequestException.class);

        verify(attendanceRepository, never()).saveAll(any());
    }

    @Test
    @DisplayName("createLog with no attendance list writes no attendance rows (unmarked ≠ present)")
    @SuppressWarnings("unchecked")
    void createLog_noAttendance_writesNoRows() {
        allowAccess();
        CreateLessonLogRequest req = new CreateLessonLogRequest(
                LocalDate.of(2026, 6, 10), null, "Nur der Stoff", null, null, List.of(), null);

        when(lessonLogRepository.save(any())).thenReturn(buildLog(LOG_ID, CLASS_ID, req.sessionDate()));

        service.createLog(TEACHER_ID, CLASS_ID, req);

        // The teacher only recorded what was taught — nobody was marked, so nobody is recorded.
        ArgumentCaptor<List<ClassAttendance>> captor = ArgumentCaptor.forClass(List.class);
        verify(attendanceRepository).saveAll(captor.capture());
        assertThat(captor.getValue()).isEmpty();
    }

    @Test
    @DisplayName("createLog with a lesson from another class throws ForbiddenException (cross-class guard)")
    void createLog_lessonFromOtherClass_throwsForbidden() {
        allowAccess();
        when(lessonRepository.findById(LESSON_ID))
                .thenReturn(Optional.of(buildLesson(LESSON_ID, 999L, "Fremde Lektion")));

        CreateLessonLogRequest req = new CreateLessonLogRequest(
                LocalDate.of(2026, 6, 10), 1, null, null, null, List.of(), LESSON_ID);

        assertThatThrownBy(() -> service.createLog(TEACHER_ID, CLASS_ID, req))
                .isInstanceOf(ForbiddenException.class);
        verify(lessonLogRepository, never()).save(any());
    }

    @Test
    @DisplayName("createLog with a valid same-class lesson persists lessonId and resolves lessonTitle")
    void createLog_validLesson_setsLessonIdAndTitle() {
        allowAccess();
        when(lessonRepository.findById(LESSON_ID))
                .thenReturn(Optional.of(buildLesson(LESSON_ID, CLASS_ID, "Lektion 5")));

        ClassLessonLog saved = buildLog(LOG_ID, CLASS_ID, LocalDate.of(2026, 6, 10));
        saved.setLessonId(LESSON_ID);
        when(lessonLogRepository.save(any())).thenReturn(saved);

        // Empty attendance → the service never queries userRepository, so no stub for it.
        CreateLessonLogRequest req = new CreateLessonLogRequest(
                LocalDate.of(2026, 6, 10), 1, null, null, null, List.of(), LESSON_ID);

        ClassLessonLogDto result = service.createLog(TEACHER_ID, CLASS_ID, req);

        assertThat(result.lessonId()).isEqualTo(LESSON_ID);
        assertThat(result.lessonTitle()).isEqualTo("Lektion 5");

        ArgumentCaptor<ClassLessonLog> captor = ArgumentCaptor.forClass(ClassLessonLog.class);
        verify(lessonLogRepository).save(captor.capture());
        assertThat(captor.getValue().getLessonId()).isEqualTo(LESSON_ID);
    }

    // ── updateLog ─────────────────────────────────────────────────────────────

    @Test
    @DisplayName("updateLog replaces attendance and updates fields")
    void updateLog_validRequest_updatesAndReplacesAttendance() {
        allowAccess();
        rosterOf(STUDENT_ID);
        ClassLessonLog existing = buildLog(LOG_ID, CLASS_ID, LocalDate.of(2026, 6, 1));
        when(lessonLogRepository.findById(LOG_ID)).thenReturn(Optional.of(existing));
        when(lessonLogRepository.save(any())).thenReturn(existing);

        CreateLessonLogRequest req = new CreateLessonLogRequest(
                LocalDate.of(2026, 6, 10), 2, "Lektion 4 updated", null, null,
                List.of(new CreateLessonLogRequest.AttendanceInput(STUDENT_ID, "ABSENT", null)), null);
        when(userRepository.findAllById(List.of(STUDENT_ID))).thenReturn(List.of(
                buildUser(STUDENT_ID, "Test", "t@test.com")));

        service.updateLog(TEACHER_ID, CLASS_ID, LOG_ID, req);

        verify(attendanceRepository).deleteByIdLessonLogId(LOG_ID);
        verify(attendanceRepository).saveAll(any());
    }

    @Test
    @DisplayName("updateLog throws NotFoundException when log does not exist")
    void updateLog_logNotFound_throwsNotFound() {
        allowAccess();
        when(lessonLogRepository.findById(LOG_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.updateLog(TEACHER_ID, CLASS_ID, LOG_ID,
                new CreateLessonLogRequest(LocalDate.now(), null, null, null, null, null, null)))
                .isInstanceOf(NotFoundException.class);
    }

    @Test
    @DisplayName("updateLog throws ForbiddenException when log belongs to different class")
    void updateLog_logFromOtherClass_throwsForbidden() {
        allowAccess();
        ClassLessonLog logOtherClass = buildLog(LOG_ID, 999L, LocalDate.now());
        when(lessonLogRepository.findById(LOG_ID)).thenReturn(Optional.of(logOtherClass));

        assertThatThrownBy(() -> service.updateLog(TEACHER_ID, CLASS_ID, LOG_ID,
                new CreateLessonLogRequest(LocalDate.now(), null, null, null, null, null, null)))
                .isInstanceOf(ForbiddenException.class);
    }

    // ── deleteLog ─────────────────────────────────────────────────────────────

    @Test
    @DisplayName("deleteLog removes attendance and log")
    void deleteLog_validRequest_deletesAttendanceAndLog() {
        allowAccess();
        ClassLessonLog log = buildLog(LOG_ID, CLASS_ID, LocalDate.now());
        when(lessonLogRepository.findById(LOG_ID)).thenReturn(Optional.of(log));

        service.deleteLog(TEACHER_ID, CLASS_ID, LOG_ID);

        verify(attendanceRepository).deleteByIdLessonLogId(LOG_ID);
        verify(lessonLogRepository).delete(log);
    }

    @Test
    @DisplayName("deleteLog throws ForbiddenException when access denied")
    void deleteLog_noAccess_throwsForbidden() {
        denyAccess();
        assertThatThrownBy(() -> service.deleteLog(TEACHER_ID, CLASS_ID, LOG_ID))
                .isInstanceOf(ForbiddenException.class);
    }

    // ── biên học viên của lớp (audit H-1: IDOR + rò rỉ PII xuyên tenant) ──────

    @Test
    @DisplayName("createLog rejects attendance for a student outside the class and never resolves their PII")
    void createLog_studentNotInClass_isRejected() {
        allowAccess();
        rosterOf(STUDENT_ID);
        stubLogSave();

        CreateLessonLogRequest req = new CreateLessonLogRequest(
                LocalDate.now(), 1, "Lektion 3", null, null,
                List.of(new CreateLessonLogRequest.AttendanceInput(999L, "PRESENT", null)), null);

        assertThatThrownBy(() -> service.createLog(TEACHER_ID, CLASS_ID, req))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("999");

        verify(attendanceRepository, never()).saveAll(any());
        // Không tra cứu user ⇒ displayName/email của người ngoài lớp không bao giờ lọt vào response.
        verify(userRepository, never()).findAllById(any());
    }

    @Test
    @DisplayName("updateLog rejects a student outside the class WITHOUT wiping the existing attendance")
    void updateLog_studentNotInClass_doesNotDeleteExisting() {
        allowAccess();
        ClassLessonLog existing = buildLog(LOG_ID, CLASS_ID, LocalDate.of(2026, 6, 1));
        when(lessonLogRepository.findById(LOG_ID)).thenReturn(Optional.of(existing));
        when(lessonLogRepository.save(any())).thenReturn(existing);
        rosterOf(STUDENT_ID);
        when(attendanceRepository.findByIdLessonLogId(LOG_ID)).thenReturn(List.of());

        CreateLessonLogRequest req = new CreateLessonLogRequest(
                LocalDate.of(2026, 6, 10), 2, "Lektion 4", null, null,
                List.of(new CreateLessonLogRequest.AttendanceInput(999L, "PRESENT", null)), null);

        assertThatThrownBy(() -> service.updateLog(TEACHER_ID, CLASS_ID, LOG_ID, req))
                .isInstanceOf(BadRequestException.class);

        verify(attendanceRepository, never()).deleteByIdLessonLogId(anyLong());
        verify(attendanceRepository, never()).saveAll(any());
    }

    @Test
    @DisplayName("updateLog still accepts a student who already left the class (edit must not wipe their history)")
    void updateLog_studentLeftClass_stillAllowed() {
        allowAccess();
        ClassLessonLog existing = buildLog(LOG_ID, CLASS_ID, LocalDate.of(2026, 6, 1));
        when(lessonLogRepository.findById(LOG_ID)).thenReturn(Optional.of(existing));
        when(lessonLogRepository.save(any())).thenReturn(existing);
        when(classStudentRepository.findByIdClassId(CLASS_ID)).thenReturn(List.of());   // đã rời lớp
        when(attendanceRepository.findByIdLessonLogId(LOG_ID))
                .thenReturn(List.of(buildAttendance(LOG_ID, STUDENT_ID, "PRESENT")));
        when(userRepository.findAllById(List.of(STUDENT_ID)))
                .thenReturn(List.of(buildUser(STUDENT_ID, "Đã rời lớp", "left@test.com")));

        CreateLessonLogRequest req = new CreateLessonLogRequest(
                LocalDate.of(2026, 6, 10), 2, "Lektion 4", null, null,
                List.of(new CreateLessonLogRequest.AttendanceInput(STUDENT_ID, "ABSENT", null)), null);

        ClassLessonLogDto dto = service.updateLog(TEACHER_ID, CLASS_ID, LOG_ID, req);

        assertThat(dto.attendance()).hasSize(1);
        assertThat(dto.attendance().get(0).studentId()).isEqualTo(STUDENT_ID);
        verify(attendanceRepository).saveAll(any());
    }

    @Test
    @DisplayName("createLog rejects the same studentId twice instead of silently overwriting")
    void createLog_duplicateStudentId_isRejected() {
        allowAccess();
        rosterOf(STUDENT_ID);
        stubLogSave();

        CreateLessonLogRequest req = new CreateLessonLogRequest(
                LocalDate.now(), 1, "Lektion 3", null, null,
                List.of(new CreateLessonLogRequest.AttendanceInput(STUDENT_ID, "PRESENT", null),
                        new CreateLessonLogRequest.AttendanceInput(STUDENT_ID, "ABSENT", null)), null);

        assertThatThrownBy(() -> service.createLog(TEACHER_ID, CLASS_ID, req))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("nhiều lần");

        verify(attendanceRepository, never()).saveAll(any());
    }

    // ── ràng buộc tài chính: nhật ký là căn cứ tính công (M-6, M-7) ───────────

    @Test
    @DisplayName("createLog refuses a future session date (no pay for a lesson not yet taught)")
    void createLog_futureSessionDate_isRejected() {
        allowAccess();

        CreateLessonLogRequest req = new CreateLessonLogRequest(
                LocalDate.now().plusDays(30), 1, "Lektion 3", null, null, null, null);

        assertThatThrownBy(() -> service.createLog(TEACHER_ID, CLASS_ID, req))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("chưa diễn ra");

        verify(lessonLogRepository, never()).save(any());
    }

    @Test
    @DisplayName("createLog refuses a second log for the same session (double-click = double pay)")
    void createLog_duplicateSession_isRejected() {
        allowAccess();
        LocalDate day = LocalDate.now().minusDays(1);
        ClassLessonLog existing = buildLog(LOG_ID, CLASS_ID, day);
        existing.setSessionNumber(5);
        when(lessonLogRepository.findByClassIdAndSessionDate(CLASS_ID, day)).thenReturn(List.of(existing));

        CreateLessonLogRequest req = new CreateLessonLogRequest(day, 5, "Lektion 3", null, null, null, null);

        assertThatThrownBy(() -> service.createLog(TEACHER_ID, CLASS_ID, req))
                .isInstanceOf(ConflictException.class);

        verify(lessonLogRepository, never()).save(any());
    }

    @Test
    @DisplayName("updateLog may keep its own date/session number (it is not a duplicate of itself)")
    void updateLog_ownRecord_isNotADuplicate() {
        allowAccess();
        rosterOf(STUDENT_ID);
        LocalDate day = LocalDate.now().minusDays(2);
        ClassLessonLog existing = buildLog(LOG_ID, CLASS_ID, day);
        existing.setSessionNumber(5);
        when(lessonLogRepository.findById(LOG_ID)).thenReturn(Optional.of(existing));
        when(lessonLogRepository.save(any())).thenReturn(existing);
        when(lessonLogRepository.findByClassIdAndSessionDate(CLASS_ID, day)).thenReturn(List.of(existing));
        when(attendanceRepository.findByIdLessonLogId(LOG_ID)).thenReturn(List.of());

        CreateLessonLogRequest req = new CreateLessonLogRequest(
                day, 5, "Lektion 3 (sửa chủ đề)", null, null, null, null);

        service.updateLog(TEACHER_ID, CLASS_ID, LOG_ID, req);

        verify(lessonLogRepository).save(any());
    }

    // ── xoá-rồi-chèn cùng khoá chính (audit H-2) ──────────────────────────────

    @Test
    @DisplayName("updateLog flushes the delete before re-inserting the same (logId, studentId) keys")
    void updateLog_flushesDeleteBeforeReinsert() {
        allowAccess();
        ClassLessonLog existing = buildLog(LOG_ID, CLASS_ID, LocalDate.of(2026, 6, 1));
        when(lessonLogRepository.findById(LOG_ID)).thenReturn(Optional.of(existing));
        when(lessonLogRepository.save(any())).thenReturn(existing);
        rosterOf(STUDENT_ID);
        when(attendanceRepository.findByIdLessonLogId(LOG_ID))
                .thenReturn(List.of(buildAttendance(LOG_ID, STUDENT_ID, "PRESENT")));
        when(userRepository.findAllById(List.of(STUDENT_ID)))
                .thenReturn(List.of(buildUser(STUDENT_ID, "Test", "t@test.com")));

        // Sĩ số giữ nguyên ⇒ khoá chính chèn lại trùng đúng khoá vừa xoá — ca vỡ phổ biến nhất.
        CreateLessonLogRequest req = new CreateLessonLogRequest(
                LocalDate.of(2026, 6, 10), 2, "Lektion 4", null, null,
                List.of(new CreateLessonLogRequest.AttendanceInput(STUDENT_ID, "ABSENT", null)), null);

        service.updateLog(TEACHER_ID, CLASS_ID, LOG_ID, req);

        InOrder ordered = inOrder(attendanceRepository);
        ordered.verify(attendanceRepository).deleteByIdLessonLogId(LOG_ID);
        ordered.verify(attendanceRepository).flush();
        ordered.verify(attendanceRepository).saveAll(any());
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    /** Roster của lớp gồm đúng các studentId truyền vào. */
    private void rosterOf(Long... studentIds) {
        when(classStudentRepository.findByIdClassId(CLASS_ID)).thenReturn(
                java.util.Arrays.stream(studentIds)
                        .map(sid -> ClassStudent.builder().id(new ClassStudentId(CLASS_ID, sid)).build())
                        .toList());
    }

    private void stubLogSave() {
        when(lessonLogRepository.save(any())).thenAnswer(inv -> {
            ClassLessonLog l = inv.getArgument(0);
            l.setId(LOG_ID);
            return l;
        });
    }

    // ─── getLogsForOrg (M-17) ────────────────────────────────────────────────

    @Test
    @DisplayName("M-17: getLogsForOrg — đúng org đọc được nhật ký, KHÔNG cần quyền teacher")
    void getLogsForOrg_sameOrg_readsWithoutTeacherCheck() {
        com.deutschflow.teacher.entity.TeacherClass tc =
                org.mockito.Mockito.mock(com.deutschflow.teacher.entity.TeacherClass.class);
        org.mockito.Mockito.when(tc.getOrgId()).thenReturn(7L);
        org.mockito.Mockito.when(teacherClassRepository.findById(CLASS_ID))
                .thenReturn(java.util.Optional.of(tc));
        org.mockito.Mockito.when(lessonLogRepository
                .findByClassIdOrderBySessionDateAscSessionNumberAsc(CLASS_ID))
                .thenReturn(java.util.List.of());

        org.assertj.core.api.Assertions.assertThat(service.getLogsForOrg(7L, CLASS_ID)).isEmpty();
        org.mockito.Mockito.verify(classTeacherRepository, org.mockito.Mockito.never())
                .existsByIdClassIdAndIdTeacherId(org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any());
    }

    @Test
    @DisplayName("M-17: getLogsForOrg — lớp của org khác → NotFound, không đọc nhật ký")
    void getLogsForOrg_crossOrg_throwsNotFound() {
        com.deutschflow.teacher.entity.TeacherClass tc =
                org.mockito.Mockito.mock(com.deutschflow.teacher.entity.TeacherClass.class);
        org.mockito.Mockito.when(tc.getOrgId()).thenReturn(7L);
        org.mockito.Mockito.when(teacherClassRepository.findById(CLASS_ID))
                .thenReturn(java.util.Optional.of(tc));

        org.assertj.core.api.Assertions.assertThatThrownBy(() -> service.getLogsForOrg(999L, CLASS_ID))
                .isInstanceOf(com.deutschflow.common.exception.NotFoundException.class);
        org.mockito.Mockito.verify(lessonLogRepository, org.mockito.Mockito.never())
                .findByClassIdOrderBySessionDateAscSessionNumberAsc(org.mockito.ArgumentMatchers.any());
    }

    private void allowAccess() {
        when(classTeacherRepository.existsByIdClassIdAndIdTeacherId(CLASS_ID, TEACHER_ID)).thenReturn(true);
    }

    private void denyAccess() {
        when(classTeacherRepository.existsByIdClassIdAndIdTeacherId(CLASS_ID, TEACHER_ID)).thenReturn(false);
    }

    private static ClassLessonLog buildLog(Long id, Long classId, LocalDate date) {
        ClassLessonLog log = ClassLessonLog.builder()
                .classId(classId)
                .sessionDate(date)
                .sessionNumber(1)
                .topic("Lektion 3")
                .homework("Write sentences")
                .createdBy(TEACHER_ID)
                .build();
        log.setId(id);
        log.setCreatedAt(LocalDateTime.now());
        return log;
    }

    private static ClassLesson buildLesson(Long id, Long classId, String title) {
        return ClassLesson.builder().id(id).classId(classId).orderIndex(0).title(title).build();
    }

    private static ClassAttendance buildAttendance(Long logId, Long studentId, String status) {
        return ClassAttendance.builder()
                .id(new ClassAttendanceId(logId, studentId))
                .status(status)
                .build();
    }

    private static User buildUser(Long id, String name, String email) {
        User u = new User();
        u.setId(id);
        u.setDisplayName(name);
        u.setEmail(email);
        return u;
    }

    // ── auto-complete the tagged lesson (wave 5 §6.2) ─────────────────────────

    @Test
    @DisplayName("createLog with a lesson tag marks that lesson completed (no second tick needed)")
    void createLog_withLesson_marksLessonCompleted() {
        allowAccess();
        ClassLesson lesson = ClassLesson.builder()
                .id(LESSON_ID).classId(CLASS_ID).orderIndex(0).title("Lektion 3").completed(false).build();
        when(lessonRepository.findById(LESSON_ID)).thenReturn(java.util.Optional.of(lesson));
        when(lessonLogRepository.save(any())).thenReturn(buildLog(LOG_ID, CLASS_ID, LocalDate.of(2026, 6, 10)));

        CreateLessonLogRequest req = new CreateLessonLogRequest(
                LocalDate.of(2026, 6, 10), 1, "Lektion 3", null, null, List.of(), LESSON_ID);
        service.createLog(TEACHER_ID, CLASS_ID, req);

        // The lesson the teacher tagged is now completed, dated from the session — tc-progress advances
        // without a separate trip to tc-checklist.
        assertThat(lesson.isCompleted()).isTrue();
        assertThat(lesson.getCompletedAt()).isEqualTo(LocalDate.of(2026, 6, 10).atStartOfDay());
        assertThat(lesson.getCompletedByTeacherId()).isEqualTo(TEACHER_ID);
        verify(lessonRepository).save(lesson);
    }

    @Test
    @DisplayName("createLog without a lesson tag touches no lesson")
    void createLog_noLesson_doesNotTouchLessons() {
        allowAccess();
        when(lessonLogRepository.save(any())).thenReturn(buildLog(LOG_ID, CLASS_ID, LocalDate.of(2026, 6, 10)));

        CreateLessonLogRequest req = new CreateLessonLogRequest(
                LocalDate.of(2026, 6, 10), 1, "Ôn tập", null, null, List.of(), null);
        service.createLog(TEACHER_ID, CLASS_ID, req);

        verify(lessonRepository, never()).save(any());
    }

    @Test
    @DisplayName("createLog does NOT re-stamp a lesson that is already completed")
    void createLog_alreadyCompletedLesson_doesNotRestamp() {
        allowAccess();
        ClassLesson lesson = ClassLesson.builder()
                .id(LESSON_ID).classId(CLASS_ID).orderIndex(0).title("Lektion 3")
                .completed(true).completedAt(LocalDate.of(2026, 5, 1).atStartOfDay()).build();
        when(lessonRepository.findById(LESSON_ID)).thenReturn(java.util.Optional.of(lesson));
        when(lessonLogRepository.save(any())).thenReturn(buildLog(LOG_ID, CLASS_ID, LocalDate.of(2026, 6, 10)));

        CreateLessonLogRequest req = new CreateLessonLogRequest(
                LocalDate.of(2026, 6, 10), 2, "Lektion 3 (bù)", null, null, List.of(), LESSON_ID);
        service.createLog(TEACHER_ID, CLASS_ID, req);

        // Original completion date preserved; the lesson is not re-saved by auto-complete.
        assertThat(lesson.getCompletedAt()).isEqualTo(LocalDate.of(2026, 5, 1).atStartOfDay());
        verify(lessonRepository, never()).save(any());
    }
}
