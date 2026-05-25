package com.deutschflow.curriculum.service;

import com.deutschflow.curriculum.dto.RoadmapNodeDto;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.entity.UserLearningProfile;
import com.deutschflow.user.repository.UserLearningProfileRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

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

    public List<RoadmapNodeDto> generateRoadmapForUser(Long userId) {
        UserLearningProfile profile = profileRepository.findByUserId(userId).orElse(null);
        String roadmapType = resolveRoadmapType(profile);
        String startingLevel = resolveCurrentLevel(profile);
        boolean beginnerFoundation = "A0".equals(startingLevel);

        List<Map<String, Object>> rows = jdbcTemplate.queryForList("""
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
                    COALESCE(p.status, 'LOCKED') AS user_status,
                    COALESCE(p.score_percent, 0) AS user_score,
                    COALESCE(p.best_score, 0) AS user_best_score,
                    COALESCE(p.attempts, 0) AS user_attempts,
                    COALESCE(p.xp_earned, 0) AS user_xp
                FROM v_skill_tree_roadmap_nodes n
                LEFT JOIN skill_tree_user_progress p
                    ON p.node_id = n.id AND p.user_id = ?
                WHERE n.is_active = TRUE
                  AND n.node_family IN ('FOUNDATION', 'CORE', 'CHECKPOINT')
                ORDER BY COALESCE(n.day_number, 9999) ASC, COALESCE(n.sort_order, 9999) ASC, n.id ASC
                """, userId);

        if (!beginnerFoundation && roadmapType != null) {
            log.debug("Generating personalized roadmap branch for user {} with type {} and level {}", userId, roadmapType, startingLevel);
        }

        boolean roadmapStarted = rows.stream().anyMatch(r -> hasCompletedProgress(r) || hasInProgressProgress(r) || hasUnlockedProgress(r));
        applyFocusAreaPriorities(rows, profile);
        boolean firstCurrentAssigned = false;
        String firstFocusNodeCode = findFirstFocusAreaNodeCode(rows, profile);
        List<RoadmapNodeDto> nodes = new ArrayList<>(rows.size());

        for (Map<String, Object> row : rows) {
            String state = computeState(row, firstCurrentAssigned, roadmapStarted, firstFocusNodeCode, beginnerFoundation);
            if ("current".equals(state)) {
                firstCurrentAssigned = true;
            }
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
                    row.get("sort_order") == null ? null : asInt(row.get("sort_order"))
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

    public String getCurrentNodeCode(Long userId) {
        List<Map<String, Object>> rows = jdbcTemplate.queryForList("""
                SELECT n.node_code
                FROM v_skill_tree_roadmap_nodes n
                JOIN skill_tree_user_progress p ON p.node_id = n.id
                WHERE p.user_id = ?
                  AND p.status IN ('IN_PROGRESS', 'UNLOCKED', 'COMPLETED')
                ORDER BY
                    CASE p.status WHEN 'IN_PROGRESS' THEN 0 WHEN 'UNLOCKED' THEN 1 WHEN 'COMPLETED' THEN 2 ELSE 3 END,
                    COALESCE(p.updated_at, p.created_at) DESC,
                    n.day_number ASC,
                    n.sort_order ASC
                LIMIT 1
                """, userId);

        if (rows.isEmpty()) {
            List<Map<String, Object>> fallback = jdbcTemplate.queryForList("""
                    SELECT n.node_code
                    FROM v_skill_tree_roadmap_nodes n
                    WHERE n.is_active = TRUE
                    ORDER BY COALESCE(n.day_number, 9999) ASC, COALESCE(n.sort_order, 9999) ASC, n.id ASC
                    LIMIT 1
                    """);
            return fallback.isEmpty() ? ENTRY_NODE_CODE : asString(fallback.get(0).get("node_code"));
        }

        return asString(rows.get(0).get("node_code"));
    }

    public long getCompletedNodeCount(Long userId) {
        Long count = jdbcTemplate.queryForObject("""
                SELECT COUNT(*)
                FROM skill_tree_user_progress p
                JOIN skill_tree_nodes n ON n.id = p.node_id
                WHERE p.user_id = ?
                  AND p.status = 'COMPLETED'
                  AND n.is_active = TRUE
                  AND n.node_family IN ('FOUNDATION', 'CORE', 'CHECKPOINT')
                """, Long.class, userId);
        return count == null ? 0L : count;
    }

    public long getTotalNodeCount() {
        Long count = jdbcTemplate.queryForObject("""
                SELECT COUNT(*)
                FROM v_skill_tree_roadmap_nodes n
                WHERE n.is_active = TRUE
                  AND n.node_family IN ('FOUNDATION', 'CORE', 'CHECKPOINT')
                """, Long.class);
        return count == null ? 0L : count;
    }

    public Map<String, Object> getRoadmapMeta(Long userId) {
        UserLearningProfile profile = profileRepository.findByUserId(userId).orElse(null);
        long totalNodes = getTotalNodeCount();
        long completedNodes = getCompletedNodeCount(userId);
        long progressPercent = totalNodes == 0 ? 0 : Math.min(100, Math.round((completedNodes * 100.0) / totalNodes));

        return Map.of(
                "roadmapVersion", ROADMAP_VERSION,
                "roadmapType", resolveRoadmapType(profile),
                "entryNodeCode", ENTRY_NODE_CODE,
                "currentLevel", resolveCurrentLevel(profile),
                "targetLevel", getTargetLevelCode(userId),
                "currentNodeCode", getCurrentNodeCode(userId),
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

    private String computeState(Map<String, Object> row, boolean firstCurrentAssigned, boolean roadmapStarted, String firstFocusNodeCode, boolean beginnerFoundation) {
        String status = asString(row.get("user_status"));
        int bestScore = asInt(row.get("user_best_score"));
        int masteryThreshold = asInt(row.get("mastery_threshold"));
        boolean dependenciesMet = dependenciesMet(row);
        String nodeCode = asString(row.get("node_code"));

        if ("COMPLETED".equals(status) || bestScore >= masteryThreshold) {
            return "completed";
        }
        if ("IN_PROGRESS".equals(status) || "UNLOCKED".equals(status)) {
            return "current";
        }
        if (!dependenciesMet) {
            return "locked";
        }
        if (!firstCurrentAssigned && firstFocusNodeCode != null && firstFocusNodeCode.equals(nodeCode)) {
            return "current";
        }
        if (!roadmapStarted && !firstCurrentAssigned) {
            return isEntryNode(row, beginnerFoundation) ? "current" : "locked";
        }
        if (!firstCurrentAssigned && isEntryNode(row, beginnerFoundation)) {
            return "current";
        }
        return "locked";
    }

    private String findFirstFocusAreaNodeCode(List<Map<String, Object>> rows, UserLearningProfile profile) {
        if (profile == null || profile.getInterestsJson() == null || profile.getInterestsJson().isBlank()) {
            return null;
        }

        String interests = profile.getInterestsJson().toLowerCase();
        for (Map<String, Object> row : rows) {
            String title = asString(row.get("title_de"));
            String description = asString(row.get("description_vi"));
            String tags = asString(row.get("tags"));
            String category = asString(row.get("node_family"));

            boolean matches = (title != null && interests.contains(title.toLowerCase()))
                    || (description != null && interests.contains(description.toLowerCase()))
                    || (tags != null && interests.contains(tags.toLowerCase()))
                    || (category != null && interests.contains(category.toLowerCase()));

            if (matches) {
                return asString(row.get("node_code"));
            }
        }

        return null;
    }

    private boolean dependenciesMet(Map<String, Object> row) {
        Object deps = row.get("prerequisites_json");
        if (deps == null) {
            return true;
        }
        String raw = deps.toString();
        return raw.isBlank() || "[]".equals(raw) || "[ ]".equals(raw);
    }

    private boolean isEntryNode(Map<String, Object> row, boolean beginnerFoundation) {
        if (beginnerFoundation) {
            return ENTRY_NODE_CODE.equals(asString(row.get("node_code"))) || asInt(row.get("day_number")) == 1;
        } else {
            return "D11".equals(asString(row.get("node_code"))) || asInt(row.get("day_number")) == 11;
        }
    }

    private boolean hasCompletedProgress(Map<String, Object> row) {
        return "COMPLETED".equals(asString(row.get("user_status"))) || asInt(row.get("user_best_score")) >= asInt(row.get("mastery_threshold"));
    }

    private boolean hasInProgressProgress(Map<String, Object> row) {
        String status = asString(row.get("user_status"));
        return "IN_PROGRESS".equals(status);
    }

    private boolean hasUnlockedProgress(Map<String, Object> row) {
        return "UNLOCKED".equals(asString(row.get("user_status")));
    }

    private int resolveLessonsTotal(Map<String, Object> row) {
        Object value = row.get("estimated_minutes");
        int minutes = value instanceof Number n ? n.intValue() : 15;
        return Math.max(1, Math.round(minutes / 5.0f));
    }

    private int resolveLessonsCompleted(Map<String, Object> row, String state, int lessonsTotal) {
        if ("completed".equals(state)) {
            return lessonsTotal;
        }
        if ("current".equals(state)) {
            int bestScore = asInt(row.get("user_best_score"));
            int masteryThreshold = Math.max(1, asInt(row.get("mastery_threshold")));
            return Math.min(lessonsTotal, Math.max(0, Math.round((bestScore * lessonsTotal) / (float) masteryThreshold)));
        }
        return 0;
    }

    private void applyFocusAreaPriorities(List<Map<String, Object>> rows, UserLearningProfile profile) {
        if (profile == null || profile.getInterestsJson() == null || profile.getInterestsJson().isBlank()) {
            return;
        }

        String interests = profile.getInterestsJson().toLowerCase();
        rows.sort((a, b) -> Integer.compare(priorityScore(b, interests), priorityScore(a, interests)));
    }

    private int priorityScore(Map<String, Object> row, String interests) {
        int score = 0;
        String title = asString(row.get("title_de"));
        String description = asString(row.get("description_vi"));
        String tags = asString(row.get("tags"));
        String category = asString(row.get("node_family"));

        if (title != null && interests.contains(title.toLowerCase())) score += 3;
        if (description != null && interests.contains(description.toLowerCase())) score += 2;
        if (tags != null && interests.contains(tags.toLowerCase())) score += 3;
        if (category != null && interests.contains(category.toLowerCase())) score += 1;

        return score;
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
}
