package com.deutschflow.curriculum.service;

import com.deutschflow.curriculum.dto.RoadmapNodeDto;
import com.deutschflow.speaking.ai.OpenAiChatClient;
import com.deutschflow.testsupport.AbstractPostgresIntegrationTest;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.entity.UserLearningProfile;
import com.deutschflow.user.repository.UserLearningProfileRepository;
import com.deutschflow.user.repository.UserRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.IntStream;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Nội dung nháp A2/B1 (V353, V354) trên DB thật sau Flyway: chưa duyệt thì không tới tay học viên,
 * và khi {@code phat_hanh_node_goc} (V355) chạy thì học viên đi được tuần tự không kẹt. Phát hành
 * chạy trong transaction của test rồi rollback, nên các lớp test khác vẫn thấy trạng thái nháp.
 */
@SpringBootTest
@Transactional
@DisplayName("nội dung nháp A2/B1 và bước phát hành")
class NoiDungA2B1NhapIntegrationTest extends AbstractPostgresIntegrationTest {

    private static final int[] A2_NHAP = {32, 33, 34, 36, 37, 38, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50};
    private static final int[] B1_NHAP = {56, 57, 58, 59, 60};

    @Autowired private RoadmapService roadmapService;
    @Autowired private SkillTreeService skillTreeService;
    @Autowired private UserRepository userRepository;
    @Autowired private UserLearningProfileRepository profileRepository;
    @Autowired private JdbcTemplate jdbcTemplate;
    @Autowired private ObjectMapper objectMapper;

    @MockBean private OpenAiChatClient chatClient;

