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
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Test đối chứng của đợt 1 lộ trình (NFR-lotrinhcn-03, AC-ROUTE-03, AC-ROUTE-11) trên giáo trình
 * THẬT sau Flyway: với cùng một học viên, {@code /roadmap/me} và {@code /skill-tree/me} phải trả cùng
 * tập bài và cùng trạng thái từng bài. Trước đợt 1 hai đường dùng hai luật mở khoá và hai bộ lọc.
 */
@SpringBootTest
@Transactional
@DisplayName("đối chứng /roadmap/me và /skill-tree/me")
class LoTrinhDoiChungIntegrationTest extends AbstractPostgresIntegrationTest {

    @Autowired private RoadmapService roadmapService;
    @Autowired private SkillTreeService skillTreeService;
    @Autowired private UserRepository userRepository;
    @Autowired private UserLearningProfileRepository profileRepository;
    @Autowired private JdbcTemplate jdbcTemplate;

    @MockBean private OpenAiChatClient chatClient;

    private long learnerAt(UserLearningProfile.CurrentLevel level, String interestsJson) {
        User learner = userRepository.save(User.builder()
                .email("doi-chung-" + System.nanoTime() + "@local.test")
                .passwordHash("x")
                .displayName("Doi Chung")
                .role(User.Role.STUDENT)
                .build());
        profileRepository.save(UserLearningProfile.builder()
                .user(learner)
                .goalType(UserLearningProfile.GoalType.CERT)
                .targetLevel(UserLearningProfile.TargetLevel.B1)
                .currentLevel(level)
                .interestsJson(interestsJson)
                .sessionsPerWeek(3)
                .minutesPerSession(30)
                .build());
        return learner.getId();
    }

    private void progress(long userId, long nodeId, String status, int bestScore) {
        jdbcTemplate.update("""
                INSERT INTO skill_tree_user_progress (user_id, node_id, status, score_percent, best_score)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT (user_id, node_id)
                DO UPDATE SET status = EXCLUDED.status, score_percent = EXCLUDED.score_percent,
                              best_score = EXCLUDED.best_score
                """, userId, nodeId, status, bestScore, bestScore);
    }

    /** id bài → trạng thái 4 giá trị, đọc từ /skill-tree/me (UNLOCKED chuẩn hoá thành AVAILABLE). */
    private Map<Long, String> skillTreeStates(long userId) {
        Map<Long, String> out = new LinkedHashMap<>();
        for (Map<String, Object> r : skillTreeService.getSkillTreeForUser(userId)) {
            String st = String.valueOf(r.get("user_status"));
            out.put(((Number) r.get("id")).longValue(), "UNLOCKED".equals(st) ? "AVAILABLE" : st);
        }
        return out;
    }

    private Map<Long, String> roadmapStates(long userId) {
        Map<Long, String> out = new LinkedHashMap<>();
        for (RoadmapNodeDto n : roadmapService.generateRoadmapForUser(userId)) {
            out.put((long) n.id(), n.progressStatus());
        }
        return out;
    }

    @Test
    @DisplayName("NFR-03: 32 học viên (A0/A1/A2/B1 × 0–7 bài đã xong) thấy cùng tập bài, cùng trạng thái")
    void haiDuongKhopTungBai() {
        int learners = 0;
        for (UserLearningProfile.CurrentLevel level : List.of(
                UserLearningProfile.CurrentLevel.A0, UserLearningProfile.CurrentLevel.A1,
                UserLearningProfile.CurrentLevel.A2, UserLearningProfile.CurrentLevel.B1)) {
            for (int done = 0; done < 8; done++) {
                // Một nửa có interests: từ đợt 1 không còn làm đổi thứ tự hay trạng thái (ROUTE-03).
                long userId = learnerAt(level, done % 2 == 0 ? null : "[\"familie\",\"arbeit\"]");
                List<Long> order = List.copyOf(roadmapStates(userId).keySet());
                for (int i = 0; i < done && i < order.size(); i++) {
                    progress(userId, order.get(i), "COMPLETED", 100);
                }
                Map<Long, String> skill = skillTreeStates(userId);
                Map<Long, String> roadmap = roadmapStates(userId);

                assertThat(roadmap.keySet()).as("%s, %d bài xong: tập bài", level, done)
                        .containsExactlyInAnyOrderElementsOf(skill.keySet());
                assertThat(roadmap).as("%s, %d bài xong: trạng thái", level, done).isEqualTo(skill);
                // Hai đường giờ cùng một hàm nên so nhau không đủ: chuỗi tiền đề thật phải để đúng
                // MỘT bài được mời khi học viên đi tuần tự (luật "một nụ" cũ từng che lỗi nối chuỗi).
                if (done < order.size()) {
                    assertThat(roadmap.values().stream().filter(s -> s.equals("AVAILABLE") || s.equals("IN_PROGRESS")))
                            .as("%s, %d bài xong: số bài đang mời", level, done).hasSize(1);
                }
                learners++;
            }
        }
        assertThat(learners).isGreaterThanOrEqualTo(30);
    }

    @Test
    @DisplayName("NFR-03 ca biên: bài IN_PROGRESS đã đạt ngưỡng tính là xong ở cả hai đường và mở bài kế")
    void diemDatNguongTinhLaXong() {
        long userId = learnerAt(UserLearningProfile.CurrentLevel.A1, null);
        List<Long> order = List.copyOf(roadmapStates(userId).keySet());
        progress(userId, order.get(0), "IN_PROGRESS", 100);

        Map<Long, String> skill = skillTreeStates(userId);
        Map<Long, String> roadmap = roadmapStates(userId);

        assertThat(roadmap).isEqualTo(skill);
        assertThat(roadmap.get(order.get(0))).isEqualTo("COMPLETED");
        assertThat(roadmap.get(order.get(1))).isEqualTo("AVAILABLE");
    }

    @Test
    @DisplayName("AC-ROUTE-03: bài nhánh phụ và bài chưa phát hành không có ở hai đường, không tính vào meta")
    void baiChuaPhatHanhVangMat() {
        long userId = learnerAt(UserLearningProfile.CurrentLevel.A0, null);
        List<Long> hidden = jdbcTemplate.queryForList("""
                SELECT id FROM skill_tree_nodes
                WHERE node_type = 'SATELLITE_LEAF' OR node_family IS NULL OR is_active = FALSE
                """, Long.class);
        assertThat(hidden).as("giáo trình seed có bài nhánh phụ / bài nháp để kiểm").isNotEmpty();

        assertThat(roadmapStates(userId).keySet()).doesNotContainAnyElementsOf(hidden);
        assertThat(skillTreeStates(userId).keySet()).doesNotContainAnyElementsOf(hidden);

        Long published = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM v_skill_tree_roadmap_nodes n WHERE " + RoadmapRules.PUBLISHED
                        + " AND n.day_number >= 1", Long.class);
        assertThat(roadmapService.getRoadmapMeta(userId).get("totalNodes"))
                .as("meta chỉ đếm bài đã phát hành")
                .isEqualTo(published);
    }
}
