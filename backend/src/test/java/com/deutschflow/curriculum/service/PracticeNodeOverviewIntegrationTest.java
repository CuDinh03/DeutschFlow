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
}
