package com.deutschflow.curriculum.service;

import com.deutschflow.common.exception.ConflictException;
import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.testsupport.AbstractPostgresIntegrationTest;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * A3 against real Postgres: the answer-free quiz, /check and /review are scoped to the session
 * owner (another learner gets 404), /check writes nothing, and the OLD detail endpoint still
 * carries the answer key for already-shipped clients.
 */
@SpringBootTest
@DisplayName("A3: practice session quiz hides answers and enforces ownership")
class PracticeSessionQuizIntegrationTest extends AbstractPostgresIntegrationTest {

    @Autowired private PracticeSessionQuizService quizService;
    @Autowired private PracticeNodeService practiceNodeService;
    @Autowired private UserRepository userRepository;
    @Autowired private JdbcTemplate jdbcTemplate;

    private long ownerId;
    private long otherId;
    private long sessionId;

    private long newUser(String tag) {
        return userRepository.save(User.builder()
                .email("a3-" + tag + "-" + System.nanoTime() + "@local.test")
                .passwordHash("x")
                .displayName("A3 " + tag)
                .role(User.Role.STUDENT)
                .build()).getId();
    }

    @BeforeEach
    void seed() {
        ownerId = newUser("owner");
        otherId = newUser("other");
        long nodeId = jdbcTemplate.queryForObject("SELECT MIN(id) FROM skill_tree_nodes", Long.class);
        sessionId = jdbcTemplate.queryForObject("""
                INSERT INTO practice_node_sessions
                    (user_id, source_node_id, skill_type, generation, exercises_json, status)
                VALUES (?, ?, 'LESEN', 1, ?::jsonb, 'ACTIVE')
                RETURNING id
                """, Long.class, ownerId, nodeId, """
                {"reading_passage": {"text_type": "E-Mail", "text_de": "Liebe Nachbarn"},
                 "exercises": [
                   {"type": "READ_AND_CHOOSE", "question_de": "Wen?", "options": ["A", "B", "C"],
                    "correct_index": 1, "explanation_vi": "hàng xóm"},
                   {"type": "READ_AND_FILL", "sentence_with_blank": "am ___", "correct_answer": "Samstag"}
                 ]}
                """);
    }

    @Test
    void quizHasNoAnswersButOldDetailStillDoes() {
        Map<String, Object> quiz = quizService.quiz(ownerId, sessionId);
        assertThat(PracticeSessionQuizServiceTest.allKeys(quiz))
                .doesNotContainAnyElementsOf(PracticeSessionQuizServiceTest.ANSWER_KEYS);

        // Backward compatibility: the legacy endpoint's payload is unchanged.
        Map<String, Object> legacy = practiceNodeService.getSessionDetail(ownerId, sessionId);
        assertThat(PracticeSessionQuizServiceTest.allKeys(legacy)).contains("correct_index", "correct_answer");
    }

    @Test
    void otherLearnerCannotReadCheckOrReview() {
        assertThatThrownBy(() -> quizService.quiz(otherId, sessionId)).isInstanceOf(NotFoundException.class);
        assertThatThrownBy(() -> quizService.check(otherId, sessionId, Map.of("0", 1)))
                .isInstanceOf(NotFoundException.class);
        assertThatThrownBy(() -> quizService.review(otherId, sessionId)).isInstanceOf(NotFoundException.class);
    }

    @Test
    void checkWritesNothingAndReviewWaitsForSubmit() {
        @SuppressWarnings("unchecked")
        Map<String, Map<String, Object>> results =
                (Map<String, Map<String, Object>>) quizService.check(ownerId, sessionId, Map.of("0", 1)).get("results");
        assertThat(results.get("0")).containsEntry("correct", true);

        String status = jdbcTemplate.queryForObject(
                "SELECT status FROM practice_node_sessions WHERE id = ?", String.class, sessionId);
        assertThat(status).isEqualTo("ACTIVE");
        assertThatThrownBy(() -> quizService.review(ownerId, sessionId)).isInstanceOf(ConflictException.class);

        jdbcTemplate.update("UPDATE practice_node_sessions SET status = 'COMPLETED' WHERE id = ?", sessionId);
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> reviewed =
                (List<Map<String, Object>>) quizService.review(ownerId, sessionId).get("exercises");
        assertThat(reviewed.get(1)).containsEntry("correct_answer", "Samstag");
    }
}
