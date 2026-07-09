package com.deutschflow.teacher.service;

import com.deutschflow.common.exception.ForbiddenException;
import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.teacher.dto.ClassLessonLogDto;
import com.deutschflow.teacher.dto.CreateLessonLogRequest;
import com.deutschflow.teacher.entity.ClassAttendance;
import com.deutschflow.teacher.entity.ClassAttendanceId;
import com.deutschflow.teacher.entity.ClassLesson;
import com.deutschflow.teacher.entity.ClassLessonLog;
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
                classTeacherRepository, classStudentRepository, lessonRepository, userRepository);
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

    @Test
    @DisplayName("createLog defaults absent status to PRESENT when null")
    void createLog_nullStatus_defaultsToPresent() {
        allowAccess();
        CreateLessonLogRequest req = new CreateLessonLogRequest(
                LocalDate.of(2026, 6, 10), null, null, null, null,
                List.of(new CreateLessonLogRequest.AttendanceInput(STUDENT_ID, null, null)), null);

        when(lessonLogRepository.save(any())).thenReturn(buildLog(LOG_ID, CLASS_ID, req.sessionDate()));
        when(userRepository.findAllById(any())).thenReturn(List.of());

        service.createLog(TEACHER_ID, CLASS_ID, req);

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<ClassAttendance>> captor = ArgumentCaptor.forClass(List.class);
        verify(attendanceRepository).saveAll(captor.capture());
        assertThat(captor.getValue().get(0).getStatus()).isEqualTo("PRESENT");
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

    // ── helpers ───────────────────────────────────────────────────────────────

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
}
