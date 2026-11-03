package com.deutschflow.curriculum.service;

import com.deutschflow.curriculum.dto.RoadmapNodeDto;
import com.deutschflow.speaking.ai.OpenAiChatClient;
import com.deutschflow.testsupport.AbstractPostgresIntegrationTest;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.entity.UserLearningProfile;
import com.deutschflow.user.repository.UserLearningProfileRepository;
import com.deutschflow.user.repository.UserRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Lộ trình theo trình độ trên giáo trình THẬT sau Flyway (V352). Mock không bắt được lỗi này: nó
 * nằm ở dữ liệu — {@code node_family} thiếu, tiền đề ghi mã "D12" trong khi node mang mã "A1-002",
 * dependency nối qua node rỗng.
 */
@SpringBootTest
@DisplayName("lộ trình theo trình độ trên giáo trình thật")
class RoadmapTheoTrinhDoIntegrationTest extends AbstractPostgresIntegrationTest {

    @Autowired private RoadmapService roadmapService;
    @Autowired private SkillTreeService skillTreeService;
    @Autowired private UserRepository userRepository;
    @Autowired private UserLearningProfileRepository profileRepository;
    @Autowired private JdbcTemplate jdbcTemplate;

    @MockBean private OpenAiChatClient chatClient;

    private long learnerAt(UserLearningProfile.CurrentLevel level) {
        User learner = userRepository.save(User.builder()
                .email("lo-trinh-" + System.nanoTime() + "@local.test")
                .passwordHash("x")
                .displayName("Lo Trinh")
                .role(User.Role.STUDENT)
                .build());
        profileRepository.save(UserLearningProfile.builder()
                .user(learner)
                .goalType(UserLearningProfile.GoalType.CERT)
                .targetLevel(UserLearningProfile.TargetLevel.B1)
                .currentLevel(level)
                .sessionsPerWeek(3)
                .minutesPerSession(30)
                .build());
        return learner.getId();
    }

    private long nodeOnDay(int day) {
        Long id = jdbcTemplate.queryForObject(
                "SELECT id FROM skill_tree_nodes WHERE node_type = 'CORE_TRUNK' AND day_number = ?",
                Long.class, day);
        return id == null ? -1L : id;
    }

    private void complete(long userId, int day) {
        jdbcTemplate.update("""
                INSERT INTO skill_tree_user_progress (user_id, node_id, status, score_percent, best_score)
                VALUES (?, ?, 'COMPLETED', 100, 100)
                ON CONFLICT (user_id, node_id)
                DO UPDATE SET status = 'COMPLETED', score_percent = 100, best_score = 100
                """, userId, nodeOnDay(day));
    }

    @Test
    @DisplayName("B1 mới: 5 bài B1, bắt đầu từ Ngày 1, mở được bài, meta không 500")
    void b1MoiVaoDungBaiB1() {
        long userId = learnerAt(UserLearningProfile.CurrentLevel.B1);

        List<RoadmapNodeDto> nodes = roadmapService.generateRoadmapForUser(userId);

        assertThat(nodes).extracting(RoadmapNodeDto::cefrLevel).containsOnly("B1");
        assertThat(nodes).hasSize(5);
        assertThat(nodes.get(0).dayNumber()).isEqualTo(1);
        assertThat(nodes.get(0).weekNumber()).isEqualTo(1);
        assertThat(nodes.get(0).progressStatus()).isEqualTo("AVAILABLE");
        assertThat(nodes.subList(1, 5)).extracting(RoadmapNodeDto::progressStatus).containsOnly("LOCKED");

        Map<String, Object> session = skillTreeService.getNodeSession(userId, nodes.get(0).id());
        assertThat(session.get("dependenciesMet")).isEqualTo(true);
        assertThat(session.get("hasContent")).isEqualTo(true);

        Map<String, Object> meta = roadmapService.getRoadmapMeta(userId);
        assertThat(meta.get("totalNodes")).isEqualTo(5L);
    }

