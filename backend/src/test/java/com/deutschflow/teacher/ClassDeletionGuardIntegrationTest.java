package com.deutschflow.teacher;

import com.deutschflow.common.audit.AuditActor;
import com.deutschflow.common.exception.ConflictException;
import com.deutschflow.teacher.entity.ClassAttendance;
import com.deutschflow.teacher.entity.ClassAttendanceId;
import com.deutschflow.teacher.entity.ClassLessonLog;
import com.deutschflow.teacher.entity.ClassSession;
import com.deutschflow.teacher.entity.ClassTeacher;
import com.deutschflow.teacher.entity.ClassTeacherId;
import com.deutschflow.teacher.entity.TeacherClass;
import com.deutschflow.teacher.repository.ClassAttendanceRepository;
import com.deutschflow.teacher.repository.ClassLessonLogRepository;
import com.deutschflow.teacher.repository.ClassSessionRepository;
import com.deutschflow.teacher.repository.ClassTeacherRepository;
import com.deutschflow.teacher.repository.TeacherClassRepository;
import com.deutschflow.teacher.service.ClassDeletionGuard;
import com.deutschflow.teacher.service.TeacherService;
import com.deutschflow.testsupport.AbstractPostgresIntegrationTest;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Bất biến khoá lại quả bom cascade của {@code deleteClass}, chạy trên PostgreSQL thật.
 *
 * <p>Chỉ IT mới chứng minh được điều cần chứng minh: unit test mock {@link ClassDeletionGuard} nên
 * không hề chạy câu SQL đếm, và cũng không có {@code ON DELETE CASCADE} nào để mà nổ. Ở đây thì có
 * cả hai — nếu guard hỏng, {@code DELETE FROM teacher_classes} sẽ thật sự cuốn theo điểm danh và
 * nhật ký, và test bên dưới đỏ.
 */
@SpringBootTest
@DisplayName("Class deletion guard IT — lớp có dữ liệu không xoá được, lớp trống thì xoá được")
class ClassDeletionGuardIntegrationTest extends AbstractPostgresIntegrationTest {

    @Autowired private ClassDeletionGuard guard;
    @Autowired private TeacherService teacherService;
    @Autowired private TeacherClassRepository classRepo;
    @Autowired private ClassTeacherRepository classTeacherRepo;
    @Autowired private ClassSessionRepository sessionRepo;
    @Autowired private ClassLessonLogRepository lessonLogRepo;
    @Autowired private ClassAttendanceRepository attendanceRepo;
    @Autowired private UserRepository userRepository;
    @Autowired private JdbcTemplate jdbc;

    @Test
    @DisplayName("câu SQL đếm chạy được trên Postgres và trả 0 cho lớp mới toanh")
    void inspect_freshClass_allZero() {
        User t = newTeacher();
        TeacherClass c = newClass(t.getId());

        ClassDeletionGuard.ClassContent content = guard.inspect(c.getId());

        assertThat(content.hasHistory()).isFalse();
        assertThat(content.describeHistory()).isEmpty();
        assertThat(content.toAuditMetadata().values()).allMatch(v -> ((Number) v).longValue() == 0L);
    }

    @Test
    @DisplayName("đếm đúng buổi học / nhật ký / điểm danh của ĐÚNG lớp, không lẫn lớp khác")
    void inspect_countsPerClass() {
        User t = newTeacher();
        TeacherClass c = newClass(t.getId());
        TeacherClass other = newClass(t.getId());

        saveSession(c.getId(), LocalDate.now().plusDays(3).atTime(18, 0));
        saveSession(c.getId(), LocalDate.now().plusDays(4).atTime(18, 0));
        saveSession(other.getId(), LocalDate.now().plusDays(5).atTime(18, 0));

        ClassLessonLog log = saveLessonLog(c.getId(), LocalDate.now().minusDays(1));
        saveAttendance(log.getId(), t.getId());

        ClassDeletionGuard.ClassContent content = guard.inspect(c.getId());

        assertThat(content.sessions()).isEqualTo(2);
        assertThat(content.lessonLogs()).isEqualTo(1);
        assertThat(content.attendance()).isEqualTo(1);
        assertThat(content.hasHistory()).isTrue();
        assertThat(content.describeHistory())
                .contains("2 buổi học", "1 nhật ký buổi học", "1 lượt điểm danh");

        assertThat(guard.inspect(other.getId()).sessions()).isEqualTo(1);
    }

    @Test
    @DisplayName("BẤT BIẾN: lớp có buổi học + điểm danh → 409, và KHÔNG bảng nào bị cascade xoá")
    void deleteClass_classWithHistory_refusedAndNothingCascades() {
        User t = newTeacher();
        TeacherClass c = newClass(t.getId());
        link(c.getId(), t.getId());
        saveSession(c.getId(), LocalDate.now().plusDays(3).atTime(18, 0));
        ClassLessonLog log = saveLessonLog(c.getId(), LocalDate.now().minusDays(2));
        saveAttendance(log.getId(), t.getId());

        assertThatThrownBy(() -> teacherService.deleteClass(actor(t), c.getId()))
                .isInstanceOf(ConflictException.class)
                .hasMessageContaining("buổi học")
                .hasMessageContaining("lượt điểm danh");

        // Lớp và toàn bộ dữ liệu treo vào nó còn nguyên — đây là điều cả bug lẫn fix nói về.
        assertThat(classRepo.findById(c.getId())).isPresent();
        assertThat(count("class_sessions", c.getId())).isEqualTo(1);
        assertThat(count("class_lesson_logs", c.getId())).isEqualTo(1);
        assertThat(attendanceRepo.findByIdLessonLogId(log.getId())).hasSize(1);
        assertThat(classTeacherRepo.findByIdClassId(c.getId())).hasSize(1);
    }

