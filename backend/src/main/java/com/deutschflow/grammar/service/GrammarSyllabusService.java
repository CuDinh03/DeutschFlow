package com.deutschflow.grammar.service;

import com.deutschflow.ai.AIModelService;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.*;

/**
 * Service for structured grammar syllabus:
 * - Topic listing by CEFR
 * - AI exercise generation (Teacher flow)
 * - Exercise CRUD + review workflow
 * - Student progress tracking
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class GrammarSyllabusService {

    private final JdbcTemplate jdbcTemplate;
    private final AIModelService aiModelService;
    private final ObjectMapper objectMapper;

    // ─── Topics ──────────────────────────────────────────────────

    public List<Map<String, Object>> getTopics(String cefrLevel) {
        return jdbcTemplate.queryForList("""
            SELECT id, cefr_level, topic_code, title_de, title_vi, title_en,
                   description_vi, sort_order
            FROM grammar_topics
            WHERE cefr_level = ? AND is_active = TRUE
            ORDER BY sort_order
            """, cefrLevel);
    }

    public List<Map<String, Object>> getTopicsWithProgress(String cefrLevel, long userId) {
        return jdbcTemplate.queryForList("""
            SELECT t.id, t.cefr_level, t.topic_code, t.title_de, t.title_vi, t.title_en,
                   t.description_vi, t.sort_order,
                   COALESCE(p.exercises_done, 0) AS exercises_done,
                   COALESCE(p.exercises_correct, 0) AS exercises_correct,
                   COALESCE(p.mastery_percent, 0) AS mastery_percent,
                   p.last_practiced_at,
                   (SELECT COUNT(*) FROM grammar_exercises e WHERE e.topic_id = t.id AND e.status = 'APPROVED') AS total_exercises
            FROM grammar_topics t
            LEFT JOIN grammar_topic_progress p ON p.topic_id = t.id AND p.user_id = ?
            WHERE t.cefr_level = ? AND t.is_active = TRUE
            ORDER BY t.sort_order
            """, userId, cefrLevel);
    }

    // ─── Exercises (Student) ─────────────────────────────────────

    public List<Map<String, Object>> getApprovedExercises(long topicId, int limit) {
        return jdbcTemplate.queryForList("""
            SELECT id, exercise_type, difficulty, question_json::text AS question_json
            FROM grammar_exercises
            WHERE topic_id = ? AND status = 'APPROVED'
            ORDER BY difficulty, id
            LIMIT ?
            """, topicId, limit);
    }

    @Transactional
    public Map<String, Object> submitAnswer(long userId, long exerciseId, String answer) {
        var exercise = jdbcTemplate.queryForMap("""
            SELECT e.id, e.topic_id, e.question_json::text AS question_json
            FROM grammar_exercises e WHERE e.id = ? AND e.status = 'APPROVED'
            """, exerciseId);

        try {
            Map<String, Object> questionData = objectMapper.readValue(
                (String) exercise.get("question_json"),
                new TypeReference<>() {}
            );

            String correctAnswer = String.valueOf(questionData.get("correct_answer"));
            boolean isCorrect = correctAnswer.equalsIgnoreCase(answer.trim());
            long topicId = ((Number) exercise.get("topic_id")).longValue();

            // Upsert progress
            jdbcTemplate.update("""
                INSERT INTO grammar_topic_progress (user_id, topic_id, exercises_done, exercises_correct, mastery_percent, last_practiced_at)
                VALUES (?, ?, 1, ?, ?, NOW())
                ON CONFLICT (user_id, topic_id) DO UPDATE SET
                    exercises_done = grammar_topic_progress.exercises_done + 1,
                    exercises_correct = grammar_topic_progress.exercises_correct + ?,
                    mastery_percent = CASE
                        WHEN (grammar_topic_progress.exercises_done + 1) > 0
                        THEN ((grammar_topic_progress.exercises_correct + ?)::real / (grammar_topic_progress.exercises_done + 1)) * 100
                        ELSE 0 END,
                    last_practiced_at = NOW()
                """, userId, topicId,
                    isCorrect ? 1 : 0, isCorrect ? 100.0 : 0.0,
                    isCorrect ? 1 : 0, isCorrect ? 1 : 0);

            return Map.of(
                "correct", isCorrect,
                "correctAnswer", correctAnswer,
                "explanation", questionData.getOrDefault("explanation_vi", "")
            );
        } catch (Exception e) {
            log.error("Error processing answer", e);
            throw new RuntimeException("Failed to process answer", e);
        }
    }

    // ─── AI Generation (Teacher) ─────────────────────────────────

    @Transactional
    public List<Map<String, Object>> generateExercises(long topicId, int count, long teacherUserId) {
        var topic = jdbcTemplate.queryForMap(
            "SELECT topic_code, title_de, title_vi, cefr_level FROM grammar_topics WHERE id = ?", topicId);

        String prompt = String.format("""
            Generate %d German grammar exercises for the topic "%s" (CEFR %s).
            
            Return a JSON array. Each exercise must have:
            - "exercise_type": one of "FILL_BLANK", "MULTIPLE_CHOICE", "TRANSLATE"
            - "difficulty": 1-5
            - "prompt": the question/sentence in German
            - "options": array of 4 choices (for MULTIPLE_CHOICE) or empty array
            - "correct_answer": the correct answer string
            - "explanation_vi": explanation in Vietnamese
            - "explanation_de": explanation in German
            
            Topic: %s (%s)
            Level: %s
            
            IMPORTANT: Return ONLY a valid JSON array, no markdown, no extra text.
            """,
            count,
            topic.get("title_de"), topic.get("cefr_level"),
            topic.get("title_de"), topic.get("title_vi"),
            topic.get("cefr_level")
        );

        String raw = aiModelService.generate(prompt, "", 4096, 0.7);

        try {
            // Extract JSON array from response
            String json = raw.trim();
            int start = json.indexOf('[');
            int end = json.lastIndexOf(']');
            if (start >= 0 && end > start) {
                json = json.substring(start, end + 1);
            }

            List<Map<String, Object>> exercises = objectMapper.readValue(json, new TypeReference<>() {});
            List<Map<String, Object>> created = new ArrayList<>();

            for (var ex : exercises) {
                String questionJson = objectMapper.writeValueAsString(ex);
                String exType = String.valueOf(ex.getOrDefault("exercise_type", "MULTIPLE_CHOICE"));
                int diff = ex.containsKey("difficulty") ? ((Number) ex.get("difficulty")).intValue() : 1;

                var row = jdbcTemplate.queryForMap("""
                    INSERT INTO grammar_exercises (topic_id, exercise_type, difficulty, question_json, status, created_by, ai_generated)
                    VALUES (?, ?, ?, ?::jsonb, 'DRAFT', ?, TRUE)
                    RETURNING id, exercise_type, difficulty, status
                    """, topicId, exType, diff, questionJson, teacherUserId);

                row.put("question_json", questionJson);
                created.add(row);
            }

            return created;
        } catch (Exception e) {
            log.error("Failed to parse AI-generated exercises", e);
            throw new RuntimeException("AI generation failed: " + e.getMessage(), e);
        }
    }

    // ─── Teacher CRUD ────────────────────────────────────────────

    public List<Map<String, Object>> getMyDrafts(long teacherUserId) {
        return jdbcTemplate.queryForList("""
            SELECT e.id, e.topic_id, t.title_de AS topic_title, e.exercise_type,
                   e.difficulty, e.question_json::text AS question_json, e.status,
                   e.reject_reason, e.created_at
            FROM grammar_exercises e
            JOIN grammar_topics t ON t.id = e.topic_id
            WHERE e.created_by = ?
            ORDER BY e.created_at DESC
            """, teacherUserId);
    }

    @Transactional
    public void submitForReview(long exerciseId, long teacherUserId) {
        jdbcTemplate.update("""
            UPDATE grammar_exercises SET status = 'PENDING_REVIEW'
            WHERE id = ? AND created_by = ? AND status = 'DRAFT'
            """, exerciseId, teacherUserId);
    }

    @Transactional
    public void submitAllDraftsForReview(long topicId, long teacherUserId) {
        jdbcTemplate.update("""
            UPDATE grammar_exercises SET status = 'PENDING_REVIEW'
            WHERE topic_id = ? AND created_by = ? AND status = 'DRAFT'
            """, topicId, teacherUserId);
    }

    // ─── Admin Review ────────────────────────────────────────────

    public List<Map<String, Object>> getPendingReview() {
        return jdbcTemplate.queryForList("""
            SELECT e.id, e.topic_id, t.title_de AS topic_title, t.cefr_level,
                   e.exercise_type, e.difficulty, e.question_json::text AS question_json,
                   e.status, e.ai_generated, e.created_by, e.created_at
            FROM grammar_exercises e
            JOIN grammar_topics t ON t.id = e.topic_id
            WHERE e.status = 'PENDING_REVIEW'
            ORDER BY e.created_at
            """);
    }

    @Transactional
    public void approveExercise(long exerciseId, long adminUserId) {
        jdbcTemplate.update("""
            UPDATE grammar_exercises SET status = 'APPROVED', reviewed_by = ?, reviewed_at = NOW()
            WHERE id = ? AND status = 'PENDING_REVIEW'
            """, adminUserId, exerciseId);
    }

    @Transactional
    public void rejectExercise(long exerciseId, long adminUserId, String reason) {
        jdbcTemplate.update("""
            UPDATE grammar_exercises SET status = 'REJECTED', reviewed_by = ?, reviewed_at = NOW(), reject_reason = ?
            WHERE id = ? AND status = 'PENDING_REVIEW'
            """, adminUserId, reason, exerciseId);
    }

    @Transactional
    public void bulkApprove(List<Long> exerciseIds, long adminUserId) {
        for (long id : exerciseIds) {
            approveExercise(id, adminUserId);
        }
    }
}
