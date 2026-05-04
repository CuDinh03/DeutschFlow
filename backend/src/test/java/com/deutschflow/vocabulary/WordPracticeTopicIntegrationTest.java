package com.deutschflow.vocabulary;

import com.deutschflow.common.security.JwtService;
import com.deutschflow.testsupport.AbstractPostgresIntegrationTest;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.jdbc.Sql;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

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
@Transactional
@Sql(scripts = "/word-practice-test-seed.sql", executionPhase = Sql.ExecutionPhase.BEFORE_TEST_METHOD)
class WordPracticeTopicIntegrationTest extends AbstractPostgresIntegrationTest {

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
        // Chỉ khẳng định các từ synthetic trong @Sql — không phụ thuộc seed Flyway (GENERAL/Bildung có thể có trong DB thật).
        assertThat(jdbcTemplate.queryForObject(
                """
                SELECT COUNT(*) FROM word_tags wt
                JOIN words w ON w.id = wt.word_id
                JOIN tags t ON t.id = wt.tag_id
                WHERE t.name = 'BUSINESS' AND w.base_form = '__vp_audit_business__'
                """,
                Long.class)).isEqualTo(1L);
        assertThat(jdbcTemplate.queryForObject(
                """
                SELECT COUNT(*) FROM word_tags wt
                JOIN words w ON w.id = wt.word_id
                JOIN tags t ON t.id = wt.tag_id
                WHERE t.name = 'Beruf' AND w.base_form = '__vp_audit_beruf__'
                """,
                Long.class)).isEqualTo(1L);
        assertThat(jdbcTemplate.queryForObject(
                """
                SELECT COUNT(*) FROM word_tags wt
                JOIN words w ON w.id = wt.word_id
                JOIN tags t ON t.id = wt.tag_id
                WHERE t.name = 'Bildung' AND w.base_form LIKE '__vp_audit%'
                """,
                Long.class)).isEqualTo(0L);
        assertThat(jdbcTemplate.queryForObject(
                """
                SELECT COUNT(*) FROM word_tags wt
                JOIN words w ON w.id = wt.word_id
                JOIN tags t ON t.id = wt.tag_id
                WHERE t.name = 'GENERAL' AND w.base_form IN ('__vp_audit_business__', '__vp_audit_beruf__')
                """,
                Long.class)).isEqualTo(0L);
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