    @Test
    @DisplayName("BẤT BIẾN: lớp trống vẫn xoá được, và để lại một dòng audit kèm kiểm kê")
    void deleteClass_emptyClass_deletedAndAudited() {
        User t = newTeacher();
        TeacherClass c = newClass(t.getId());
        link(c.getId(), t.getId());

        assertThatCode(() -> teacherService.deleteClass(actor(t), c.getId())).doesNotThrowAnyException();

        assertThat(classRepo.findById(c.getId())).isEmpty();
        assertThat(classTeacherRepo.findByIdClassId(c.getId())).isEmpty();

        // Đọc bằng toán tử jsonb, không so chuỗi: Postgres chuẩn hoá lại khoảng trắng và thứ tự khoá.
        Map<String, Object> audit = jdbc.queryForMap("""
                SELECT actor_email,
                       metadata_json ->> 'className' AS class_name,
                       metadata_json ->> 'sessions'  AS sessions,
                       metadata_json ->> 'students'  AS students
                  FROM audit_logs
                 WHERE event_name = 'teacher_class_deleted' AND target_id = ?
                """, String.valueOf(c.getId()));
        assertThat(audit.get("actor_email")).isEqualTo(t.getEmail());
        assertThat(audit.get("class_name")).isEqualTo("K30 · B1 Pflege");
        assertThat(audit.get("sessions")).isEqualTo("0");
        assertThat(audit.get("students")).isEqualTo("0");
    }

    @Test
    @DisplayName("chỉ tin nhắn còn sống mới chặn xoá — tin đã xoá mềm thì không")
    void inspect_softDeletedMessagesDoNotBlock() {
        User t = newTeacher();
        TeacherClass c = newClass(t.getId());
        insertMessage(c.getId(), t.getId(), true);

        assertThat(guard.inspect(c.getId()).channelMessages()).isZero();

        insertMessage(c.getId(), t.getId(), false);
        assertThat(guard.inspect(c.getId()).channelMessages()).isEqualTo(1);
        assertThat(guard.inspect(c.getId()).hasHistory()).isTrue();
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    private long count(String table, Long classId) {
        Long n = jdbc.queryForObject(
                "SELECT COUNT(*) FROM " + table + " WHERE class_id = ?", Long.class, classId);
        return n == null ? 0L : n;
    }

    private static AuditActor actor(User teacher) {
        return AuditActor.of(teacher);
    }

    private User newTeacher() {
        return userRepository.save(User.builder()
                .email("cdg-" + UUID.randomUUID() + "@test.local")
                .passwordHash("x")
                .displayName("Deletion Guard Tester")
                .role(User.Role.TEACHER)
                .build());
    }

    private TeacherClass newClass(Long teacherId) {
        return classRepo.save(TeacherClass.builder()
                .teacherId(teacherId)
                .name("K30 · B1 Pflege")
                .inviteCode("INV-" + UUID.randomUUID())
                .createdAt(LocalDateTime.now())
                .build());
    }

    private void link(Long classId, Long teacherId) {
        classTeacherRepo.save(ClassTeacher.builder()
                .id(new ClassTeacherId(classId, teacherId))
                .role("PRIMARY")
                .joinedAt(LocalDateTime.now())
                .build());
    }

    private ClassSession saveSession(Long classId, LocalDateTime startAt) {
        return sessionRepo.save(ClassSession.builder()
                .classId(classId)
                .startAt(startAt)
                .durationMinutes(90)
                .mode(ClassSession.Mode.OFFLINE)
                .room("P.302")
                .status(ClassSession.Status.SCHEDULED)
                .overridden(false)
                .build());
    }

    private ClassLessonLog saveLessonLog(Long classId, LocalDate date) {
        return lessonLogRepo.save(ClassLessonLog.builder()
                .classId(classId)
                .sessionDate(date)
                .sessionNumber(1)
                .topic("Perfekt")
                .build());
    }

    private void saveAttendance(Long lessonLogId, Long studentId) {
        attendanceRepo.save(ClassAttendance.builder()
                .id(new ClassAttendanceId(lessonLogId, studentId))
                .status("PRESENT")
                .build());
    }

    private void insertMessage(Long classId, Long senderId, boolean softDeleted) {
        jdbc.update("""
                INSERT INTO class_channel_messages (class_id, sender_id, body, deleted_at)
                VALUES (?, ?, 'Chào lớp', ?)
                """, classId, senderId, softDeleted ? java.sql.Timestamp.from(java.time.Instant.now()) : null);
    }
}
