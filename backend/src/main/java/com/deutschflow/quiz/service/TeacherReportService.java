package com.deutschflow.quiz.service;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;

@Service
@RequiredArgsConstructor
public class TeacherReportService {
    private final JdbcTemplate jdbcTemplate;
    private final TeacherClassroomService teacherClassroomService;

    @Transactional(readOnly = true)
    public Map<String, Object> overview(Long teacherId) {
        Integer classCount = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM classrooms WHERE teacher_id = ?", Integer.class, teacherId);
        Integer quizCount = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM quizzes WHERE teacher_id = ?", Integer.class, teacherId);
        Integer activeQuizCount = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM quizzes WHERE teacher_id = ? AND status = 'ACTIVE'", Integer.class, teacherId);
        Integer studentCount = jdbcTemplate.queryForObject("""
                SELECT COUNT(DISTINCT cs.student_id)
                FROM classrooms c
                LEFT JOIN classroom_students cs ON cs.classroom_id = c.id
                WHERE c.teacher_id = ?
                """, Integer.class, teacherId);
        Double avgScore = jdbcTemplate.queryForObject("""
                SELECT AVG(qs.total_score)
                FROM quizzes q
                JOIN quiz_sessions qs ON qs.quiz_id = q.id
                WHERE q.teacher_id = ?
                """, Double.class, teacherId);
        return Map.of(
                "classCount", classCount == null ? 0 : classCount,
                "quizCount", quizCount == null ? 0 : quizCount,
                "activeQuizCount", activeQuizCount == null ? 0 : activeQuizCount,
                "studentCount", studentCount == null ? 0 : studentCount,
                "avgScore", avgScore == null ? 0.0 : avgScore
        );
    }

    @Transactional(readOnly = true)
    public Map<String, Object> classReport(Long teacherId, Long classId) {
        teacherClassroomService.ensureTeacherOwnsClass(teacherId, classId);
        Integer studentCount = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM classroom_students WHERE classroom_id = ?",
                Integer.class, classId
        );
        Integer quizCount = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM quizzes WHERE classroom_id = ?",
                Integer.class, classId
        );
        Double avgScore = jdbcTemplate.queryForObject("""
                SELECT AVG(qs.total_score)
                FROM quizzes q
                JOIN quiz_sessions qs ON qs.quiz_id = q.id
                WHERE q.classroom_id = ?
                """, Double.class, classId);
        return Map.of(
                "classroomId", classId,
                "studentCount", studentCount == null ? 0 : studentCount,
                "quizCount", quizCount == null ? 0 : quizCount,
                "avgScore", avgScore == null ? 0.0 : avgScore
        );
    }
}

