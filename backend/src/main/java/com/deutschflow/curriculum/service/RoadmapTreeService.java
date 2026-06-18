package com.deutschflow.curriculum.service;

import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.curriculum.dto.tree.TreeBranchDto;
import com.deutschflow.curriculum.dto.tree.TreeDto;
import com.deutschflow.curriculum.dto.tree.TreeLevelDto;
import com.deutschflow.curriculum.dto.tree.TreeMilestoneDto;
import com.deutschflow.curriculum.dto.tree.TreeNodeDto;
import com.deutschflow.curriculum.dto.tree.TreeNodeLessonDto;
import com.deutschflow.curriculum.dto.tree.TreeShootDto;
import com.deutschflow.curriculum.entity.TreeLevel;
import com.deutschflow.curriculum.entity.TreeMilestoneProgress;
import com.deutschflow.curriculum.entity.TreeMilestoneProgressId;
import com.deutschflow.curriculum.entity.TreeNode;
import com.deutschflow.curriculum.entity.TreeNodeProgress;
import com.deutschflow.curriculum.entity.TreeNodeProgressId;
import com.deutschflow.curriculum.entity.TreeSkill;
import com.deutschflow.curriculum.entity.TreeTopic;
import com.deutschflow.curriculum.repository.TreeLevelRepository;
import com.deutschflow.curriculum.repository.TreeMilestoneProgressRepository;
import com.deutschflow.curriculum.repository.TreeNodeProgressRepository;
import com.deutschflow.curriculum.repository.TreeNodeRepository;
import com.deutschflow.curriculum.repository.TreeSkillRepository;
import com.deutschflow.curriculum.repository.TreeTopicRepository;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.entity.UserLearningProfile;
import com.deutschflow.user.repository.UserLearningProfileRepository;
import com.deutschflow.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Assembles the learning tree for a learner and applies node completions. Curriculum content
 * (levels/skills/topics/nodes) is read from the {@code tree_*} tables; per-user state lives in
 * {@code tree_node_progress}/{@code tree_milestone_progress}. All display states are derived by
 * {@link TreeStateMachine} so changing the gating rules touches exactly one class.
 *
 * <p>See {@code docs/UI_2.0_LEARNING_TREE_DESIGN.md} §1–§3.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class RoadmapTreeService {

    /** FE soft cap on leaves drawn per branch (config, not stored per row). */
    private static final int NODE_CAP = 10;
    private static final String DEFAULT_LEVEL = "A0";

    private final TreeLevelRepository levelRepository;
    private final TreeSkillRepository skillRepository;
    private final TreeTopicRepository topicRepository;
    private final TreeNodeRepository nodeRepository;
    private final TreeNodeProgressRepository nodeProgressRepository;
    private final TreeMilestoneProgressRepository milestoneProgressRepository;
    private final UserRepository userRepository;
    private final UserLearningProfileRepository learningProfileRepository;

    /** Builds the full tree (user header + path of levels) for the given learner. */
    @Transactional(readOnly = true)
    public TreeDto getTree(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new NotFoundException("User not found: id=" + userId));
        UserLearningProfile profile = learningProfileRepository.findByUserId(userId).orElse(null);

        List<TreeLevel> levels = levelRepository.findAllByOrderByOrderIndexAsc();
        List<TreeSkill> skills = skillRepository.findAllByOrderByOrderIndexAsc();

        String track = profile != null ? profile.getIndustry() : null;

        List<TreeMilestoneProgress> milestones = milestoneProgressRepository.findByIdUserId(userId);
        Set<String> passedLevels = milestones.stream()
                .filter(m -> TreeMilestoneProgress.PASSED.equals(m.getState()))
                .map(m -> m.getId().getLevelCode())
                .collect(Collectors.toSet());
        Map<String, LocalDateTime> passedAtByLevel = milestones.stream()
                .filter(m -> m.getPassedAt() != null)
                .collect(Collectors.toMap(m -> m.getId().getLevelCode(), TreeMilestoneProgress::getPassedAt,
                        (a, b) -> a));

        // Effective current level = the higher of the profile level and (highest passed milestone + 1),
        // so a tree level-up advances the tree without mutating the shared profile CEFR level.
        String profileLevel = (profile != null && profile.getCurrentLevel() != null)
                ? profile.getCurrentLevel().name()
                : DEFAULT_LEVEL;
        int profileOrder = orderOf(levels, profileLevel);
        int maxPassedOrder = passedLevels.stream().mapToInt(code -> orderOf(levels, code)).max().orElse(-1);
        int lastOrder = levels.isEmpty() ? 0 : levels.get(levels.size() - 1).getOrderIndex();
        int currentOrder = Math.min(lastOrder, Math.max(profileOrder, maxPassedOrder + 1));
        String currentLevelCode = levels.stream()
                .filter(l -> l.getOrderIndex() == currentOrder)
                .map(TreeLevel::getCode)
                .findFirst()
                .orElse(DEFAULT_LEVEL);

        // Which levels are "open" (not locked) — only those carry branches.
        List<String> activeLevelCodes = levels.stream()
                .filter(l -> !TreeStateMachine.LOCKED.equals(
                        TreeStateMachine.levelStatus(l.getOrderIndex(), currentOrder, passedLevels.contains(l.getCode()))))
                .map(TreeLevel::getCode)
                .toList();

        // Load curriculum + progress for the open levels in as few queries as possible.
        List<TreeTopic> topics = activeLevelCodes.isEmpty()
                ? List.of()
                : topicRepository.findByLevelCodeInOrderByLevelCodeAscSkillCodeAscUnlockOrderAsc(activeLevelCodes);
        List<Long> topicPks = topics.stream().map(TreeTopic::getId).toList();
        List<TreeNode> nodes = topicPks.isEmpty()
                ? List.of()
                : nodeRepository.findByTopicPkInOrderByTopicPkAscOrderIndexAsc(topicPks);

        Map<Long, List<TreeNode>> nodesByTopic = new LinkedHashMap<>();
        for (TreeNode n : nodes) {
            nodesByTopic.computeIfAbsent(n.getTopicPk(), k -> new ArrayList<>()).add(n);
        }
        Map<String, String> storedStateByNode = nodeProgressRepository.findByIdUserId(userId).stream()
                .collect(Collectors.toMap(p -> p.getId().getNodeId(), TreeNodeProgress::getState, (a, b) -> a));

        // topicsByLevel[levelCode][skillCode] = ordered topics
        Map<String, Map<String, List<TreeTopic>>> topicsByLevelSkill = new LinkedHashMap<>();
        for (TreeTopic t : topics) {
            topicsByLevelSkill
                    .computeIfAbsent(t.getLevelCode(), k -> new LinkedHashMap<>())
                    .computeIfAbsent(t.getSkillCode(), k -> new ArrayList<>())
                    .add(t);
        }

        List<TreeLevelDto> path = new ArrayList<>(levels.size());
        for (TreeLevel level : levels) {
            String levelStatus = TreeStateMachine.levelStatus(
                    level.getOrderIndex(), currentOrder, passedLevels.contains(level.getCode()));

            List<TreeBranchDto> branches;
            int maturedCount;
            if (TreeStateMachine.LOCKED.equals(levelStatus)) {
                branches = List.of();
                maturedCount = 0;
            } else {
                branches = new ArrayList<>(skills.size());
                int matured = 0;
                Map<String, List<TreeTopic>> bySkill =
                        topicsByLevelSkill.getOrDefault(level.getCode(), Map.of());
                for (TreeSkill skill : skills) {
                    TreeBranchDto branch = buildBranch(
                            skill, bySkill.getOrDefault(skill.getCode(), List.of()),
                            nodesByTopic, storedStateByNode, track);
                    if (TreeStateMachine.MATURED.equals(branch.status())) {
                        matured++;
                    }
                    branches.add(branch);
                }
                maturedCount = matured;
            }

            // Gate on the actual number of skills loaded (data-driven), not a hardcoded 4, so adding a
            // fifth skill to tree_skills can't make the milestone permanently un-reachable.
            boolean allSkillsMatured = !skills.isEmpty() && maturedCount == skills.size();
            String milestoneState = TreeStateMachine.milestoneState(levelStatus, allSkillsMatured);
            LocalDateTime passedAt = passedAtByLevel.get(level.getCode());
            TreeMilestoneDto milestone = new TreeMilestoneDto(
                    "ms_" + level.getCode().toLowerCase(),
                    level.getMilestoneTitle(),
                    milestoneState,
                    TreeStateMachine.PASSED.equals(milestoneState) ? isoDate(passedAt) : null,
                    TreeStateMachine.PASSED.equals(milestoneState) ? null : level.getUnlockRule());

            path.add(new TreeLevelDto(level.getCode(), levelStatus, milestone, branches));
        }

        TreeDto.TreeUserDto userDto = new TreeDto.TreeUserDto(
                "u_" + user.getId(),
                user.getDisplayName(),
                track,
                buildGoal(profile),
                currentLevelCode,
                isoDate(user.getCreatedAt()));

        return new TreeDto(userDto, path);
    }

    private TreeBranchDto buildBranch(TreeSkill skill,
                                      List<TreeTopic> skillTopics,
                                      Map<Long, List<TreeNode>> nodesByTopic,
                                      Map<String, String> storedStateByNode,
                                      String track) {
        List<TreeShootDto> shoots = new ArrayList<>(skillTopics.size());
        List<String> branchNodeStates = new ArrayList<>();
        for (TreeTopic topic : skillTopics) {
            List<TreeNode> topicNodes = nodesByTopic.getOrDefault(topic.getId(), List.of());
            List<String> stored = topicNodes.stream()
                    .map(n -> storedStateByNode.get(n.getId()))
                    .collect(Collectors.toCollection(ArrayList::new));
            List<String> states = TreeStateMachine.nodeStates(stored);
            branchNodeStates.addAll(states);

            List<TreeNodeDto> nodeDtos = new ArrayList<>(topicNodes.size());
            for (int i = 0; i < topicNodes.size(); i++) {
                TreeNode n = topicNodes.get(i);
                nodeDtos.add(new TreeNodeDto(n.getId(), n.getTitleDe(), states.get(i)));
            }
            shoots.add(new TreeShootDto(
                    topic.getTopicId(), topic.getTopicLabel(), topic.getGroupCode(),
                    topic.getUnlockOrder(), isChosenByUser(topic, track), nodeDtos));
        }
        return new TreeBranchDto(
                skill.getCode(), skill.getLabelVi(),
                TreeStateMachine.branchStatus(branchNodeStates), NODE_CAP, shoots);
    }

    /** Marks a node completed for the learner (idempotent) and returns the recomputed tree. */
    @Transactional
    public TreeDto completeNode(Long userId, String nodeId) {
        TreeNode node = nodeRepository.findById(nodeId)
                .orElseThrow(() -> new NotFoundException("Tree node not found: id=" + nodeId));

        // Access gate: only a node currently available/in-progress (or already completed — idempotent)
        // may be completed. Rejecting locked / not-yet-open nodes stops a learner from pre-completing
        // future levels or skipping the sequential shoot-unlock to force a milestone to `ready` and
        // level up without doing the work.
        String currentState = findNodeState(getTree(userId), node.getId());
        if (currentState == null || TreeStateMachine.LOCKED.equals(currentState)) {
            throw new BadRequestException("Tree node is not available to complete yet: id=" + nodeId);
        }

        TreeNodeProgressId id = new TreeNodeProgressId(userId, node.getId());
        LocalDateTime now = LocalDateTime.now();
        TreeNodeProgress progress = nodeProgressRepository.findById(id).orElseGet(() -> {
            TreeNodeProgress p = new TreeNodeProgress();
            p.setId(id);
            p.setStartedAt(now);
            return p;
        });
        if (progress.getStartedAt() == null) {
            progress.setStartedAt(now);
        }
        progress.setState(TreeNodeProgress.COMPLETED);
        progress.setCompletedAt(now);
        nodeProgressRepository.save(progress);

        return getTree(userId);
    }

    /**
     * Passes the milestone of the learner's current level — the "level-up" ritual. Gated on the
     * current level's milestone being {@code ready} (all four skills matured); writes only a
     * {@code tree_milestone_progress} row so getTree derives the next level as current without
     * mutating the shared profile CEFR level. Returns the recomputed (grown) tree.
     *
     * @throws BadRequestException when there is no current level (top reached) or it is not ready.
     */
    @Transactional
    public TreeDto levelUp(Long userId) {
        TreeDto tree = getTree(userId);
        TreeLevelDto current = tree.path().stream()
                .filter(l -> TreeStateMachine.CURRENT.equals(l.status()))
                .findFirst()
                .orElseThrow(() -> {
                    boolean allCompleted = !tree.path().isEmpty() && tree.path().stream()
                            .allMatch(l -> TreeStateMachine.COMPLETED.equals(l.status()));
                    return new BadRequestException(allCompleted
                            ? "Already completed every level — no further level-up is possible."
                            : "No current level to advance — the curriculum may not be seeded.");
                });
        if (!TreeStateMachine.READY.equals(current.milestone().state())) {
            throw new BadRequestException(
                    "Milestone " + current.level() + " is not ready — all four skills must mature first.");
        }

        TreeMilestoneProgressId id = new TreeMilestoneProgressId(userId, current.level());
        TreeMilestoneProgress passed = milestoneProgressRepository.findById(id)
                .orElseGet(() -> {
                    TreeMilestoneProgress m = new TreeMilestoneProgress();
                    m.setId(id);
                    return m;
                });
        passed.setState(TreeMilestoneProgress.PASSED);
        passed.setPassedAt(LocalDateTime.now());
        milestoneProgressRepository.save(passed);

        return getTree(userId);
    }

    /**
     * Returns the lesson descriptor for a node (semantic context + content hook for the FE player).
     * Gated on the node being open for the learner — same rule as {@link #completeNode}, so a learner
     * can't enumerate descriptors of locked / future-level nodes (and a future secret in
     * {@code contentKey} can't leak through this read path).
     */
    @Transactional(readOnly = true)
    public TreeNodeLessonDto getNodeLesson(Long userId, String nodeId) {
        TreeNode node = nodeRepository.findById(nodeId)
                .orElseThrow(() -> new NotFoundException("Tree node not found: id=" + nodeId));

        String currentState = findNodeState(getTree(userId), node.getId());
        if (currentState == null || TreeStateMachine.LOCKED.equals(currentState)) {
            throw new BadRequestException("Tree node is not available yet: id=" + nodeId);
        }

        TreeTopic topic = topicRepository.findById(node.getTopicPk())
                .orElseThrow(() -> new NotFoundException("Tree topic not found: id=" + node.getTopicPk()));
        return new TreeNodeLessonDto(
                node.getId(), node.getTitleDe(),
                topic.getSkillCode(), topic.getTopicId(), topic.getTopicLabel(),
                topic.getGroupCode(), node.getContentKey());
    }

    /** The derived display state of a node in the assembled tree, or {@code null} if it is not open. */
    private static String findNodeState(TreeDto tree, String nodeId) {
        return tree.path().stream()
                .flatMap(l -> l.branches().stream())
                .flatMap(b -> b.shoots().stream())
                .flatMap(s -> s.nodes().stream())
                .filter(n -> n.id().equals(nodeId))
                .map(TreeNodeDto::state)
                .findFirst()
                .orElse(null);
    }

    private static boolean isChosenByUser(TreeTopic topic, String track) {
        return topic.getTrack() != null && track != null && topic.getTrack().equalsIgnoreCase(track);
    }

    private static int orderOf(List<TreeLevel> levels, String code) {
        return levels.stream()
                .filter(l -> l.getCode().equals(code))
                .map(TreeLevel::getOrderIndex)
                .findFirst()
                .orElse(0);
    }

    private static String isoDate(LocalDateTime ts) {
        return ts == null ? null : ts.toLocalDate().format(DateTimeFormatter.ISO_LOCAL_DATE);
    }

    private static String buildGoal(UserLearningProfile profile) {
        if (profile == null) {
            return "Bắt đầu hành trình tiếng Đức";
        }
        StringBuilder sb = new StringBuilder();
        if (profile.getTargetLevel() != null) {
            sb.append("Mục tiêu ").append(profile.getTargetLevel().name());
        }
        String detail = firstNonBlank(profile.getExamType(), profile.getIndustry());
        if (detail != null) {
            sb.append(sb.length() > 0 ? " · " : "").append(detail);
        }
        return sb.length() > 0 ? sb.toString() : "Hành trình tiếng Đức";
    }

    private static String firstNonBlank(String a, String b) {
        if (a != null && !a.isBlank()) {
            return a;
        }
        return (b != null && !b.isBlank()) ? b : null;
    }
}
