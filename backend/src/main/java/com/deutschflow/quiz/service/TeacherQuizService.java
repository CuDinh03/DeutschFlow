package com.deutschflow.quiz.service;

import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.common.exception.NotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ThreadLocalRandom;

@Service
@RequiredArgsConstructor
public class TeacherQuizService {
    private final JdbcTemplate jdbcTemplate;
    private final TeacherClassroomService teacherClassroomService;

    @Transactional(readOnly = true)
    public List<Map<String, Object>> listQuizzes(Long teacherId) {
        return jdbcTemplate.queryForList("""
                SELECT q.id, q.title, q.quiz_type AS quizType, q.pin_code AS pinCode, q.status, q.created_at AS createdAt,
                       q.classroom_id AS classroomId,
                       c.name AS classroomName,
                       (SELECT COUNT(*) FROM quiz_questions qq WHERE qq.quiz_id = q.id) AS questionCount
                FROM quizzes q
                LEFT JOIN classrooms c ON c.id = q.classroom_id
                WHERE q.teacher_id = ?
                ORDER BY q.created_at DESC
                """, teacherId);
    }

    @Transactional
    public Map<String, Object> createQuiz(Long teacherId, String title, String quizType, Long classroomId) {
        String normalizedTitle = title == null ? "" : title.trim();
        if (normalizedTitle.isBlank()) throw new BadRequestException("Quiz title is required");
        if (!"COLOR_RACE".equals(quizType) && !"SENTENCE_BATTLE".equals(quizType)) {
            throw new BadRequestException("Invalid quizType");
        }
        if (classroomId != null) {
            teacherClassroomService.ensureTeacherOwnsClass(teacherId, classroomId);
        }
        String pin = generateUniquePin();
        jdbcTemplate.update("""
                INSERT INTO quizzes (teacher_id, classroom_id, title, quiz_type, pin_code, status, created_at)
                VALUES (?, ?, ?, ?, ?, 'DRAFT', ?)
                """, teacherId, classroomId, normalizedTitle, quizType, pin, Timestamp.valueOf(LocalDateTime.now()));
        Long id = jdbcTemplate.queryForObject("SELECT LAST_INSERT_ID()", Long.class);
        return getQuizDetail(teacherId, id);
    }

    @Transactional
    public Map<String, Object> updateQuiz(Long teacherId, Long quizId, String title, String quizType, Long classroomId) {
        ensureTeacherOwnsQuiz(teacherId, quizId);
        String normalizedTitle = title == null ? "" : title.trim();
        if (normalizedTitle.isBlank()) throw new BadRequestException("Quiz title is required");
        if (!"COLOR_RACE".equals(quizType) && !"SENTENCE_BATTLE".equals(quizType)) {
            throw new BadRequestException("Invalid quizType");
        }
        if (classroomId != null) {
            teacherClassroomService.ensureTeacherOwnsClass(teacherId, classroomId);
        }
        jdbcTemplate.update("""
                UPDATE quizzes
                SET title = ?, quiz_type = ?, classroom_id = ?
                WHERE id = ?
                """, normalizedTitle, quizType, classroomId, quizId);
        return getQuizDetail(teacherId, quizId);
    }

