package com.deutschflow.gamification.coin.service;

import com.deutschflow.curriculum.dto.tree.TreeDto;
import com.deutschflow.curriculum.dto.tree.TreeNodeDto;
import com.deutschflow.curriculum.service.RoadmapTreeService;
import com.deutschflow.curriculum.service.TreeStateMachine;
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

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Coin earning: 1 coin per node completion, FIRST completion only (not farmable). Verifies both the
 * direct {@link CoinService#awardNodeComplete} mechanic and the wiring through
 * {@link RoadmapTreeService#completeNode}. Self-skips without Postgres.
 */
@SpringBootTest(properties = "app.coins.enabled=true")
@DisplayName("coin earning — one per node, first completion only")
class CoinEarnIT extends AbstractPostgresIntegrationTest {

    @Autowired private CoinService coinService;
    @Autowired private RoadmapTreeService treeService;
    @Autowired private UserRepository userRepository;
    @Autowired private UserLearningProfileRepository profileRepository;

    private User learner;

    @BeforeEach
    void seedLearner() {
        learner = userRepository.save(User.builder()
                .email("coin-earn-" + System.nanoTime() + "@local.test")
                .passwordHash("x")
                .displayName("Coin Earner")
                .role(User.Role.STUDENT)
                .build());
    }

    @Test
    @DisplayName("awardNodeComplete credits exactly one coin and is not farmable per node")
    void awardOncePerNode() {
        long uid = learner.getId();
        assertThat(coinService.getBalance(uid).balance()).isZero();

        coinService.awardNodeComplete(uid, "node-A", "TREE");
        assertThat(coinService.getBalance(uid).balance()).isEqualTo(1L);

        // Re-completing the same node mints no further coin (unique index + in-service guard).
        coinService.awardNodeComplete(uid, "node-A", "TREE");
        assertThat(coinService.getBalance(uid).balance()).isEqualTo(1L);

        // A different node earns another coin.
        coinService.awardNodeComplete(uid, "node-B", "TREE");
        assertThat(coinService.getBalance(uid).balance()).isEqualTo(2L);

        // Same numeric id in the legacy SKILL_TREE space is a distinct (kind,node) → earns separately.
        coinService.awardNodeComplete(uid, "node-A", "SKILL_TREE");
        assertThat(coinService.getBalance(uid).balance()).isEqualTo(3L);
    }

    @Test
    @DisplayName("completing a real tree node through RoadmapTreeService awards one coin")
    void completeNodeWiringAwardsCoin() {
        profileRepository.save(UserLearningProfile.builder()
                .user(learner)
                .goalType(UserLearningProfile.GoalType.CERT)
                .targetLevel(UserLearningProfile.TargetLevel.B1)
                .currentLevel(UserLearningProfile.CurrentLevel.A1)
                .sessionsPerWeek(3)
                .minutesPerSession(30)
                .build());

        String availableNodeId = firstAvailableNode(treeService.getTree(learner.getId()));

        treeService.completeNode(learner.getId(), availableNodeId);
        assertThat(coinService.getBalance(learner.getId()).balance()).isEqualTo(1L);

        // Idempotent re-completion of the same node does not double-award.
        treeService.completeNode(learner.getId(), availableNodeId);
        assertThat(coinService.getBalance(learner.getId()).balance()).isEqualTo(1L);
    }

    private static String firstAvailableNode(TreeDto tree) {
        return tree.path().stream()
                .flatMap(l -> l.branches().stream())
                .flatMap(b -> b.shoots().stream())
                .flatMap(s -> s.nodes().stream())
                .filter(n -> TreeStateMachine.AVAILABLE.equals(n.state())
                        || TreeStateMachine.IN_PROGRESS.equals(n.state()))
                .map(TreeNodeDto::id)
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("Expected an available A1 node in the seed."));
    }
}