    private long learnerAt(UserLearningProfile.CurrentLevel level) {
        User learner = userRepository.save(User.builder()
                .email("nhap-a2-b1-" + System.nanoTime() + "@local.test")
                .passwordHash("x")
                .displayName("Nhap A2 B1")
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

    private void complete(long userId, long nodeId) {
        jdbcTemplate.update("""
                INSERT INTO skill_tree_user_progress (user_id, node_id, status, score_percent, best_score)
                VALUES (?, ?, 'COMPLETED', 100, 100)
                ON CONFLICT (user_id, node_id)
                DO UPDATE SET status = 'COMPLETED', score_percent = 100, best_score = 100
                """, userId, nodeId);
    }

    private int publish(int... days) {
        String mang = "{" + String.join(",", IntStream.of(days).mapToObj(String::valueOf).toList()) + "}";
        return jdbcTemplate.queryForObject("SELECT phat_hanh_node_goc(?::int[])", Integer.class, mang);
    }

    private List<String> texts(JsonNode array) {
        List<String> out = new ArrayList<>();
        array.forEach(n -> out.add(n.asText()));
        return out;
    }

    private int[] allDrafts() {
        return IntStream.concat(IntStream.of(A2_NHAP), IntStream.of(B1_NHAP)).toArray();
    }

    private JsonNode contentOfDay(int day) throws Exception {
        return objectMapper.readTree(jdbcTemplate.queryForObject(
                "SELECT content_json::text FROM skill_tree_nodes WHERE node_type = 'CORE_TRUNK' AND day_number = ?",
                String.class, day));
    }

    @Test
    @DisplayName("chưa duyệt: lộ trình và cây vẫn ẩn bài nháp, gõ thẳng id không đọc được nội dung")
    void chuaDuyetKhongToiHocVien() {
        long a2 = learnerAt(UserLearningProfile.CurrentLevel.A2);

        List<RoadmapNodeDto> nodes = roadmapService.generateRoadmapForUser(a2);
        assertThat(nodes).filteredOn(n -> "A2".equals(n.cefrLevel())).hasSize(4);
        assertThat(nodes).filteredOn(n -> "B1".equals(n.cefrLevel())).hasSize(5);
        assertThat(skillTreeService.getSkillTreeForUser(a2))
                .extracting(r -> ((Number) r.get("id")).longValue())
                .doesNotContain(nodeOnDay(32), nodeOnDay(50), nodeOnDay(56));

        Map<String, Object> session = skillTreeService.getNodeSession(a2, nodeOnDay(32));
        assertThat(session.get("hasContent")).isEqualTo(false);
        assertThat(session.get("content")).isNull();

        assertThat(jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM skill_tree_nodes WHERE node_type = 'CORE_TRUNK' AND day_number = ANY (?::int[]) AND node_family IS NOT NULL",
                Integer.class, "{32,33,34,36,37,38,41,42,43,44,45,46,47,48,49,50,56,57,58,59,60}")).isZero();
    }

    @Test
    @DisplayName("mỗi bài nháp đủ phần và làm đúng hết thì NodeExerciseGrader cho 100%")
    void baiNhapChamDuoc() throws Exception {
        for (int day : allDrafts()) {
            JsonNode content = contentOfDay(day);
            assertThat(content.path("theory_cards").size()).as("theory_cards ngày %d", day).isGreaterThanOrEqualTo(3);
            assertThat(content.path("vocabulary").size()).as("vocabulary ngày %d", day).isGreaterThanOrEqualTo(4);
            assertThat(content.path("reading_passage").path("questions").size()).as("đọc ngày %d", day).isGreaterThanOrEqualTo(2);
            assertThat(content.path("audio_content").path("listen_words").size()).as("nghe ngày %d", day).isGreaterThanOrEqualTo(3);

            Map<String, Object> answers = new HashMap<>();
            List<JsonNode> items = new ArrayList<>();
            content.path("exercises").path("theory_gate").forEach(items::add);
            content.path("exercises").path("practice").forEach(items::add);
            for (JsonNode item : items) {
                switch (item.path("type").asText()) {
                    case "MULTIPLE_CHOICE" -> answers.put(item.path("id").asText(), Map.of("choice", item.path("correct").asInt()));
                    case "FILL_BLANK" -> answers.put(item.path("id").asText(), Map.of("text", item.path("answer").asText()));
                    case "REORDER" -> assertThat(texts(item.path("words")))
                            .as("REORDER %s", item.path("id").asText())
                            .containsExactlyInAnyOrderElementsOf(texts(item.path("correct_order")));
                    default -> { }
                }
            }
            String json = objectMapper.writeValueAsString(content);
            assertThat(NodeExerciseGrader.countScored(objectMapper, json)).as("số câu chấm ngày %d", day).isGreaterThanOrEqualTo(6);
            assertThat(NodeExerciseGrader.grade(objectMapper, json, answers).percent()).as("điểm ngày %d", day).isEqualTo(100);
        }
    }

    @Test
    @DisplayName("sau khi phát hành: A2 thấy đủ 30 bài từ Ngày 1 và đi tuần tự tới hết B1")
    void phatHanhXongDiDuocTuanTu() {
        assertThat(publish(allDrafts())).isEqualTo(21);
        long a2 = learnerAt(UserLearningProfile.CurrentLevel.A2);

        List<RoadmapNodeDto> nodes = roadmapService.generateRoadmapForUser(a2);
        assertThat(nodes).filteredOn(n -> "A2".equals(n.cefrLevel())).hasSize(20);
        assertThat(nodes).filteredOn(n -> "B1".equals(n.cefrLevel())).hasSize(10);
        assertThat(nodes).extracting(RoadmapNodeDto::dayNumber)
                .containsExactlyElementsOf(IntStream.rangeClosed(1, 30).boxed().toList());
        assertThat(roadmapService.getRoadmapMeta(a2).get("totalNodes")).isEqualTo(30L);

        for (int i = 0; i < nodes.size(); i++) {
            long nodeId = nodes.get(i).id();
            List<RoadmapNodeDto> now = roadmapService.generateRoadmapForUser(a2);
            assertThat(now.get(i).state()).as("bài thứ %d phải là bài hiện tại", i + 1).isEqualTo("current");
            if (i + 1 < now.size()) {
                assertThat(now.get(i + 1).state()).as("bài sau bài thứ %d còn khoá", i + 1).isEqualTo("locked");
            }
            Map<String, Object> session = skillTreeService.getNodeSession(a2, nodeId);
            assertThat(session.get("dependenciesMet")).as("mở được bài thứ %d", i + 1).isEqualTo(true);
            assertThat(session.get("hasContent")).as("bài thứ %d có nội dung", i + 1).isEqualTo(true);
            complete(a2, nodeId);
        }
    }

    @Test
    @DisplayName("sau khi phát hành: ngày 35 chờ ngày 34, ngày 51 chờ ngày 50, đường tắt của V352 biến mất")
    void phatHanhXongChuoiDungThuTu() {
        publish(allDrafts());
        long a2 = learnerAt(UserLearningProfile.CurrentLevel.A2);

        complete(a2, nodeOnDay(31));
        assertThat(skillTreeService.getNodeSession(a2, nodeOnDay(35)).get("dependenciesMet")).isEqualTo(false);

        List<Long> truocNgay51 = jdbcTemplate.queryForList(
                "SELECT depends_on_node_id FROM skill_tree_node_dependencies WHERE node_id = ?", Long.class, nodeOnDay(51));
        assertThat(truocNgay51).containsExactly(nodeOnDay(50));
        assertThat(jdbcTemplate.queryForObject(
                "SELECT node_family FROM skill_tree_nodes WHERE node_type = 'CORE_TRUNK' AND day_number = 50",
                String.class)).isEqualTo("CHECKPOINT");
    }

    @Test
    @DisplayName("duyệt từng đợt: bài chưa duyệt vẫn ẩn và không chặn bài sau nó")
    void duyetTungDotKhongKet() {
        assertThat(publish(32, 33)).isEqualTo(2);
        long a2 = learnerAt(UserLearningProfile.CurrentLevel.A2);

        assertThat(roadmapService.generateRoadmapForUser(a2)).filteredOn(n -> "A2".equals(n.cefrLevel())).hasSize(6);

        complete(a2, nodeOnDay(31));
        complete(a2, nodeOnDay(32));
        complete(a2, nodeOnDay(33));
        assertThat(skillTreeService.getNodeSession(a2, nodeOnDay(35)).get("dependenciesMet")).isEqualTo(true);
    }

    @Test
    @DisplayName("phát hành không mở được vỏ rỗng và chạy lại không đổi gì")
    void khongPhatHanhVoRong() {
        jdbcTemplate.update("""
                UPDATE skill_tree_nodes SET content_json = jsonb_set(content_json, '{theory_cards}', '[]'::jsonb)
                WHERE node_type = 'CORE_TRUNK' AND day_number = 32
                """);

        assertThat(publish(32)).isZero();
        assertThat(publish(33)).isEqualTo(1);
        assertThat(publish(33)).isZero();
    }

    @Test
    @DisplayName("học viên B1 có 10 bài từ Ngày 1 sau khi phát hành, A1 và A0 không đổi điểm vào")
    void phatHanhKhongDoiDiemVao() {
        publish(allDrafts());

        long b1 = learnerAt(UserLearningProfile.CurrentLevel.B1);
        List<RoadmapNodeDto> b1Nodes = roadmapService.generateRoadmapForUser(b1);
        assertThat(b1Nodes).hasSize(10);
        assertThat(b1Nodes.get(0).dayNumber()).isEqualTo(1);
        assertThat(b1Nodes.get(9).dayNumber()).isEqualTo(10);

        long a1 = learnerAt(UserLearningProfile.CurrentLevel.A1);
        assertThat((long) roadmapService.generateRoadmapForUser(a1).get(0).id()).isEqualTo(nodeOnDay(11));
    }
}
