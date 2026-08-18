package com.deutschflow.curriculum.service;

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

/**
 * Regression contract for {@link PracticeNodeService#getPracticeSessionsForNode(long, long)}.
 *
 * <p>exercises_json stores the LLM output verbatim, which comes in two shapes: a bare array
 * (Hören/Sprechen/Schreiben) or an object carrying {@code exercises} plus extras such as
 * {@code reading_passage} (Lesen). The overview query used to call
 * {@code jsonb_array_length(exercises_json)} unguarded — one object-shaped row aborted the whole
 * query ("cannot get array length of a non-array"), which surfaced as 409 on the overview AND on
 * every skill's {@code /start} for that node (prod incident 2026-08-17, node 106).
 *
 * <p>Runs against real Postgres because the defect lives in the SQL, not in Java.
 * Self-skips when no Postgres is available — see {@link AbstractPostgresIntegrationTest}.
 */
@SpringBootTest
@DisplayName("practice overview survives object-shaped exercises_json")
class PracticeNodeOverviewIntegrationTest extends AbstractPostgresIntegrationTest {

    @Autowired
    private PracticeNodeService service;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    private long userId;
    private long nodeId;

    @BeforeEach
    void seed() {
        userId = userRepository.save(User.builder()
                .email("practice-overview-" + System.nanoTime() + "@local.test")
                .passwordHash("x")
                .displayName("Practice Overview")
                .role(User.Role.STUDENT)
                .build()).getId();
        // Any real curriculum node satisfies the FK; the query only filters by user + node.
        nodeId = jdbcTemplate.queryForObject("SELECT MIN(id) FROM skill_tree_nodes", Long.class);
    }

    private void insertSession(String skillType, String exercisesJson) {
        jdbcTemplate.update("""
                INSERT INTO practice_node_sessions
                    (user_id, source_node_id, skill_type, generation, exercises_json, status)
                VALUES (?, ?, ?, 1, ?::jsonb, 'ACTIVE')
                """, userId, nodeId, skillType, exercisesJson);
    }

    private void insertScoredSession(String skillType, int generation, String status, Integer scorePercent) {
        jdbcTemplate.update("""
                INSERT INTO practice_node_sessions
                    (user_id, source_node_id, skill_type, generation, exercises_json, status, score_percent)
                VALUES (?, ?, ?, ?, '[]'::jsonb, ?, ?)
                """, userId, nodeId, skillType, generation, status, scorePercent);
    }

    @Test
    @DisplayName("best_score_percent survives a regenerated session whose own score is still null")
    void bestScoreSpansAllGenerations() {
        insertScoredSession("HOEREN", 1, "COMPLETED", 85);
        insertScoredSession("HOEREN", 2, "ACTIVE", null);

        Map<String, Object> overview = service.getPracticeSessionsForNode(userId, nodeId);

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> sessions = (List<Map<String, Object>>) overview.get("sessions");
        assertThat(sessions).hasSize(1);
        Map<String, Object> latest = sessions.get(0);
        // The row itself is the latest generation (score not yet earned)…
        assertThat(((Number) latest.get("generation")).intValue()).isEqualTo(2);
        assertThat(latest.get("score_percent")).isNull();
        // …but the mastery earned on Gen-1 is still reported.
        assertThat(((Number) latest.get("best_score_percent")).intValue()).isEqualTo(85);
    }

    @Test
    @DisplayName("counts both authored shapes and never aborts on the object shape")
    void overviewHandlesBothShapes() {
        insertSession("HOEREN", """
                [{"q": "a"}, {"q": "b"}, {"q": "c"}]
                """);
        insertSession("LESEN", """
                {"reading_passage": "Ein kurzer Text.", "exercises": [{"q": "a"}, {"q": "b"}]}
                """);

        Map<String, Object> overview = service.getPracticeSessionsForNode(userId, nodeId);

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> sessions = (List<Map<String, Object>>) overview.get("sessions");
        assertThat(sessions).hasSize(2);
        Map<String, Integer> countBySkill = sessions.stream().collect(
                java.util.stream.Collectors.toMap(
                        s -> (String) s.get("skill_type"),
                        s -> ((Number) s.get("exercise_count")).intValue()));
        assertThat(countBySkill).containsEntry("HOEREN", 3).containsEntry("LESEN", 2);
    }

    @Test
    @DisplayName("a degenerate scalar payload counts as 0 instead of aborting the query")
    void scalarPayloadCountsAsZero() {
        insertSession("SCHREIBEN", "\"kaputt\"");

        Map<String, Object> overview = service.getPracticeSessionsForNode(userId, nodeId);

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> sessions = (List<Map<String, Object>>) overview.get("sessions");
        assertThat(sessions).hasSize(1);
        assertThat(((Number) sessions.get(0).get("exercise_count")).intValue()).isZero();
    }

    @Test
    @DisplayName("an LLM wrapper shell that slipped past normalization is counted via its content array")
    void wrapperShellCountsContent() {
        // Write-time normalization (normalizeExercisePayload) + V275 should keep this shape out of
        // the table; the defensive CASE branch still counts it instead of showing an empty session.
        insertSession("SPRECHEN", """
                {"type": "object", "content": [{"q": "a"}, {"q": "b"}]}
                """);

        Map<String, Object> overview = service.getPracticeSessionsForNode(userId, nodeId);

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> sessions = (List<Map<String, Object>>) overview.get("sessions");
        assertThat(sessions).hasSize(1);
        assertThat(((Number) sessions.get(0).get("exercise_count")).intValue()).isEqualTo(2);
    }
}
