package com.deutschflow.curriculum.service;

import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.speaking.ai.OpenAiChatClient;
import com.deutschflow.testsupport.AbstractPostgresIntegrationTest;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.onboarding.service.OnboardingActivationService;
import com.deutschflow.user.repository.UserRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Luật hoàn thành của node có cả {@code exercises} và {@code skill_exercises}: đạt một trong hai
 * đường là xong, đường còn lại chỉ để luyện thêm (có điểm, không XP, không ghi tiến độ). Node chỉ có
 * một đường giữ nguyên hành vi cũ, vì web phân loại câu 400 "đã hoàn thành".
 */
@SpringBootTest
@Transactional
@DisplayName("node có hai đường chấm")
class NodeHaiDuongChamIntegrationTest extends AbstractPostgresIntegrationTest {

    private static final String EXERCISES = """
            "exercises": {
              "theory_gate": [{"id": "g1", "type": "MULTIPLE_CHOICE", "correct": 1}],
              "practice": [{"id": "p1", "type": "FILL_BLANK", "answer": "gehe"}]
            }""";
    private static final String SKILL_EXERCISES = """
            "skill_exercises": {
              "HOEREN": [{"type": "LISTEN_AND_CHOOSE", "correct_index": 0}],
              "SPRECHEN": [{"type": "SPEAKING_REPEAT"}],
              "LESEN": {"reading_passage": {"text_de": "Text"},
                        "exercises": [{"type": "READ_AND_CHOOSE", "correct_index": 2}]},
              "SCHREIBEN": [{"type": "FILL_GRAMMAR", "correct_answer": "bin"}]
            }""";

    private static final Map<String, Object> DUNG_HET_BAI_TAP = Map.of("item_answers",
            Map.of("g1", Map.of("choice", 1), "p1", Map.of("text", "gehe")));
    private static final Map<String, Object> SAI_HET_BAI_TAP = Map.of("item_answers",
            Map.of("g1", Map.of("choice", 0), "p1", Map.of("text", "falsch")));
    private static final Map<String, Object> DUNG_HET_KY_NANG = Map.of(
            "HOEREN", Map.of("0", Map.of("answer", 0)),
            "SPRECHEN", Map.of("0", Map.of("answer", "spoken")),
            "LESEN", Map.of("0", Map.of("answer", 2)),
            "SCHREIBEN", Map.of("0", Map.of("answer", "bin")));
    private static final Map<String, Object> SAI_HET_KY_NANG = Map.of(
            "HOEREN", Map.of("0", Map.of("answer", 3)),
            "SPRECHEN", Map.of("0", Map.of("answer", "")),
            "LESEN", Map.of("0", Map.of("answer", 3)),
            "SCHREIBEN", Map.of("0", Map.of("answer", "falsch")));

    @Autowired private SkillTreeService skillTreeService;
    @Autowired private UserRepository userRepository;
    @Autowired private JdbcTemplate jdbcTemplate;

    @MockBean private OpenAiChatClient chatClient;
    @MockBean private PracticeNodeService practiceNodeService;
    // Ghi activation chạy REQUIRES_NEW, không thấy học viên chưa commit trong transaction của test.
    @MockBean private OnboardingActivationService activationService;

    private long hocVien() {
        return userRepository.save(User.builder()
                .email("hai-duong-" + System.nanoTime() + "@local.test")
                .passwordHash("x")
                .displayName("Hai Duong")
                .role(User.Role.STUDENT)
                .build()).getId();
    }

    private long node(String... phan) {
        Long id = jdbcTemplate.queryForObject("""
                INSERT INTO skill_tree_nodes
                    (node_type, title_de, title_vi, cefr_level, industry, vocab_strategy, content_json)
                VALUES ('SATELLITE_LEAF', 'Zwei Wege', 'Hai đường', 'A2', 'Hai-Duong-Test', 'CONTEXT', ?::jsonb)
                RETURNING id
                """, Long.class, "{" + String.join(",", phan) + "}");
        return id == null ? -1L : id;
    }

    private Map<String, Object> tienDo(long userId, long nodeId) {
        return jdbcTemplate.queryForMap("""
                SELECT status, score_percent, best_score, attempts, xp_earned
                FROM skill_tree_user_progress WHERE user_id = ? AND node_id = ?
                """, userId, nodeId);
    }

