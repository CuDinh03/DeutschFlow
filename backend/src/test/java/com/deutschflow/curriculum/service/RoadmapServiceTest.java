package com.deutschflow.curriculum.service;

import com.deutschflow.curriculum.dto.RoadmapNodeDto;
import com.deutschflow.user.repository.UserLearningProfileRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

/**
 * Unit tests for the wire contract of {@code GET /roadmap/me}.
 *
 * <p>The tree UI needs four things the flat lesson list never did: which day/week a node sits on,
 * and whether an un-started node is <em>available</em> (bud) or <em>being worked on</em> (flower) —
 * a distinction {@code state} collapses into {@code "current"} — plus how many exercises each of the
 * four skills carries. These tests pin all four, and pin that the legacy 3-value {@code state}
 * keeps its old meaning for the clients already reading it.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
@DisplayName("RoadmapService — wire contract for the learning tree")
class RoadmapServiceTest {

    @Mock private JdbcTemplate jdbcTemplate;
    @Mock private UserLearningProfileRepository profileRepository;

    private RoadmapService service;

    private static final long USER_ID = 42L;

    @BeforeEach
    void setUp() {
        service = new RoadmapService(jdbcTemplate, profileRepository, new ObjectMapper());
        when(profileRepository.findByUserId(anyLong())).thenReturn(Optional.empty());
    }

    // ------------------------------------------------------------------ helpers

    /** A row shaped like {@code v_skill_tree_roadmap_nodes} joined with the user's progress. */
    private Map<String, Object> row(String nodeCode, int day, String userStatus) {
        Map<String, Object> r = new HashMap<>();
        r.put("id", 100 + day);
        r.put("node_code", nodeCode);
        r.put("node_family", "CORE");
        r.put("title_de", "Im Supermarkt");
        r.put("title_vi", "Trong siêu thị");
        r.put("description_vi", "Mua sắm hằng ngày");
        r.put("emoji", "🛒");
        r.put("cefr_level", "A1");
        r.put("day_number", day);
        r.put("week_number", (day - 1) / 5 + 1);
        r.put("sort_order", day);
        r.put("mastery_threshold", 70);
        r.put("estimated_minutes", 15);
        r.put("xp_reward", 100);
        r.put("user_status", userStatus);
        r.put("user_best_score", "COMPLETED".equals(userStatus) ? 90 : 0);
        r.put("prerequisites_json", null);
        r.put("skill_exercise_counts", null);
        return r;
    }

    private void givenRows(List<Map<String, Object>> rows) {
        when(jdbcTemplate.queryForList(anyString(), any(Object[].class))).thenReturn(rows);
    }

    private RoadmapNodeDto onlyNode(List<Map<String, Object>> rows) {
        givenRows(rows);
        List<RoadmapNodeDto> nodes = service.generateRoadmapForUser(USER_ID);
        assertThat(nodes).hasSize(rows.size());
        return nodes.get(0);
    }

    // ------------------------------------------------------------------ day / week

    @Nested
    @DisplayName("day and week")
    class DayAndWeek {

        @Test
        @DisplayName("carries day_number and week_number through to the DTO")
        void exposesCurriculumCalendar() {
            RoadmapNodeDto node = onlyNode(List.of(row("D13", 13, "IN_PROGRESS")));

            assertThat(node.dayNumber()).isEqualTo(13);
            assertThat(node.weekNumber()).isEqualTo(3);
        }

        @Test
        @DisplayName("leaves day/week null when the curriculum row has none")
        void tolueratesMissingCalendar() {
            Map<String, Object> r = row("SAT01", 1, "UNLOCKED");
            r.put("day_number", null);
            r.put("week_number", null);

            RoadmapNodeDto node = onlyNode(List.of(r));

            assertThat(node.dayNumber()).isNull();
            assertThat(node.weekNumber()).isNull();
        }
    }

    // ------------------------------------------------------------------ 4-state progress

    @Nested
    @DisplayName("progressStatus — the fourth state `state` cannot express")
    class ProgressStatus {

        @Test
        @DisplayName("an unlocked but un-started node is AVAILABLE, not IN_PROGRESS")
        void unlockedIsAvailable() {
            RoadmapNodeDto node = onlyNode(List.of(row("D13", 13, "UNLOCKED")));

            assertThat(node.progressStatus()).isEqualTo("AVAILABLE");
            assertThat(node.state()).isEqualTo("current");
        }

        @Test
        @DisplayName("a started node is IN_PROGRESS")
        void startedIsInProgress() {
            RoadmapNodeDto node = onlyNode(List.of(row("D13", 13, "IN_PROGRESS")));

            assertThat(node.progressStatus()).isEqualTo("IN_PROGRESS");
            assertThat(node.state()).isEqualTo("current");
        }

        @Test
        @DisplayName("a finished node is COMPLETED")
        void finishedIsCompleted() {
            RoadmapNodeDto node = onlyNode(List.of(row("D13", 13, "COMPLETED")));

            assertThat(node.progressStatus()).isEqualTo("COMPLETED");
            assertThat(node.state()).isEqualTo("completed");
        }

        @Test
        @DisplayName("a node whose prerequisites are unmet is LOCKED")
        void blockedIsLocked() {
            Map<String, Object> entry = row("D01", 1, "COMPLETED");
            Map<String, Object> blocked = row("D13", 13, "LOCKED");
            blocked.put("prerequisites_json", "[\"D12\"]");

            givenRows(List.of(entry, blocked));
            List<RoadmapNodeDto> nodes = service.generateRoadmapForUser(USER_ID);

            assertThat(nodes.get(1).progressStatus()).isEqualTo("LOCKED");
            assertThat(nodes.get(1).state()).isEqualTo("locked");
        }

        @Test
        @DisplayName("the entry node of a brand-new learner is AVAILABLE, not IN_PROGRESS")
        void freshLearnerEntryNodeIsAvailable() {
            // No progress row anywhere: the service infers the entry node is where to start. That is
            // a bud on the tree — offered, not opened.
            RoadmapNodeDto node = onlyNode(List.of(row("D01", 1, "LOCKED")));

            assertThat(node.state()).isEqualTo("current");
            assertThat(node.progressStatus()).isEqualTo("AVAILABLE");
        }

        @Test
        @DisplayName("progressStatus never contradicts the legacy state field")
        void staysConsistentWithLegacyState() {
            Map<String, Object> blocked = row("D20", 20, "LOCKED");
            blocked.put("prerequisites_json", "[\"D19\"]");

            givenRows(List.of(
                    row("D01", 1, "COMPLETED"),
                    row("D02", 2, "IN_PROGRESS"),
                    row("D03", 3, "UNLOCKED"),
                    blocked));

            for (RoadmapNodeDto node : service.generateRoadmapForUser(USER_ID)) {
                switch (node.state()) {
                    case "completed" -> assertThat(node.progressStatus()).isEqualTo("COMPLETED");
                    case "locked" -> assertThat(node.progressStatus()).isEqualTo("LOCKED");
                    case "current" -> assertThat(node.progressStatus())
                            .isIn("AVAILABLE", "IN_PROGRESS");
                    default -> throw new AssertionError("unexpected state " + node.state());
                }
            }
        }
    }

    // ------------------------------------------------------------------ skill counts

    @Nested
    @DisplayName("skillCounts — how many exercises each skill carries")
    class SkillCounts {

        @Test
        @DisplayName("parses the per-skill exercise tally")
        void parsesCounts() {
            Map<String, Object> r = row("D13", 13, "UNLOCKED");
            r.put("skill_exercise_counts", "{\"HOEREN\":3,\"SPRECHEN\":2,\"LESEN\":2,\"SCHREIBEN\":2}");

            RoadmapNodeDto node = onlyNode(List.of(r));

            assertThat(node.skillCounts())
                    .containsExactlyInAnyOrderEntriesOf(Map.of(
                            "HOEREN", 3, "SPRECHEN", 2, "LESEN", 2, "SCHREIBEN", 2));
        }

        @Test
        @DisplayName("a node with no authored exercises reports an empty tally, never null")
        void missingCountsAreEmpty() {
            RoadmapNodeDto node = onlyNode(List.of(row("D13", 13, "UNLOCKED")));

            assertThat(node.skillCounts()).isNotNull().isEmpty();
        }

        @Test
        @DisplayName("malformed JSON degrades to an empty tally instead of failing the request")
        void malformedCountsDegrade() {
            Map<String, Object> r = row("D13", 13, "UNLOCKED");
            r.put("skill_exercise_counts", "{not json");

            RoadmapNodeDto node = onlyNode(List.of(r));

            assertThat(node.skillCounts()).isNotNull().isEmpty();
        }
    }
}
