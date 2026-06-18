package com.deutschflow.curriculum.service;

import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.curriculum.dto.tree.TreeDto;
import com.deutschflow.curriculum.dto.tree.TreeLevelDto;
import com.deutschflow.curriculum.dto.tree.TreeNodeDto;
import com.deutschflow.testsupport.AbstractPostgresIntegrationTest;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.entity.UserLearningProfile;
import com.deutschflow.user.repository.UserLearningProfileRepository;
import com.deutschflow.user.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Behaviour contract for {@link RoadmapTreeService#levelUp(Long)} — the "level-up ritual". Exercises
 * the gate and the happy path end-to-end against the real curriculum seed (so the four-skills-matured
 * rule and the derived effective-current-level both hold against actual data, not a mock).
 *
 * <p>Self-skips when no Postgres is available — see {@link AbstractPostgresIntegrationTest}.
 */
@SpringBootTest
@DisplayName("learning-tree level-up ritual")
class RoadmapTreeLevelUpIT extends AbstractPostgresIntegrationTest {

    @Autowired
    private RoadmapTreeService service;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private UserLearningProfileRepository profileRepository;

    private User learner;

    @BeforeEach
    void seedLearner() {
        learner = userRepository.save(User.builder()
                .email("level-up-" + System.nanoTime() + "@local.test")
                .passwordHash("x")
                .displayName("Level Up")
                .role(User.Role.STUDENT)
                .build());
    }

    @Test
    @DisplayName("rejects level-up when the current milestone is not ready")
    void rejectsWhenNotReady() {
        // Fresh learner sits at A0 (germinate state, no branches) → milestone can never be ready.
        assertThatThrownBy(() -> service.levelUp(learner.getId()))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("not ready");
    }

    @Test
    @DisplayName("passing the current milestone advances the tree to the next level")
    void levelUpAdvancesTree() {
        // Put the learner at A1 (the first level that carries real lessons).
        profileRepository.save(UserLearningProfile.builder()
                .user(learner)
                .goalType(UserLearningProfile.GoalType.CERT)
                .targetLevel(UserLearningProfile.TargetLevel.B1)
                .currentLevel(UserLearningProfile.CurrentLevel.A1)
                .sessionsPerWeek(3)
                .minutesPerSession(30)
                .build());

        // Mature every A1 branch by completing all its leaves (they unlock sequentially per shoot).
        matureCurrentLevel(learner.getId(), "A1");

        TreeDto before = service.getTree(learner.getId());
        assertThat(milestoneStateOf(before, "A1")).isEqualTo(TreeStateMachine.READY);
        assertThat(before.user().currentLevel()).isEqualTo("A1");

        TreeDto after = service.levelUp(learner.getId());

        assertThat(levelStatusOf(after, "A1")).isEqualTo(TreeStateMachine.COMPLETED);
        assertThat(milestoneStateOf(after, "A1")).isEqualTo(TreeStateMachine.PASSED);
        // The derived effective current level advances without touching the profile CEFR level.
        assertThat(after.user().currentLevel()).isEqualTo("A2");
        assertThat(levelStatusOf(after, "A2")).isEqualTo(TreeStateMachine.CURRENT);
    }

    /** Completes leaves of {@code levelCode} round by round until every node is completed. */
    private void matureCurrentLevel(Long userId, String levelCode) {
        for (int guard = 0; guard < 50; guard++) {
            List<String> openNodeIds = openLeafIds(service.getTree(userId), levelCode);
            if (openNodeIds.isEmpty()) {
                return;
            }
            openNodeIds.forEach(id -> service.completeNode(userId, id));
        }
        throw new IllegalStateException("Could not mature level " + levelCode + " within the guard bound.");
    }

    private static List<String> openLeafIds(TreeDto tree, String levelCode) {
        return levelOf(tree, levelCode).branches().stream()
                .flatMap(b -> b.shoots().stream())
                .flatMap(s -> s.nodes().stream())
                .filter(n -> !TreeStateMachine.COMPLETED.equals(n.state()))
                .map(TreeNodeDto::id)
                .toList();
    }

    private static TreeLevelDto levelOf(TreeDto tree, String levelCode) {
        return tree.path().stream()
                .filter(l -> levelCode.equals(l.level()))
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("Level " + levelCode + " absent from tree."));
    }

    private static String levelStatusOf(TreeDto tree, String levelCode) {
        return levelOf(tree, levelCode).status();
    }

    private static String milestoneStateOf(TreeDto tree, String levelCode) {
        return levelOf(tree, levelCode).milestone().state();
    }
}
