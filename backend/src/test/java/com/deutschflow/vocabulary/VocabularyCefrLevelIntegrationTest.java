package com.deutschflow.vocabulary;

import com.deutschflow.testsupport.AbstractPostgresIntegrationTest;
import com.deutschflow.vocabulary.dto.WordLevelCountsResponse;
import com.deutschflow.vocabulary.dto.WordListResponse;
import com.deutschflow.vocabulary.service.OfficialCefrVocabularyImportService;
import com.deutschflow.vocabulary.service.WordQueryService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Bộ lọc cấp độ chạy trên PostgreSQL thật.
 *
 * <p>Chỉ IT mới chứng minh được: bộ lọc cộng dồn/đúng-cấp và {@code cefr_level IS NULL} nằm trong câu SQL,
 * unit test mock JdbcTemplate không chạm tới. Đây cũng là bất biến khoá lại lỗi 14/08/2026 — cột từng là
 * {@code NOT NULL DEFAULT 'A1'} nên "chưa phân cấp" không thể tồn tại và A1 thành thùng rác.
 */
@SpringBootTest
class VocabularyCefrLevelIntegrationTest extends AbstractPostgresIntegrationTest {

    private static final String A1 = "__cefr_it_a1__";
    private static final String A2 = "__cefr_it_a2__";
    private static final String B1 = "__cefr_it_b1__";
    private static final String UNGRADED = "__cefr_it_ungraded__";
    private static final List<String> FIXTURES = List.of(A1, A2, B1, UNGRADED);

    @Autowired JdbcTemplate jdbcTemplate;
    @Autowired WordQueryService wordQueryService;
    @Autowired OfficialCefrVocabularyImportService officialCefrVocabularyImportService;

    @BeforeEach
    void seed() {
        for (String lemma : FIXTURES) {
            jdbcTemplate.update("DELETE FROM word_tags WHERE word_id IN (SELECT id FROM words WHERE base_form = ?)", lemma);
            jdbcTemplate.update("DELETE FROM words WHERE base_form = ?", lemma);
        }
        insert(A1, "A1");
        insert(A2, "A2");
        insert(B1, "B1");
        insert(UNGRADED, null);
    }

    private void insert(String lemma, String level) {
        jdbcTemplate.update(
                "INSERT INTO words (dtype, base_form, cefr_level, created_at, updated_at) VALUES ('Word', ?, ?, NOW(), NOW())",
                lemma, level);
    }

    private List<String> lemmasOf(String cefr, boolean exact) {
        WordListResponse res = wordQueryService.listWords(
                null, cefr, exact, "__cefr_it_", null, null, null, null, null, null, "vi", 0, 100);
        return res.items().stream().map(i -> i.baseForm()).toList();
    }

    @Test
    @DisplayName("cefr_level cho phép NULL — 'chưa phân cấp' là trạng thái hợp lệ")
    void ungradedRowIsAllowed() {
        String level = jdbcTemplate.queryForObject(
                "SELECT cefr_level FROM words WHERE base_form = ?", String.class, UNGRADED);
        assertThat(level).isNull();
    }

    @Test
    @DisplayName("exact=true trả ĐÚNG một cấp — nhãn chip khớp badge trên thẻ từ")
    void exactFilterReturnsOnlyThatLevel() {
        assertThat(lemmasOf("A2", true)).containsExactly(A2);
        assertThat(lemmasOf("A1", true)).containsExactly(A1);
    }

    @Test
    @DisplayName("mặc định vẫn cộng dồn (A2 = A1+A2) — mobile và web v1 không đổi hành vi")
    void defaultFilterStaysCumulative() {
        assertThat(lemmasOf("A2", false)).containsExactlyInAnyOrder(A1, A2);
        assertThat(lemmasOf("B1", false)).containsExactlyInAnyOrder(A1, A2, B1);
    }

    @Test
    @DisplayName("cefr=UNGRADED lọc đúng nhóm chưa phân cấp")
    void ungradedBucketIsFilterable() {
        assertThat(lemmasOf("UNGRADED", false)).containsExactly(UNGRADED);
    }

    @Test
    @DisplayName("levelCounts đếm cả nhóm chưa phân cấp")
    void levelCountsIncludeUngraded() {
        WordLevelCountsResponse counts = wordQueryService.levelCounts();
        assertThat(counts.counts()).containsKeys("A1", "A2", "B1", "B2", "C1", "C2", "UNGRADED");
        assertThat(counts.counts().get("UNGRADED")).isGreaterThanOrEqualTo(1L);
        assertThat(counts.total()).isEqualTo(counts.counts().values().stream().mapToLong(Long::longValue).sum());
    }

    /**
     * {@code @Transactional} để rollback: reclassify ghi lại cefr_level của CẢ bảng, không được để lại
     * dấu vết cho IT khác dùng chung container Postgres.
     */
    @Test
    @Transactional
    @DisplayName("reclassify xoá cấp bịa và chỉ giữ cấp có trong wordlist chính thức")
    void reclassifyClearsLevelsNotBackedByWordlist() {
        // Từ vựng lõi có thật trong Wortliste A1, đang mang cấp sai do heuristic cũ.
        jdbcTemplate.update(
                "INSERT INTO words (dtype, base_form, cefr_level, created_at, updated_at)"
                        + " SELECT 'Verb', 'trinken', 'C1', NOW(), NOW()"
                        + " WHERE NOT EXISTS (SELECT 1 FROM words WHERE LOWER(base_form) = 'trinken')");
        jdbcTemplate.update("UPDATE words SET cefr_level = 'C1' WHERE LOWER(base_form) = 'trinken'");

        officialCefrVocabularyImportService.reclassifyAllWords();

        for (String lemma : FIXTURES) {
            String level = jdbcTemplate.queryForObject(
                    "SELECT cefr_level FROM words WHERE base_form = ?", String.class, lemma);
            assertThat(level).as("fixture %s không có trong wordlist Goethe nên phải về NULL", lemma).isNull();
        }
        assertThat(jdbcTemplate.queryForObject(
                "SELECT cefr_level FROM words WHERE LOWER(base_form) = 'trinken' LIMIT 1", String.class))
                .as("wordlist chính thức phải HẠ được cấp bịa C1 về A1")
                .isEqualTo("A1");
    }
}
