package com.deutschflow.vocabulary;

import com.deutschflow.vocabulary.service.OfficialCefrVocabularyImportService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class OfficialCefrVocabularyImportServiceTest {

    @Autowired
    private OfficialCefrVocabularyImportService officialCefrVocabularyImportService;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Test
    void importFromClasspathSample_insertsWords() throws Exception {
        Map<String, Object> result = officialCefrVocabularyImportService.importFromClasspathSample();

        assertThat(result.get("source")).isEqualTo("classpath:wordlists/cefr_import_sample.csv");
        assertThat(result.get("imported")).isEqualTo(4);

        Integer count = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM words", Integer.class);
        assertThat(count).isEqualTo(4);

        Integer tagged = jdbcTemplate.queryForObject(
                """
                SELECT COUNT(DISTINCT w.id) FROM words w
                INNER JOIN word_tags wt ON wt.word_id = w.id
                INNER JOIN tags t ON t.id = wt.tag_id AND t.name = 'CEFR_CURATED'
                """,
                Integer.class
        );
        assertThat(tagged).isEqualTo(4);
    }
}
