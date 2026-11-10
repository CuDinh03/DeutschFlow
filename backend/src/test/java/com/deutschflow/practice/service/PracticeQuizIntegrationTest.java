package com.deutschflow.practice.service;

import com.deutschflow.practice.dto.PracticeGradeRequest;
import com.deutschflow.practice.dto.PracticeGradeResponse;
import com.deutschflow.practice.dto.PracticeQuizDto;
import com.deutschflow.practice.entity.PracticeExercise;
import com.deutschflow.practice.repository.PracticeExerciseRepository;
import com.deutschflow.testsupport.AbstractPostgresIntegrationTest;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * A3 against real Postgres: the practice-library quiz carries no answer key, and /grade records the
 * attempt then echoes the score + XP from the practice_history row PracticeService just wrote.
 */
@SpringBootTest
@DisplayName("A3: practice library grades on the server and echoes the recorded XP")
class PracticeQuizIntegrationTest extends AbstractPostgresIntegrationTest {

    @Autowired private PracticeQuizService quizService;
    @Autowired private PracticeExerciseRepository exerciseRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private JdbcTemplate jdbcTemplate;
    @Autowired private ObjectMapper objectMapper;

    @Test
    void quizHidesAnswersAndGradeEchoesTheHistoryRow() throws Exception {
        long userId = userRepository.save(User.builder()
                .email("a3-lib-" + System.nanoTime() + "@local.test")
                .passwordHash("x")
                .displayName("A3 library")
                .role(User.Role.STUDENT)
                .build()).getId();
        PracticeExercise exercise = exerciseRepository.save(PracticeExercise.builder()
                .cefrLevel("A1").skillType("READING").examName("A3 IT").xpReward(100)
                .contentJson("""
                        {"questions": [
                          {"id": "q1", "question": "___ Haus", "options": ["der", "die", "das"],
                           "correctAnswer": "das", "explanation": "Haus ist neutral."},
                          {"id": "q2", "question": "___ Frau", "options": ["der", "die", "das"],
                           "correctAnswer": "die"}
                        ]}
                        """)
                .build());

        PracticeQuizDto quiz = quizService.quiz(exercise.getId());
        String json = objectMapper.writeValueAsString(quiz);
        assertThat(json).doesNotContain("\"correctAnswer\"").doesNotContain("\"explanation\"");

        PracticeGradeResponse res = quizService.grade(userId, exercise.getId(),
                new PracticeGradeRequest(Map.of("q1", "das", "q2", "der"), 100));

        Map<String, Object> row = jdbcTemplate.queryForMap("""
                SELECT score_percent, xp_earned FROM practice_history
                WHERE user_id = ? AND practice_id = ? ORDER BY id DESC LIMIT 1
                """, userId, exercise.getId());
        assertThat(res.scorePercent()).isEqualTo(((Number) row.get("score_percent")).intValue()).isEqualTo(50);
        assertThat(res.xpEarned()).isEqualTo(((Number) row.get("xp_earned")).intValue());
        assertThat(res.questions().get(0).explanation()).isEqualTo("Haus ist neutral.");
    }
}
