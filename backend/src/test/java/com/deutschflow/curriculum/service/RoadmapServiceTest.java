package com.deutschflow.curriculum.service;

import com.deutschflow.curriculum.dto.RoadmapNodeDto;
import com.deutschflow.user.entity.UserLearningProfile;
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
        @DisplayName("the node right after a COMPLETED one is AVAILABLE — the learner is never dead-ended (06/09)")
        void nodeAfterCompletedPredecessorIsAvailable() {
            // QA 06/09: Tesst2 finished D01 (100%) but the Lernweg kept D02 LOCKED while the Học tab
            // already offered "Ngày 2". Nothing writes D02's UNLOCKED row on completion, so the
            // service must derive availability at read time like SkillTreeService does.
            givenRows(List.of(row("D01", 1, "COMPLETED"), row("D02", 2, "LOCKED"), row("D03", 3, "LOCKED")));
            List<RoadmapNodeDto> nodes = service.generateRoadmapForUser(USER_ID);

            assertThat(nodes.get(0).progressStatus()).isEqualTo("COMPLETED");
            assertThat(nodes.get(1).state()).isEqualTo("current");
            assertThat(nodes.get(1).progressStatus()).isEqualTo("AVAILABLE");
            assertThat(nodes.get(2).progressStatus()).isEqualTo("LOCKED"); // only ONE bud is offered
        }

        @Test
        @DisplayName("a prerequisite listed in prerequisites_json counts as met once that node is COMPLETED")
        void prerequisiteSatisfiedByCompletedNodeIsAvailable() {
            Map<String, Object> second = row("D02", 2, "LOCKED");
            second.put("prerequisites_json", "[\"D01\"]");
            Map<String, Object> third = row("D03", 3, "LOCKED");
            third.put("prerequisites_json", "[\"D02\"]");

            givenRows(List.of(row("D01", 1, "COMPLETED"), second, third));
            List<RoadmapNodeDto> nodes = service.generateRoadmapForUser(USER_ID);

            assertThat(nodes.get(1).progressStatus()).isEqualTo("AVAILABLE");
            assertThat(nodes.get(2).progressStatus()).isEqualTo("LOCKED");
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

    @Nested
    @DisplayName("GET /roadmap/me/meta — currentNodeCode không được null")
    class Meta {

        /** Node nền tảng ngày 1–10 trên production có {@code node_code} NULL. */
        private Map<String, Object> rowWithCode(String nodeCode) {
            Map<String, Object> r = new HashMap<>();
            r.put("node_code", nodeCode);
            return r;
        }

        @Test
        @DisplayName("Chưa có tiến độ, node đầu không có mã: trả mã node vào lộ trình thay vì 500")
        void firstNodeWithoutCodeFallsBackToEntry() {
            when(jdbcTemplate.queryForList(anyString(), any(Object[].class))).thenReturn(List.of());
            when(jdbcTemplate.queryForList(anyString())).thenReturn(List.of(rowWithCode(null)));

            assertThat(service.getRoadmapMeta(USER_ID)).containsEntry("currentNodeCode", "D01");
        }

        @Test
        @DisplayName("Đang học node không có mã: vẫn trả được meta")
        void progressOnNodeWithoutCodeFallsBackToEntry() {
            when(jdbcTemplate.queryForList(anyString(), any(Object[].class)))
                    .thenReturn(List.of(rowWithCode(null)));

            assertThat(service.getRoadmapMeta(USER_ID)).containsEntry("currentNodeCode", "D01");
        }

        @Test
        @DisplayName("Node có mã: giữ nguyên mã đó")
        void keepsRealNodeCode() {
            when(jdbcTemplate.queryForList(anyString(), any(Object[].class)))
                    .thenReturn(List.of(rowWithCode("A1-001")));

            assertThat(service.getRoadmapMeta(USER_ID)).containsEntry("currentNodeCode", "A1-001");

    // ------------------------------------------------------------------ entry by level

    @Nested
    @DisplayName("starting level decides where the roadmap begins (QA 01/11)")
    class EntryByLevel {

        private Map<String, Object> at(int day, int week, String cefr) {
            Map<String, Object> r = row("N" + day, day, "LOCKED");
            r.put("week_number", week);
            r.put("cefr_level", cefr);
            return r;
        }

        private List<RoadmapNodeDto> roadmapFor(UserLearningProfile.CurrentLevel level) {
            when(profileRepository.findByUserId(anyLong())).thenReturn(Optional.of(
                    UserLearningProfile.builder().currentLevel(level).build()));
            givenRows(List.of(
                    at(1, 1, "A1"), at(10, 2, "A1"), at(11, 3, "A1"), at(12, 3, "A1"), at(30, 7, "A1"),
                    at(31, 8, "A2"), at(35, 9, "A2"),
                    at(51, 13, "B1"), at(52, 13, "B1"), at(54, 14, "B1")));
            return service.generateRoadmapForUser(USER_ID);
        }

        @Test
        @DisplayName("a B1 learner starts on B1 content, never on A1 day 11")
        void b1StartsAtB1() {
            List<RoadmapNodeDto> nodes = roadmapFor(UserLearningProfile.CurrentLevel.B1);

            assertThat(nodes).extracting(RoadmapNodeDto::cefrLevel).containsOnly("B1");
            assertThat(nodes.get(0).progressStatus()).isEqualTo("AVAILABLE");
            assertThat(nodes.get(1).progressStatus()).isEqualTo("LOCKED");
        }

        @Test
        @DisplayName("day and week count from the learner's own start, so a new account reads day 1")
        void calendarCountsFromTheLearnersStart() {
            List<RoadmapNodeDto> nodes = roadmapFor(UserLearningProfile.CurrentLevel.B1);

            assertThat(nodes).extracting(RoadmapNodeDto::dayNumber).containsExactly(1, 2, 4);
            assertThat(nodes).extracting(RoadmapNodeDto::weekNumber).containsExactly(1, 1, 2);
        }

        @Test
        @DisplayName("an A2 learner starts at the first A2 node and keeps going into B1")
        void a2StartsAtA2() {
            List<RoadmapNodeDto> nodes = roadmapFor(UserLearningProfile.CurrentLevel.A2);

            assertThat(nodes).extracting(RoadmapNodeDto::cefrLevel)
                    .containsExactly("A2", "A2", "B1", "B1", "B1");
            assertThat(nodes.get(0).dayNumber()).isEqualTo(1);
            assertThat(nodes.get(0).state()).isEqualTo("current");
        }

        @Test
        @DisplayName("an A1 learner skips the foundation days and starts at day 11")
        void a1SkipsFoundation() {
            List<RoadmapNodeDto> nodes = roadmapFor(UserLearningProfile.CurrentLevel.A1);

            assertThat(nodes).hasSize(8);
            assertThat(nodes.get(0).code()).isEqualTo("N11");
            assertThat(nodes.get(0).state()).isEqualTo("current");
        }

        @Test
        @DisplayName("an A0 learner gets the whole curriculum from day 1, numbers untouched")
        void a0GetsEverything() {
            List<RoadmapNodeDto> nodes = roadmapFor(UserLearningProfile.CurrentLevel.A0);

            assertThat(nodes).hasSize(10);
            assertThat(nodes.get(0).code()).isEqualTo("N1");
            assertThat(nodes.get(0).state()).isEqualTo("current");
            assertThat(nodes.get(9).dayNumber()).isEqualTo(54);
        }

        @Test
        @DisplayName("a level above the curriculum falls back to the highest level that has content")
        void b2UsesHighestAvailable() {
            List<RoadmapNodeDto> nodes = roadmapFor(UserLearningProfile.CurrentLevel.B2);

            assertThat(nodes).extracting(RoadmapNodeDto::code).containsExactly("N51", "N52", "N54");
            assertThat(nodes.get(0).state()).isEqualTo("current");
        }
    }
}
