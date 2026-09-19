package com.deutschflow.curriculum.service;

import com.deutschflow.testsupport.AbstractPostgresIntegrationTest;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Bài kiểm tra đầu vào trọn vòng trên Postgres THẬT (Testcontainers ở CI, hoặc
 * {@code DEUTSCHFLOW_IT_JDBC_URL} cục bộ): tạo bài A1 từ ngân hàng V71 rồi nộp.
 *
 * <p>Hồi quy QA simulator 19/09/2026: nộp bài luôn 400 "Invalid test session data" vì
 * {@code question_ids BIGINT[]} về dạng {@code java.sql.Array} — unit test không thấy được vì nó
 * phụ thuộc driver thật. Đặt tên {@code *Test} (không {@code *IT}) để chạy ở stage unit của CI,
 * cùng lý do với {@code AccountDeletionServiceDbTest}.
 */
@SpringBootTest
@DisplayName("PlacementTestService — tạo + nộp bài trên Postgres thật")
class PlacementTestServiceDbTest extends AbstractPostgresIntegrationTest {

    @Autowired private PlacementTestService placementTestService;
    @Autowired private UserRepository userRepository;
    @Autowired private JdbcTemplate jdbc;

    @Test
    @DisplayName("tạo bài A1 rồi nộp (kể cả bỏ trống hết) → có kết quả, session ghi submitted_at, không 400")
    @SuppressWarnings("unchecked")
    void createThenSubmitRoundTrip() {
        User learner = userRepository.save(User.builder()
                .email("placement-" + UUID.randomUUID() + "@test.local")
                .passwordHash("x")
                .displayName("Placement Tester")
                .role(User.Role.STUDENT)
                .build());

        Map<String, Object> created = placementTestService.createTest(learner.getId(), "A1");
        String testId = (String) created.get("testId");
        List<Map<String, Object>> questions = (List<Map<String, Object>>) created.get("questions");
        assertThat(testId).isNotBlank();
        assertThat(questions).hasSize(10);

        // Nộp mà không trả lời câu nào — đường "Nộp luôn" của hộp xác nhận trên mobile.
        Map<String, Object> result = placementTestService.submitTest(learner.getId(), testId, Map.of());

        assertThat(result).containsKeys("passed", "scorePercent", "correctCount", "totalQuestions");
        assertThat(result.get("passed")).isEqualTo(false);
        assertThat(((Number) result.get("totalQuestions")).intValue()).isEqualTo(10);
        assertThat(((Number) result.get("correctCount")).intValue()).isZero();

        Integer submitted = jdbc.queryForObject(
                "SELECT count(*) FROM placement_test_sessions WHERE id = ?::uuid AND submitted_at IS NOT NULL",
                Integer.class, testId);
        assertThat(submitted).isEqualTo(1);
    }
}
