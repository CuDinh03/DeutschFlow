package com.deutschflow.vocabulary;

import com.deutschflow.testsupport.AbstractPostgresIntegrationTest;
import com.deutschflow.vocabulary.service.OfficialCefrVocabularyImportService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@Transactional
class OfficialCefrVocabularyImportServiceTest extends AbstractPostgresIntegrationTest {

    @Autowired
    private OfficialCefrVocabularyImportService officialCefrVocabularyImportService;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Test
    void importFromClasspathSample_insertsWords() throws Exception {
        Map<String, Object> result = officialCefrVocabularyImportService.importFromClasspathSample();

        assertThat(result.get("source")).isEqualTo("classpath:wordlists/cefr_import_sample.csv");
        assertThat(result.get("imported")).isEqualTo(4);

        Integer sampleCurated = jdbcTemplate.queryForObject(
                """
                SELECT COUNT(DISTINCT w.id) FROM words w
                INNER JOIN word_tags wt ON wt.word_id = w.id
                INNER JOIN tags t ON t.id = wt.tag_id AND t.name = 'CEFR_CURATED'
                WHERE LOWER(TRIM(w.base_form)) IN ('haus', 'gehen', 'buch', 'verstehen')
                """,
                Integer.class);
        assertThat(sampleCurated).isEqualTo(4);
    }
}