    @Transactional
    public void deleteQuiz(Long teacherId, Long quizId) {
        ensureTeacherOwnsQuiz(teacherId, quizId);
        jdbcTemplate.update("DELETE FROM quizzes WHERE id = ?", quizId);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getQuizDetail(Long teacherId, Long quizId) {
        ensureTeacherOwnsQuiz(teacherId, quizId);
        Map<String, Object> base = jdbcTemplate.query("""
                SELECT q.id, q.title, q.quiz_type AS quizType, q.pin_code AS pinCode, q.status,
                       q.created_at AS createdAt, q.classroom_id AS classroomId
                FROM quizzes q
                WHERE q.id = ?
                """, rs -> {
            if (!rs.next()) return null;
            Map<String, Object> out = new java.util.LinkedHashMap<>();
            out.put("id", rs.getLong("id"));
            out.put("title", rs.getString("title"));
            out.put("quizType", rs.getString("quizType"));
            out.put("pinCode", rs.getString("pinCode"));
            out.put("status", rs.getString("status"));
            out.put("createdAt", rs.getTimestamp("createdAt"));
            out.put("classroomId", rs.getObject("classroomId"));
            return out;
        }, quizId);
        if (base == null) throw new NotFoundException("Quiz not found");
        return base;
    }

    @Transactional
    public void addQuestion(Long teacherId, Long quizId, String question, Integer timeLimit, Integer position, List<Map<String, Object>> choices) {
        ensureTeacherOwnsQuiz(teacherId, quizId);
        if (question == null || question.trim().isBlank()) throw new BadRequestException("question is required");
        if (choices == null || choices.size() < 2) throw new BadRequestException("at least 2 choices are required");
        int validCorrect = 0;
        for (Map<String, Object> c : choices) {
            if (Boolean.TRUE.equals(c.get("isCorrect"))) validCorrect++;
        }
        if (validCorrect != 1) throw new BadRequestException("exactly one choice must be correct");

        int normalizedTime = timeLimit == null ? 20 : Math.max(5, Math.min(120, timeLimit));
        int normalizedPosition = position == null ? nextPosition(quizId) : Math.max(1, position);

        jdbcTemplate.update("""
                INSERT INTO quiz_questions (quiz_id, question, time_limit, position)
                VALUES (?, ?, ?, ?)
                """, quizId, question.trim(), normalizedTime, normalizedPosition);
        Long questionId = jdbcTemplate.queryForObject("SELECT LAST_INSERT_ID()", Long.class);

        for (Map<String, Object> c : choices) {
            String content = String.valueOf(c.get("content"));
            boolean isCorrect = Boolean.TRUE.equals(c.get("isCorrect"));
            jdbcTemplate.update("""
                    INSERT INTO quiz_choices (question_id, content, is_correct)
                    VALUES (?, ?, ?)
                    """, questionId, content, isCorrect);
        }
    }

    @Transactional
    public void updateStatus(Long teacherId, Long quizId, String status) {
        ensureTeacherOwnsQuiz(teacherId, quizId);
        if (!List.of("DRAFT", "WAITING", "ACTIVE", "FINISHED").contains(status)) {
            throw new BadRequestException("Invalid status");
        }
        jdbcTemplate.update("UPDATE quizzes SET status = ? WHERE id = ?", status, quizId);
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> listResults(Long teacherId, Long quizId) {
        ensureTeacherOwnsQuiz(teacherId, quizId);
        return jdbcTemplate.queryForList("""
                SELECT qs.id, qs.participant, qs.user_id AS userId, qs.total_score AS totalScore,
                       qs.joined_at AS joinedAt, qs.finished_at AS finishedAt
                FROM quiz_sessions qs
                WHERE qs.quiz_id = ?
                ORDER BY qs.total_score DESC, qs.finished_at ASC
                """, quizId);
    }

    public void ensureTeacherOwnsQuiz(Long teacherId, Long quizId) {
        Map<String, Object> row = jdbcTemplate.query("""
                SELECT id, teacher_id FROM quizzes WHERE id = ?
                """, rs -> {
            if (!rs.next()) return null;
            return Map.<String, Object>of(
                    "id", rs.getLong("id"),
                    "teacherId", rs.getLong("teacher_id")
            );
        }, quizId);
        if (row == null) throw new NotFoundException("Quiz not found");
        Long owner = ((Number) row.get("teacherId")).longValue();
        if (!owner.equals(teacherId)) {
            throw new BadRequestException("Quiz does not belong to current teacher");
        }
    }

    private int nextPosition(Long quizId) {
        Integer max = jdbcTemplate.queryForObject("""
                SELECT COALESCE(MAX(position), 0) FROM quiz_questions WHERE quiz_id = ?
                """, Integer.class, quizId);
        return (max == null ? 0 : max) + 1;
    }

    private String generateUniquePin() {
        for (int i = 0; i < 20; i++) {
            String pin = String.valueOf(ThreadLocalRandom.current().nextInt(100000, 1000000));
            Integer count = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM quizzes WHERE pin_code = ?", Integer.class, pin);
            if (count != null && count == 0) return pin;
        }
        throw new BadRequestException("Failed to generate unique quiz pin");
    }
}

