package com.deutschflow.curriculum.service;

import com.deutschflow.testsupport.AbstractPostgresIntegrationTest;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Ngân hàng câu hỏi Kiểm tra đầu vào (V71 A1 + V332 A2–C1) phải khớp hợp đồng của
 * {@link PlacementTestService}: đủ 10 câu mỗi trình độ, mỗi kỹ năng có câu, MCQ có đáp án nằm trong
 * options, câu tự luận có keyword để chấm. Chạy trên Postgres thật vì dữ liệu nằm trong migration.
 */
@SpringBootTest
@DisplayName("Ngân hàng placement A1–C1 — đủ câu, đúng hợp đồng chấm")
class PlacementQuestionBankDbTest extends AbstractPostgresIntegrationTest {

    @Autowired private PlacementTestService placementTestService;
    @Autowired private UserRepository userRepository;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private ObjectMapper objectMapper;

    @ParameterizedTest(name = "{0}: tạo bài 10 câu đủ 4 kỹ năng, ngân hàng đúng hợp đồng")
    @ValueSource(strings = {"A1", "A2", "B1", "B2", "C1"})
    @SuppressWarnings("unchecked")
    void bankIsSufficientAndConsistent(String level) throws Exception {
        List<Map<String, Object>> rows = jdbc.queryForList("""
                SELECT skill_section, question_type, question_de, question_vi, correct_answer,
                       options_json::text AS options_json,
                       to_jsonb(grading_keywords)::text AS grading_keywords
                FROM placement_questions WHERE cefr_level = ? AND is_active = TRUE
                """, level);
        assertThat(rows).as("số câu active của %s", level).hasSizeGreaterThanOrEqualTo(10);

        Set<String> skills = rows.stream().map(r -> (String) r.get("skill_section")).collect(Collectors.toSet());
        assertThat(skills).containsExactlyInAnyOrder("HOEREN", "SPRECHEN", "LESEN", "SCHREIBEN");

        for (Map<String, Object> r : rows) {
            String type = (String) r.get("question_type");
            String de = (String) r.get("question_de");
            assertThat((String) r.get("question_vi")).as("question_vi của: %s", de).isNotBlank();
            if ("MULTIPLE_CHOICE".equals(type)) {
                List<String> options = objectMapper.readValue((String) r.get("options_json"), List.class);
                assertThat(options).as("options của: %s", de).hasSizeGreaterThanOrEqualTo(3);
                assertThat(options).as("correct_answer phải nằm trong options: %s", de).contains((String) r.get("correct_answer"));
            }
            if ("SPEAKING".equals(type) || "FREE_WRITE".equals(type)) {
                String kw = (String) r.get("grading_keywords");
                assertThat(kw).as("grading_keywords của: %s", de).isNotNull().isNotEqualTo("null");
                List<String> keywords = objectMapper.readValue(kw, List.class);
                assertThat(keywords).as("keyword để chấm: %s", de).hasSizeGreaterThanOrEqualTo(3);
            }
        }

        User learner = userRepository.save(User.builder()
                .email("bank-" + level.toLowerCase() + "-" + UUID.randomUUID() + "@test.local")
                .passwordHash("x")
                .displayName("Bank Tester")
                .role(User.Role.STUDENT)
                .build());
        Map<String, Object> created = placementTestService.createTest(learner.getId(), level);
        List<Map<String, Object>> questions = (List<Map<String, Object>>) created.get("questions");
        assertThat(questions).hasSize(10);
        Set<String> pickedSkills = questions.stream().map(q -> (String) q.get("skillSection")).collect(Collectors.toSet());
        assertThat(pickedSkills).as("bài %s phải phủ 4 kỹ năng", level)
                .containsExactlyInAnyOrder("HOEREN", "SPRECHEN", "LESEN", "SCHREIBEN");
        // Không lộ đáp án cho client.
        assertThat(questions).allSatisfy(q -> assertThat(q).doesNotContainKey("correctAnswer"));
    }
}
