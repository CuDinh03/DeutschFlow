package com.deutschflow.vocabulary;

import com.deutschflow.vocabulary.dto.GlosbeLexicalEntry;
import com.deutschflow.vocabulary.service.GlosbeHtmlParser;
import com.deutschflow.vocabulary.service.GlosbeVocabularyImportService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.test.util.ReflectionTestUtils;

import javax.sql.DataSource;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

class GlosbeVocabularyImportServiceTest {

    private JdbcTemplate jdbcTemplate;

    @BeforeEach
    void setUpSchema() {
        DataSource ds = new DriverManagerDataSource("jdbc:h2:mem:glosbe_test;MODE=MySQL;DB_CLOSE_DELAY=-1", "sa", "");
        jdbcTemplate = new JdbcTemplate(ds);
        jdbcTemplate.execute("CREATE TABLE words (id BIGINT AUTO_INCREMENT PRIMARY KEY, dtype VARCHAR(20), base_form VARCHAR(120), cefr_level VARCHAR(4), phonetic VARCHAR(120), usage_note TEXT, created_at TIMESTAMP, updated_at TIMESTAMP)");
        jdbcTemplate.execute("CREATE TABLE word_translations (id BIGINT AUTO_INCREMENT PRIMARY KEY, word_id BIGINT, locale VARCHAR(5), meaning TEXT, example TEXT, UNIQUE(word_id, locale))");
        jdbcTemplate.execute("CREATE TABLE nouns (id BIGINT PRIMARY KEY, gender VARCHAR(6), plural_form VARCHAR(120), genitive_form VARCHAR(120), noun_type VARCHAR(20))");
        jdbcTemplate.execute("CREATE TABLE noun_declension_forms (id BIGINT AUTO_INCREMENT PRIMARY KEY, noun_id BIGINT, kasus VARCHAR(20), numerus VARCHAR(20), form VARCHAR(120), UNIQUE(noun_id, kasus, numerus))");
        jdbcTemplate.execute("CREATE TABLE verbs (id BIGINT PRIMARY KEY, auxiliary_verb VARCHAR(20), partizip2 VARCHAR(120), is_separable BOOLEAN, prefix VARCHAR(20), is_irregular BOOLEAN)");
        jdbcTemplate.execute("CREATE TABLE verb_conjugations (id BIGINT AUTO_INCREMENT PRIMARY KEY, verb_id BIGINT, tense VARCHAR(20), pronoun VARCHAR(20), form VARCHAR(120), UNIQUE(verb_id, tense, pronoun))");
        jdbcTemplate.execute("CREATE TABLE tags (id BIGINT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(120) UNIQUE, color VARCHAR(10))");
        jdbcTemplate.execute("CREATE TABLE word_tags (word_id BIGINT, tag_id BIGINT, PRIMARY KEY(word_id, tag_id))");
        jdbcTemplate.execute("CREATE TABLE vocabulary_import_state (id BIGINT AUTO_INCREMENT PRIMARY KEY, source_name VARCHAR(64), state_key VARCHAR(120), state_value TEXT, updated_at TIMESTAMP, UNIQUE(source_name, state_key))");
        jdbcTemplate.execute("CREATE TABLE vocabulary_import_errors (id BIGINT AUTO_INCREMENT PRIMARY KEY, source_name VARCHAR(64), source_url VARCHAR(600), base_form VARCHAR(120), error_type VARCHAR(80), error_message VARCHAR(500), payload_json TEXT, created_at TIMESTAMP)");
    }

    @Test
    void importFromGlosbe_shouldSkipProcessedLinksOnResume() throws Exception {
        GlosbeHtmlParser parser = Mockito.mock(GlosbeHtmlParser.class);
        TestableGlosbeService service = new TestableGlosbeService(jdbcTemplate, parser, new ObjectMapper());
        ReflectionTestUtils.setField(service, "startUrl", "https://vi.glosbe.com/de/vi");

        String wordUrl = "https://vi.glosbe.com/de/vi/lernen";
        Document listing = Jsoup.parse("<html></html>", "https://vi.glosbe.com/de/vi");
        Document detail = Jsoup.parse("<html></html>", wordUrl);
        service.addDocument("https://vi.glosbe.com/de/vi", listing);
        service.addDocument(wordUrl, detail);

        when(parser.parseWordLinks(any(Document.class), eq("https://vi.glosbe.com"))).thenReturn(Set.of(wordUrl));
        when(parser.parseNextPageLink(any(Document.class))).thenReturn(null);
        when(parser.parseDetail(any(Document.class), eq(wordUrl))).thenReturn(new GlosbeLexicalEntry(
                "lernen",
                "Verb",
                "A1",
                "/ˈlɛʁnən/",
                "Dong tu hoc.",
                "học",
                "lernen",
                "Wir lernen Deutsch.",
                "Chúng tôi học tiếng Đức.",
                null,
                null,
                null,
                null,
                List.of(),
                "HABEN",
                "gelernt",
                false,
                null,
                false,
                List.of(),
                List.of("noun_gender"),
                wordUrl
        ));

        Map<String, Object> first = service.importFromGlosbe(1, 10);
        Map<String, Object> second = service.importFromGlosbe(1, 10);

        assertThat(first.get("processedWords")).isEqualTo(1);
        assertThat(first.get("inserted")).isEqualTo(1);
        assertThat(second.get("processedWords")).isEqualTo(0);
        assertThat(second.get("inserted")).isEqualTo(0);
    }

    private static class TestableGlosbeService extends GlosbeVocabularyImportService {
        private final Map<String, Document> docs = new java.util.HashMap<>();

        TestableGlosbeService(JdbcTemplate jdbcTemplate, GlosbeHtmlParser parser, ObjectMapper objectMapper) {
            super(jdbcTemplate, parser, objectMapper);
        }

        void addDocument(String url, Document document) {
            docs.put(url, document);
        }

        @Override
        protected Document fetchDocument(String url) {
            Document doc = docs.get(url);
            if (doc == null) {
                throw new IllegalStateException("Missing test document for URL " + url);
            }
            return doc;
        }
    }
}
