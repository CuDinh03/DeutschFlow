package com.deutschflow.organization.repository;

import com.deutschflow.testsupport.AbstractPostgresIntegrationTest;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.LocalDate;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Cờ "chỉ nói" (đặc tả luyendeu ORG-65, AC-ORG-46) trên Postgres thật: native query + migration V387.
 * Đặt tên {@code *DbTest} để chạy ở stage unit của CI như {@code PlacementTestServiceDbTest}.
 */
@SpringBootTest
@DisplayName("ClassPracticeProgramRepository — cờ chỉ nói theo lớp có chương trình")
class ClassPracticeProgramRepositoryDbTest extends AbstractPostgresIntegrationTest {

    private static final LocalDate MON = LocalDate.of(2026, 12, 7);

    @Autowired private ClassPracticeProgramRepository repo;
    @Autowired private UserRepository userRepository;
    @Autowired private JdbcTemplate jdbc;

    private long user(User.Role role) {
        return userRepository.save(User.builder()
                .email("luyendeu-" + UUID.randomUUID() + "@test.local")
                .passwordHash("x").displayName("T").role(role).build()).getId();
    }

    private long lop(long teacherId) {
        return jdbc.queryForObject("""
                INSERT INTO teacher_classes (teacher_id, name, invite_code, created_at, updated_at)
                VALUES (?, 'Lớp pilot', ?, NOW(), NOW()) RETURNING id
                """, Long.class, teacherId, UUID.randomUUID().toString().substring(0, 12));
    }

    private void ghiDanh(long classId, long studentId, String status) {
        jdbc.update("INSERT INTO class_students (class_id, student_id, joined_at, status) VALUES (?, ?, NOW(), ?)",
                classId, studentId, status);
    }

    @Test
    @DisplayName("ACTIVE trong lớp có chương trình chưa kết thúc ⇒ chỉ nói; RESERVED, lớp không chương trình, hết chương trình ⇒ không")
    void coChiNoi() {
        long teacher = user(User.Role.TEACHER);
        long a = user(User.Role.STUDENT);
        long b = user(User.Role.STUDENT);
        long c = user(User.Role.STUDENT);
        long lopPilot = lop(teacher);
        long lopThuong = lop(teacher);
        ghiDanh(lopPilot, a, "ACTIVE");
        ghiDanh(lopPilot, c, "RESERVED");
        ghiDanh(lopThuong, b, "ACTIVE");
        jdbc.update("""
                INSERT INTO class_practice_programs (class_id, start_date, weeks, target_per_week, weeks_required)
                VALUES (?, ?, 6, 3, 4)
                """, lopPilot, MON);

        assertThat(repo.isStudentInRunningProgram(a, MON.minusDays(3))).as("trước buổi 0").isTrue();
        assertThat(repo.isStudentInRunningProgram(a, MON.plusWeeks(6).minusDays(1))).as("ngày cuối tuần 6").isTrue();
        assertThat(repo.isStudentInRunningProgram(a, MON.plusWeeks(6))).as("đã hết chương trình").isFalse();
        assertThat(repo.isStudentInRunningProgram(b, MON)).as("lớp không có chương trình").isFalse();
        assertThat(repo.isStudentInRunningProgram(c, MON)).as("đang bảo lưu").isFalse();
    }

    @Test
    @DisplayName("CHECK của V387: ngày bắt đầu phải là thứ Hai")
    void ngayBatDauPhaiLaThuHai() {
        long lopId = lop(user(User.Role.TEACHER));
        org.assertj.core.api.Assertions.assertThatThrownBy(() -> jdbc.update("""
                INSERT INTO class_practice_programs (class_id, start_date) VALUES (?, ?)
                """, lopId, MON.plusDays(1))).isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
    }
}