    @Test
    @DisplayName("đạt đường bài tập thì xong, nộp đường 4 kỹ năng sau đó không cộng XP, không ghi tiến độ")
    void datDuongBaiTap_duongKyNangChiLuyenThem() {
        long userId = hocVien();
        long nodeId = node(EXERCISES, SKILL_EXERCISES);

        Map<String, Object> dau = skillTreeService.submitNodeExercises(userId, nodeId, DUNG_HET_BAI_TAP);
        assertThat(dau.get("completed")).isEqualTo(true);
        assertThat((Integer) dau.get("xpEarned")).isPositive();
        Map<String, Object> truoc = tienDo(userId, nodeId);

        Map<String, Object> sau = skillTreeService.submitSkillExercises(userId, nodeId, SAI_HET_KY_NANG);

        assertThat(sau.get("alreadyCompleted")).isEqualTo(true);
        assertThat(sau.get("completed")).isEqualTo(true);
        assertThat(sau.get("status")).isEqualTo("COMPLETED");
        assertThat(sau.get("scorePercent")).isEqualTo(0);
        assertThat(sau.get("xpEarned")).isEqualTo(0);
        assertThat(sau).containsKey("perSkill");
        assertThat(tienDo(userId, nodeId)).isEqualTo(truoc);
    }

    @Test
    @DisplayName("đạt đường 4 kỹ năng thì xong, nộp đường bài tập sau đó không cộng XP, không ghi tiến độ")
    void datDuongKyNang_duongBaiTapChiLuyenThem() {
        long userId = hocVien();
        long nodeId = node(EXERCISES, SKILL_EXERCISES);

        Map<String, Object> dau = skillTreeService.submitSkillExercises(userId, nodeId, DUNG_HET_KY_NANG);
        assertThat(dau.get("completed")).isEqualTo(true);
        assertThat(dau.get("scorePercent")).isEqualTo(100);
        Map<String, Object> truoc = tienDo(userId, nodeId);

        Map<String, Object> sau = skillTreeService.submitNodeExercises(userId, nodeId, DUNG_HET_BAI_TAP);

        assertThat(sau.get("alreadyCompleted")).isEqualTo(true);
        assertThat(sau.get("scorePercent")).isEqualTo(100);
        assertThat(sau.get("xpEarned")).isEqualTo(0);
        assertThat(tienDo(userId, nodeId)).isEqualTo(truoc);
    }

    @Test
    @DisplayName("trượt một đường vẫn đạt được bằng đường kia, và lần trượt không làm mất điểm cao nhất")
    void truotMotDuong_datDuongKia() {
        long userId = hocVien();
        long nodeId = node(EXERCISES, SKILL_EXERCISES);

        Map<String, Object> truot = skillTreeService.submitNodeExercises(userId, nodeId, SAI_HET_BAI_TAP);
        assertThat(truot.get("completed")).isEqualTo(false);
        assertThat(tienDo(userId, nodeId).get("status")).isEqualTo("IN_PROGRESS");

        Map<String, Object> dat = skillTreeService.submitSkillExercises(userId, nodeId, DUNG_HET_KY_NANG);

        assertThat(dat.get("completed")).isEqualTo(true);
        Map<String, Object> cuoi = tienDo(userId, nodeId);
        assertThat(cuoi.get("status")).isEqualTo("COMPLETED");
        assertThat(cuoi.get("best_score")).isEqualTo(100);
        assertThat(cuoi.get("attempts")).isEqualTo(2);
    }

    @Test
    @DisplayName("kỹ năng không gửi lên bị tính là chưa làm, chỉ gửi phần nói không qua được bài")
    void chiGuiPhanNoi_khongQuaDuocBai() {
        long userId = hocVien();
        long nodeId = node(SKILL_EXERCISES);

        Map<String, Object> ketQua = skillTreeService.submitSkillExercises(userId, nodeId,
                Map.of("SPRECHEN", Map.of("0", Map.of("answer", "spoken"))));

        assertThat(ketQua.get("scorePercent")).isEqualTo(25);
        assertThat(ketQua.get("completed")).isEqualTo(false);
    }

    @Test
    @DisplayName("nộp lại đường bài tập mà không gửi đáp án vẫn bị từ chối, không tin điểm client")
    void nopLaiKhongCoDapAn_biTuChoi() {
        long userId = hocVien();
        long nodeId = node(EXERCISES, SKILL_EXERCISES);
        skillTreeService.submitNodeExercises(userId, nodeId, DUNG_HET_BAI_TAP);

        assertThatThrownBy(() -> skillTreeService.submitNodeExercises(userId, nodeId, Map.of("score_percent", 100)))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("đã hoàn thành");
    }

    @Test
    @DisplayName("node chỉ có một đường giữ câu 400 đã hoàn thành")
    void motDuong_giuHanhViCu() {
        long userId = hocVien();
        long chiBaiTap = node(EXERCISES);
        skillTreeService.submitNodeExercises(userId, chiBaiTap, DUNG_HET_BAI_TAP);
        assertThatThrownBy(() -> skillTreeService.submitNodeExercises(userId, chiBaiTap, DUNG_HET_BAI_TAP))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("đã hoàn thành");

        long chiKyNang = node(SKILL_EXERCISES);
        skillTreeService.submitSkillExercises(userId, chiKyNang, DUNG_HET_KY_NANG);
        assertThatThrownBy(() -> skillTreeService.submitSkillExercises(userId, chiKyNang, DUNG_HET_KY_NANG))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("đã hoàn thành");
    }
}