    @Test
    @DisplayName("A0 mới: mở từ ngày 1, có một nụ để bấm chứ không khoá cả cây; meta không 500")
    void a0MoiCoDiemVao() {
        long userId = learnerAt(UserLearningProfile.CurrentLevel.A0);

        List<RoadmapNodeDto> nodes = roadmapService.generateRoadmapForUser(userId);

        assertThat(nodes.get(0).dayNumber()).isEqualTo(1);
        assertThat(nodes.get(0).progressStatus()).isEqualTo("AVAILABLE");
        assertThat(roadmapService.getRoadmapMeta(userId).get("currentNodeCode")).isNotNull();
    }

    @Test
    @DisplayName("A1: ngày 11 không chờ ngày 10, và không kẹt ở ngày 13 sau khi xong ngày 12")
    void a1DiQuaNgay13() {
        long userId = learnerAt(UserLearningProfile.CurrentLevel.A1);

        assertThat(skillTreeService.getNodeSession(userId, nodeOnDay(11)).get("dependenciesMet")).isEqualTo(true);

        complete(userId, 11);
        complete(userId, 12);

        List<RoadmapNodeDto> nodes = roadmapService.generateRoadmapForUser(userId);
        assertThat(nodes.get(2).dayNumber()).isEqualTo(3);
        assertThat(nodes.get(2).state()).isEqualTo("current");
    }

    @Test
    @DisplayName("A2: ẩn bài rỗng, xong ngày 31 đi thẳng tới ngày 35 và mở được")
    void a2KhongKetOBaiRong() {
        long userId = learnerAt(UserLearningProfile.CurrentLevel.A2);

        List<RoadmapNodeDto> nodes = roadmapService.generateRoadmapForUser(userId);
        assertThat(nodes).extracting(RoadmapNodeDto::id).doesNotContain((int) nodeOnDay(32));

        complete(userId, 31);

        assertThat(skillTreeService.getNodeSession(userId, nodeOnDay(35)).get("dependenciesMet")).isEqualTo(true);
        assertThat(roadmapService.generateRoadmapForUser(userId).get(1).state()).isEqualTo("current");
    }

    @Test
    @DisplayName("skill tree: B1 mới được mở khoá bài B1, không phải bảng chữ cái, cùng số ngày với lộ trình")
    void skillTreeCungDiemVao() {
        long userId = learnerAt(UserLearningProfile.CurrentLevel.B1);

        List<Map<String, Object>> rows = skillTreeService.getSkillTreeForUser(userId);

        assertThat(rows).filteredOn(r -> "CORE_TRUNK".equals(r.get("node_type"))).hasSize(5);
        assertThat(rows.get(0).get("cefr_level")).isEqualTo("B1");
        assertThat(rows.get(0).get("day_number")).isEqualTo(1);
        assertThat(rows.get(0).get("user_status")).isEqualTo("UNLOCKED");
        assertThat(rows.get(1).get("user_status")).isEqualTo("LOCKED");
    }

    @Test
    @DisplayName("V352: mọi node gốc có mã, node đã phát hành có ngưỡng đạt, tiền đề không còn mã D..")
    void duLieuSauMigration() {
        assertThat(jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM skill_tree_nodes WHERE node_type = 'CORE_TRUNK' AND node_code IS NULL",
                Integer.class)).isZero();
        assertThat(jdbcTemplate.queryForObject("""
                SELECT COUNT(*) FROM skill_tree_nodes
                WHERE node_family IS NOT NULL AND COALESCE(mastery_threshold, 0) <= 0
                """, Integer.class)).isZero();
        assertThat(jdbcTemplate.queryForObject("""
                SELECT COUNT(*) FROM skill_tree_nodes
                WHERE node_type = 'CORE_TRUNK' AND prerequisites_json::text LIKE '%"D%'
                """, Integer.class)).isZero();
    }
}
