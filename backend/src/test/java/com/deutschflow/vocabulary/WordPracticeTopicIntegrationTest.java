package com.deutschflow.vocabulary;

import com.deutschflow.common.security.JwtService;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.jdbc.Sql;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Runtime checks for vocab practice topic flow: /api/words auth + pagination contract,
 * and DB coverage for canonical tags referenced in SRS/migrations (BUSINESS, Beruf, Bildung vs GENERAL).
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
@Sql(scripts = "/word-practice-test-seed.sql", executionPhase = Sql.ExecutionPhase.BEFORE_TEST_METHOD)
class WordPracticeTopicIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private JwtService jwtService;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Test
    void words_requiresAuth() throws Exception {
        // Anonymous users get Forbidden (JWT filter rejects without token in this setup).
        mockMvc.perform(get("/api/words"))
                .andExpect(status().isForbidden());
    }

    @Test
    void words_withStudentJwt_returnsPagedShape_includingTotal() throws Exception {
        User u = userRepository.save(User.builder()
                .email("vocab-topic-api@test.com")
                .passwordHash("$2a$10$xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx")
                .displayName("Vocab Topic")
                .role(User.Role.STUDENT)
                .build());
        userRepository.flush();

        mockMvc.perform(get("/api/words")
                        .param("cefr", "A1")
                        .param("locale", "vi")
                        .param("page", "0")
                        .param("size", "10")
                        .header("Authorization", "Bearer " + jwtService.generateAccessToken(u)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items").isArray())
                .andExpect(jsonPath("$.page").value(0))
                .andExpect(jsonPath("$.size").exists())
                .andExpect(jsonPath("$.total").exists());
    }

    @Test
    void words_filteredByBusinessTag_returns_okAndTotal_whenTagExists() throws Exception {
        User u = student("vocab-business@test.com");

        mockMvc.perform(get("/api/words")
                        .param("cefr", "A1")
                        .param("tag", "BUSINESS")
                        .param("locale", "vi")
                        .param("page", "0")
                        .param("size", "30")
                        .header("Authorization", "Bearer " + jwtService.generateAccessToken(u)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.total").exists())
                .andExpect(jsonPath("$.items").isArray());
    }

    @Test
    void tagLinkedWord_counts_documentBerufVsBusinessVsGeneral() {
        List<Map<String, Object>> rows = jdbcTemplate.queryForList("""
                SELECT tg.name AS tagName, COUNT(DISTINCT wt.word_id) AS cnt
                FROM tags tg
                LEFT JOIN word_tags wt ON wt.tag_id = tg.id
                WHERE tg.name IN ('BUSINESS', 'Beruf', 'Bildung', 'GENERAL')
                GROUP BY tg.name
                ORDER BY tg.name
                """);

        Map<String, Long> counts = rows.stream().collect(Collectors.toMap(
                r -> String.valueOf(r.get("tagName")),
                r -> ((Number) r.get("cnt")).longValue()));

        assertThat(counts.containsKey("BUSINESS")).isTrue();
        assertThat(counts.get("BUSINESS")).isGreaterThanOrEqualTo(1L);
        assertThat(counts.getOrDefault("Beruf", 0L)).isGreaterThanOrEqualTo(1L);
        assertThat(counts.getOrDefault("Bildung", 0L)).isEqualTo(0L); // taxonomy-only unless linked
        assertThat(counts.getOrDefault("GENERAL", 0L)).isEqualTo(0L);
    }

    private User student(String email) {
        User saved = userRepository.save(User.builder()
                .email(email)
                .passwordHash("$2a$10$xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx")
                .displayName("Student")
                .role(User.Role.STUDENT)
                .build());
        userRepository.flush();
        return saved;
    }
}
