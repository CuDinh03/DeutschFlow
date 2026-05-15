package com.deutschflow.quiz.service;

import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.common.exception.ForbiddenException;
import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class TeacherClassroomService {
    private final JdbcTemplate jdbcTemplate;
    private final UserRepository userRepository;

    @Transactional(readOnly = true)
    public List<Map<String, Object>> listClasses(Long teacherId) {
        return jdbcTemplate.queryForList("""
                SELECT c.id,
                       c.name,
                       c.invite_code AS "inviteCode",
                       c.created_at AS "createdAt",
                       (SELECT COUNT(*) FROM classroom_students cs WHERE cs.classroom_id = c.id) AS "studentCount",
                       (SELECT COUNT(*) FROM quizzes q WHERE q.classroom_id = c.id) AS "quizCount"
                FROM classrooms c
                WHERE c.teacher_id = ?
                ORDER BY c.created_at DESC
                """, teacherId);
    }

    @Transactional
    public Map<String, Object> createClass(Long teacherId, String name) {
        String normalizedName = name == null ? "" : name.trim();
        if (normalizedName.isBlank()) {
            throw new BadRequestException("Class name is required");
        }
        String inviteCode = generateInviteCode();
        Long id = jdbcTemplate.queryForObject("""
                INSERT INTO classrooms (teacher_id, name, created_at, invite_code)
                VALUES (?, ?, ?, ?)
                RETURNING id
                """, Long.class, teacherId, normalizedName, Timestamp.valueOf(LocalDateTime.now()), inviteCode);
        return getClassDetail(teacherId, id);
    }

    @Transactional
    public Map<String, Object> updateClass(Long teacherId, Long classId, String name) {
        ensureTeacherOwnsClass(teacherId, classId);
        String normalizedName = name == null ? "" : name.trim();
        if (normalizedName.isBlank()) {
            throw new BadRequestException("Class name is required");
        }
        jdbcTemplate.update("UPDATE classrooms SET name = ? WHERE id = ?", normalizedName, classId);
        return getClassDetail(teacherId, classId);
    }

    @Transactional
    public void deleteClass(Long teacherId, Long classId) {
        ensureTeacherOwnsClass(teacherId, classId);
        jdbcTemplate.update("DELETE FROM classrooms WHERE id = ?", classId);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getClassDetail(Long teacherId, Long classId) {
        ensureTeacherOwnsClass(teacherId, classId);
        Map<String, Object> base = jdbcTemplate.query("""
                SELECT c.id,
                       c.name,
                       c.invite_code AS "inviteCode",
                       c.created_at AS "createdAt"
                FROM classrooms c
                WHERE c.id = ?
                """, rs -> {
            if (!rs.next()) return null;
            return Map.<String, Object>of(
                    "id", rs.getLong("id"),
                    "name", rs.getString("name"),
                    "inviteCode", rs.getString("inviteCode") != null ? rs.getString("inviteCode") : "",
                    "createdAt", rs.getTimestamp("createdAt")
            );
        }, classId);
        if (base == null) throw new NotFoundException("Classroom not found");
        return base;
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> listStudents(Long teacherId, Long classId) {
        ensureTeacherOwnsClass(teacherId, classId);
        return jdbcTemplate.queryForList("""
                SELECT u.id, u.email, u.display_name AS "displayName", cs.joined_at AS "joinedAt"
                FROM classroom_students cs
                JOIN users u ON u.id = cs.student_id
                WHERE cs.classroom_id = ?
                ORDER BY cs.joined_at DESC
                """, classId);
    }

    @Transactional
    public void addStudent(Long teacherId, Long classId, String studentEmail) {
        ensureTeacherOwnsClass(teacherId, classId);
        User student = userRepository.findByEmail(studentEmail)
                .orElseThrow(() -> new NotFoundException("Student not found"));
        if (student.getRole() != User.Role.STUDENT) {
            throw new BadRequestException("Only STUDENT users can join classroom");
        }
        Integer exists = jdbcTemplate.queryForObject("""
                SELECT COUNT(*) FROM classroom_students
                WHERE classroom_id = ? AND student_id = ?
                """, Integer.class, classId, student.getId());
        if (exists != null && exists > 0) {
            throw new BadRequestException("Student already in classroom");
        }
        jdbcTemplate.update("""
                INSERT INTO classroom_students (classroom_id, student_id, joined_at)
                VALUES (?, ?, ?)
                """, classId, student.getId(), Timestamp.valueOf(LocalDateTime.now()));
    }

    @Transactional
    public void removeStudent(Long teacherId, Long classId, Long studentId) {
        ensureTeacherOwnsClass(teacherId, classId);
        jdbcTemplate.update("""
                DELETE FROM classroom_students
                WHERE classroom_id = ? AND student_id = ?
                """, classId, studentId);
    }

    public void ensureTeacherOwnsClass(Long teacherId, Long classId) {
        Map<String, Object> row = jdbcTemplate.query("""
                SELECT id, teacher_id FROM classrooms WHERE id = ?
                """, rs -> {
            if (!rs.next()) return null;
            return Map.<String, Object>of(
                    "id", rs.getLong("id"),
                    "teacherId", rs.getLong("teacher_id")
            );
        }, classId);
        if (row == null) throw new NotFoundException("Classroom not found");
        Long owner = ((Number) row.get("teacherId")).longValue();
        if (!owner.equals(teacherId)) {
            throw new ForbiddenException("Not owner of classroom");
        }
    }

    private String generateInviteCode() {
        String chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        StringBuilder sb = new StringBuilder(6);
        java.util.Random rnd = new java.util.Random();
        for (int i = 0; i < 6; i++) {
            sb.append(chars.charAt(rnd.nextInt(chars.length())));
        }
        return sb.toString();
    }
}

