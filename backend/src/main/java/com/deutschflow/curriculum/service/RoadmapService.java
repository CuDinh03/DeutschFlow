package com.deutschflow.curriculum.service;

import com.deutschflow.curriculum.dto.RoadmapNodeDto;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.entity.UserLearningProfile;
import com.deutschflow.user.repository.UserLearningProfileRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * DB-driven roadmap service for the foundation-first learning spine.
 *
 * <p>Source of truth:
 * <ul>
 *   <li>skill_tree_nodes</li>
 *   <li>v_skill_tree_roadmap_nodes</li>
 *   <li>skill_tree_user_progress</li>
 *   <li>user_learning_profiles</li>
 * </ul>
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class RoadmapService {

    private static final String ROADMAP_MODEL = "ROADMAP_STATES_V1";
    private static final String ROADMAP_VERSION = "A0_A1_Foundation_First";
    private static final String ROADMAP_TYPE = "FOUNDATION_FIRST";
    private static final String ENTRY_NODE_CODE = "D01";

    private final JdbcTemplate jdbcTemplate;
    private final UserLearningProfileRepository profileRepository;
    private final ObjectMapper objectMapper;

    public List<RoadmapNodeDto> generateRoadmapForUser(Long userId) {
        UserLearningProfile profile = profileRepository.findByUserId(userId).orElse(null);
        String roadmapType = resolveRoadmapType(profile);
        String startingLevel = resolveCurrentLevel(profile);
        boolean beginnerFoundation = "A0".equals(startingLevel);
        RoadmapEntry entry = RoadmapEntry.forLevel(startingLevel);

        List<Map<String, Object>> curriculum = jdbcTemplate.queryForList("""
                SELECT
                    n.id,
                    n.node_code,
                    n.node_family,
                    n.node_type,
                    n.title_de,
                    n.title_vi,
                    n.description_vi,
                    n.emoji,
                    n.phase,
                    n.cefr_level,
                    n.day_number,
                    n.week_number,
                    n.sort_order,
                    n.mastery_threshold,
                    n.unlock_rule,
                    n.estimated_minutes,
                    n.xp_reward,
                    n.energy_cost,
                    n.content_key,
                    n.tags,
                    n.prerequisites_json,
                    n.unlock_metadata,
                    -- Per-skill exercise tally, counted in SQL so the ~30KB content_json never
                    -- crosses the wire. Two authored shapes: a bare array (Hören/Sprechen/Schreiben)
                    -- or an object carrying `exercises` (Lesen, which also holds reading_passage).
                    -- KEEP IN SYNC with the identical expression in SkillTreeService#getSkillTreeForUser.
                    (
                        SELECT jsonb_object_agg(e.key, CASE
                                   WHEN jsonb_typeof(e.value) = 'array'
                                       THEN jsonb_array_length(e.value)
                                   WHEN jsonb_typeof(e.value -> 'exercises') = 'array'
                                       THEN jsonb_array_length(e.value -> 'exercises')
                                   ELSE 0
                               END)::text
                        FROM jsonb_each(
                                 CASE WHEN jsonb_typeof(n.content_json -> 'skill_exercises') = 'object'
                                      THEN n.content_json -> 'skill_exercises'
                                      ELSE '{}'::jsonb END
                             ) AS e
                    ) AS skill_exercise_counts,
                    COALESCE(p.status, 'LOCKED') AS user_status,
                    COALESCE(p.score_percent, 0) AS user_score,
                    COALESCE(p.best_score, 0) AS user_best_score,
                    COALESCE(p.attempts, 0) AS user_attempts,
                    COALESCE(p.xp_earned, 0) AS user_xp,
                    %s AS scored_item_count,
                    %s AS dependencies_met
                FROM v_skill_tree_roadmap_nodes n
                LEFT JOIN skill_tree_user_progress p
                    ON p.node_id = n.id AND p.user_id = ?
                WHERE %s
                ORDER BY COALESCE(n.day_number, 9999) ASC, COALESCE(n.sort_order, 9999) ASC, n.id ASC
                """.formatted(RoadmapRules.SCORED_ITEM_COUNT, RoadmapRules.DEPENDENCIES_MET, RoadmapRules.PUBLISHED),
                userId, entry.day(), userId);
        List<Map<String, Object>> rows = curriculum.stream()
                .filter(r -> r.get("day_number") == null || asInt(r.get("day_number")) >= entry.day())
                .collect(Collectors.toCollection(ArrayList::new));

        if (!beginnerFoundation && roadmapType != null) {
            log.debug("Generating personalized roadmap branch for user {} with type {} and level {}", userId, roadmapType, startingLevel);
        }

        // ROUTE-03 (đợt 1, 14/11/2026): không còn sắp lại bài theo `interests`; thứ tự cố định theo
        // day_number, sort_order.
        List<RoadmapNodeDto> nodes = new ArrayList<>(rows.size());

        for (Map<String, Object> row : rows) {
            String state = computeState(row);
            int lessonsTotal = resolveLessonsTotal(row);
            int lessonsCompleted = resolveLessonsCompleted(row, state, lessonsTotal);

            nodes.add(new RoadmapNodeDto(
                    asInt(row.get("id")),
                    asString(row.get("node_code")),
                    asString(row.get("title_de")),
                    asString(row.get("title_vi")),
                    asString(row.get("emoji")),
                    state,
                    asInt(row.get("xp_reward")),
                    lessonsTotal,
                    lessonsCompleted,
                    asString(row.get("node_family")),
                    asString(row.get("description_vi")),
                    asString(row.get("cefr_level")),
                    firstPrerequisiteCode(row),
                    row.get("sort_order") == null ? null : asInt(row.get("sort_order")),
                    shifted(row.get("day_number"), entry.dayShift()),
                    shifted(row.get("week_number"), entry.weekShift()),
                    computeProgressStatus(row, state),
                    parseSkillCounts(row.get("skill_exercise_counts"))
            ));
        }

        return nodes;
    }

    public String getCurrentLevelCode(Long userId) {
        return resolveCurrentLevel(profileRepository.findByUserId(userId).orElse(null));
    }

    public String getTargetLevelCode(Long userId) {
        UserLearningProfile profile = profileRepository.findByUserId(userId).orElse(null);
        if (profile == null || profile.getTargetLevel() == null) {
            return "A1";
        }
        return profile.getTargetLevel().name();
    }

    public String getCurrentNodeCode(Long userId, int entryDay) {
        List<Map<String, Object>> rows = jdbcTemplate.queryForList("""
                SELECT n.node_code
                FROM v_skill_tree_roadmap_nodes n
                JOIN skill_tree_user_progress p ON p.node_id = n.id
                WHERE p.user_id = ?
                  AND p.status IN ('IN_PROGRESS', 'UNLOCKED', 'COMPLETED')
                  AND %s
                  AND n.day_number >= ?
                ORDER BY
                    CASE p.status WHEN 'IN_PROGRESS' THEN 0 WHEN 'UNLOCKED' THEN 1 WHEN 'COMPLETED' THEN 2 ELSE 3 END,
                    COALESCE(p.updated_at, p.created_at) DESC,
                    n.day_number ASC,
                    n.sort_order ASC
                LIMIT 1
                """.formatted(RoadmapRules.PUBLISHED), userId, entryDay);

        if (rows.isEmpty()) {
            return getEntryNodeCode(entryDay);
        }

        return nodeCodeOrEntry(rows.get(0));
    }

    /** Node nền tảng (ngày 1–10) có thể không có {@code node_code}; meta cần một mã khác null. */
    private String nodeCodeOrEntry(Map<String, Object> row) {
        String code = asString(row.get("node_code"));
        return code == null ? ENTRY_NODE_CODE : code;
    }

    private String getEntryNodeCode(int entryDay) {
        List<Map<String, Object>> rows = jdbcTemplate.queryForList("""
                SELECT n.node_code
                FROM v_skill_tree_roadmap_nodes n
                WHERE %s
                  AND n.day_number >= ?
                ORDER BY n.day_number ASC, COALESCE(n.sort_order, 9999) ASC, n.id ASC
                LIMIT 1
                """.formatted(RoadmapRules.PUBLISHED), entryDay);
        return rows.isEmpty() ? ENTRY_NODE_CODE : nodeCodeOrEntry(rows.get(0));
    }

    public long getCompletedNodeCount(Long userId, int entryDay) {
        Long count = jdbcTemplate.queryForObject("""
                SELECT COUNT(*)
                FROM skill_tree_user_progress p
                JOIN skill_tree_nodes n ON n.id = p.node_id
                WHERE p.user_id = ?
                  AND p.status = 'COMPLETED'
                  AND %s
                  AND n.day_number >= ?
                """.formatted(RoadmapRules.PUBLISHED), Long.class, userId, entryDay);
        return count == null ? 0L : count;
    }

    public long getTotalNodeCount(int entryDay) {
        Long count = jdbcTemplate.queryForObject("""
                SELECT COUNT(*)
                FROM v_skill_tree_roadmap_nodes n
                WHERE %s
                  AND n.day_number >= ?
                """.formatted(RoadmapRules.PUBLISHED), Long.class, entryDay);
        return count == null ? 0L : count;
    }

    public Map<String, Object> getRoadmapMeta(Long userId) {
        UserLearningProfile profile = profileRepository.findByUserId(userId).orElse(null);
        int entryDay = RoadmapEntry.forLevel(resolveCurrentLevel(profile)).day();
        long totalNodes = getTotalNodeCount(entryDay);
        long completedNodes = getCompletedNodeCount(userId, entryDay);
        long progressPercent = totalNodes == 0 ? 0 : Math.min(100, Math.round((completedNodes * 100.0) / totalNodes));

        return Map.of(
                "roadmapVersion", ROADMAP_VERSION,
                "roadmapType", resolveRoadmapType(profile),
                "entryNodeCode", getEntryNodeCode(entryDay),
                "currentLevel", resolveCurrentLevel(profile),
                "targetLevel", getTargetLevelCode(userId),
                "currentNodeCode", getCurrentNodeCode(userId, entryDay),
                "completedNodes", completedNodes,
                "totalNodes", totalNodes,
                "progressPercent", progressPercent,
                "progressModel", ROADMAP_MODEL
        );
    }

    private String resolveRoadmapType(UserLearningProfile profile) {
        if (profile == null || profile.getCurrentLevel() == null) {
            return ROADMAP_TYPE;
        }
        return profile.getCurrentLevel() == UserLearningProfile.CurrentLevel.A0 ? "FOUNDATION_FIRST" : "PERSONALIZED";
    }

    private String resolveCurrentLevel(UserLearningProfile profile) {
        if (profile == null || profile.getCurrentLevel() == null) {
            return "A0";
        }
        return profile.getCurrentLevel().name();
    }

    /**
     * ROUTE-01/09 (đợt 1, 14/11/2026): trạng thái lấy từ {@link RoadmapRules#status}, cùng hàm với
     * /skill-tree/me. Trước đây màn này có luật riêng ("nụ duy nhất", node liền sau node đã xong,
     * {@code prerequisites_json}) nên có ca hai màn mobile báo khác nhau cho cùng một bài.
     */
    private String computeState(Map<String, Object> row) {
        String status = RoadmapRules.status(row.get("user_status"), row.get("user_best_score"),
                row.get("mastery_threshold"), row.get("dependencies_met"));
        return switch (status) {
            case "COMPLETED" -> "completed";
            case "IN_PROGRESS", "UNLOCKED" -> "current";
            default -> "locked";
        };
    }

    /**
     * Refines the three-value {@code state} into the four a tree UI needs, where an offered node
     * (bud) and a node being worked on (flower) look different. Derived from {@code state} rather
     * than read straight off {@code user_status} so the two fields can never disagree: {@code state}
     * already folds in starting points that have no progress row at all — the entry node of a fresh
     * learner, or a focus-area node promoted by the profile.
     */
    private String computeProgressStatus(Map<String, Object> row, String state) {
        if ("completed".equals(state)) {
            return "COMPLETED";
        }
        if ("locked".equals(state)) {
            return "LOCKED";
        }
        // "current" splits: only an actually-started node is IN_PROGRESS. UNLOCKED — and every
        // inferred start — is AVAILABLE, which is also the normalization every client used to
        // have to do for itself.
        return "IN_PROGRESS".equals(asString(row.get("user_status"))) ? "IN_PROGRESS" : "AVAILABLE";
    }

    /**
     * Reads the per-skill exercise tally the query aggregates out of
     * {@code content_json.skill_exercises}. Content is authored, not user input, but a malformed
     * node should cost that node its skill chips — not the whole roadmap request.
     */
    private Map<String, Integer> parseSkillCounts(Object raw) {
        if (raw == null) {
            return Map.of();
        }
        String json = raw.toString();
        if (json.isBlank()) {
            return Map.of();
        }
        try {
            Map<String, Integer> counts =
                    objectMapper.readValue(json, new TypeReference<LinkedHashMap<String, Integer>>() {});
            return counts == null ? Map.of() : counts;
        } catch (Exception ex) {
            log.warn("Skipping malformed skill_exercise_counts: {}", ex.getMessage());
            return Map.of();
        }
    }

    /** ROUTE-08: số mục chấm điểm thật của bài, tối thiểu 1 (trước đây suy từ estimated_minutes / 5). */
    private int resolveLessonsTotal(Map<String, Object> row) {
        return Math.max(1, asInt(row.get("scored_item_count")));
    }

    private int resolveLessonsCompleted(Map<String, Object> row, String state, int lessonsTotal) {
        if ("completed".equals(state)) {
            return lessonsTotal;
        }
        int bestScore = Math.max(0, Math.min(100, asInt(row.get("user_best_score"))));
        return Math.min(lessonsTotal, (bestScore * lessonsTotal) / 100);
    }

    private String firstPrerequisiteCode(Map<String, Object> row) {
        Object prereq = row.get("prerequisites_json");
        if (prereq == null) {
            return null;
        }
        String raw = prereq.toString();
        if (raw.length() < 4) {
            return null;
        }
        // Best-effort extraction without introducing a JSON dependency here.
        int firstQuote = raw.indexOf('"');
        int secondQuote = raw.indexOf('"', firstQuote + 1);
        if (firstQuote >= 0 && secondQuote > firstQuote) {
            return raw.substring(firstQuote + 1, secondQuote);
        }
        return null;
    }

    private int asInt(Object value) {
        if (value instanceof Number n) {
            return n.intValue();
        }
        if (value == null) {
            return 0;
        }
        try {
            return Integer.parseInt(value.toString());
        } catch (NumberFormatException ex) {
            return 0;
        }
    }

    private String asString(Object value) {
        return value == null ? null : value.toString();
    }

    /** Like {@link #asInt} but keeps "absent" distinct from zero — day 0 and no day differ. */
    private Integer asNullableInt(Object value) {
        return value == null ? null : asInt(value);
    }

    /** Curriculum day/week counted from the learner's own start ({@link RoadmapEntry}). */
    private Integer shifted(Object value, int shift) {
        Integer n = asNullableInt(value);
        return n == null ? null : n - shift;
    }
}
