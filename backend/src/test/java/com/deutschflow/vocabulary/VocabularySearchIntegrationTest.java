package com.deutschflow.vocabulary;

import com.deutschflow.testsupport.AbstractPostgresIntegrationTest;
import com.deutschflow.vocabulary.dto.WordListResponse;
import com.deutschflow.vocabulary.service.WordQueryService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Ô tìm của hub Từ vựng chạy trên PostgreSQL thật.
 *
 * <p>Ba bất biến khoá lại lỗi soát ngày 02/09/2026 (xem {@code plans/2026-09-02-thiet-ke-lai-hub-tu-vung.md}):
 * <ol>
 *   <li>{@code LIKE} của Postgres phân biệt hoa/thường ⇒ gõ {@code haus} không ra {@code Haus};</li>
 *   <li>câu lọc chỉ chạm {@code base_form} nên tra nghĩa tiếng Việt luôn rỗng, dù ô tìm ghi "Tìm từ / nghĩa…";</li>
 *   <li>{@code %} và {@code _} người dùng gõ vào bị hiểu là ký tự đại diện ⇒ một dấu {@code %} trả về cả kho.</li>
 * </ol>
 *
 * <p>Cả ba nằm trong câu SQL nên unit test mock {@code JdbcTemplate} không chạm tới được — phải là IT.
 */
@SpringBootTest
class VocabularySearchIntegrationTest extends AbstractPostgresIntegrationTest {

    /** Token vô nghĩa để fixture không đụng dữ liệu seed của migration. */
    private static final String TOKEN = "zqx";

    private static final String EXACT = "Zqx";
    private static final String PREFIX_A = "Zqxdach";
    private static final String PREFIX_B = "Zqxhaus";
    private static final String INFIX = "Grosszqxbau";
    private static final String VIA_MEANING_VI = "Yyybedeutung";
    private static final String VIA_MEANING_EN = "Yyymeaning";
    private static final String WILDCARD_BAIT = "Zqxprozent";

    private static final List<String> FIXTURES = List.of(
            EXACT, PREFIX_A, PREFIX_B, INFIX, VIA_MEANING_VI, VIA_MEANING_EN, WILDCARD_BAIT);

    @Autowired JdbcTemplate jdbcTemplate;
    @Autowired WordQueryService wordQueryService;

    @BeforeEach
    void seed() {
        for (String lemma : FIXTURES) {
            jdbcTemplate.update(
                    "DELETE FROM word_translations WHERE word_id IN (SELECT id FROM words WHERE base_form = ?)", lemma);
            jdbcTemplate.update(
                    "DELETE FROM word_tags WHERE word_id IN (SELECT id FROM words WHERE base_form = ?)", lemma);
            jdbcTemplate.update("DELETE FROM words WHERE base_form = ?", lemma);
        }
        insert(EXACT, null, null);
        insert(PREFIX_A, "mái nhà zqx", null);
        insert(PREFIX_B, "ngôi nhà zqx", null);
        insert(INFIX, "toà nhà lớn", null);
        // Lemma KHÔNG chứa token — chỉ nghĩa tiếng Việt chứa.
        insert(VIA_MEANING_VI, "cái zqx trong tiếng Việt", null);
        // Lemma và nghĩa tiếng Việt đều không chứa token — chỉ nghĩa tiếng Anh chứa.
        insert(VIA_MEANING_EN, "một thứ khác hẳn", "a zqx thing");
        insert(WILDCARD_BAIT, "mồi bắt ký tự đại diện", null);
    }

    private void insert(String lemma, String meaningVi, String meaningEn) {
        jdbcTemplate.update(
                "INSERT INTO words (dtype, base_form, cefr_level, created_at, updated_at)"
                        + " VALUES ('Word', ?, 'A1', NOW(), NOW())",
                lemma);
        Long id = jdbcTemplate.queryForObject(
                "SELECT id FROM words WHERE base_form = ?", Long.class, lemma);
        if (meaningVi != null) {
            jdbcTemplate.update(
                    "INSERT INTO word_translations (word_id, locale, meaning) VALUES (?, 'vi', ?)", id, meaningVi);
        }
        if (meaningEn != null) {
            jdbcTemplate.update(
                    "INSERT INTO word_translations (word_id, locale, meaning) VALUES (?, 'en', ?)", id, meaningEn);
        }
    }

    private WordListResponse search(String q) {
        return wordQueryService.listWords(
                null, null, false, q, null, null, null, null, null, null, "vi", 0, 100);
    }

    private List<String> lemmasOf(String q) {
        return search(q).items().stream().map(i -> i.baseForm()).toList();
    }

    @Test
    @DisplayName("tìm không phân biệt hoa/thường — gõ 'zqx' phải ra lemma viết hoa 'Zqx'")
    void searchIsCaseInsensitive() {
        assertThat(lemmasOf(TOKEN)).contains(EXACT, PREFIX_A, PREFIX_B);
        assertThat(lemmasOf("ZQX")).contains(EXACT, PREFIX_A, PREFIX_B);
    }

    @Test
    @DisplayName("tìm được cả nghĩa — đúng như ô tìm đang hứa 'Tìm từ / nghĩa…'")
    void searchMatchesMeaningInCurrentLocale() {
        assertThat(lemmasOf(TOKEN)).contains(VIA_MEANING_VI);
    }

    @Test
    @DisplayName("nghĩa tiếng Anh là nguồn dự phòng khi locale chưa có bản dịch")
    void searchFallsBackToEnglishMeaning() {
        assertThat(lemmasOf(TOKEN)).contains(VIA_MEANING_EN);
    }

    @Test
    @DisplayName("vẫn khớp giữa từ — từ ghép tiếng Đức phụ thuộc vào điều này")
    void searchStillMatchesCompoundInfix() {
        assertThat(lemmasOf(TOKEN)).contains(INFIX);
    }

    @Test
    @DisplayName("xếp hạng: khớp tuyệt đối → đầu từ → giữa từ → chỉ khớp nghĩa")
    void resultsAreRankedByMatchQuality() {
        // containsSubsequence khẳng định CẢ sự có mặt lẫn thứ tự tương đối — indexOf sẽ trả -1 cho từ
        // vắng mặt và làm phép so sánh "nhỏ hơn" vô tình xanh.
        assertThat(lemmasOf(TOKEN))
                .as("khớp tuyệt đối → đầu từ (alphabet) → giữa từ → chỉ khớp nghĩa")
                .containsSubsequence(EXACT, PREFIX_A, PREFIX_B, INFIX, VIA_MEANING_VI);
    }

    @Test
    @DisplayName("'%' người dùng gõ là ký tự thường, không phải ký tự đại diện")
    void percentSignIsTreatedAsLiteral() {
        WordListResponse res = search("%");
        assertThat(res.total()).as("một dấu %% không được trả về cả kho").isZero();
        assertThat(res.items()).isEmpty();
    }

    @Test
    @DisplayName("'_' người dùng gõ là ký tự thường, không khớp mọi ký tự đơn")
    void underscoreIsTreatedAsLiteral() {
        assertThat(search("Zqx_ach").total()).as("'_' không được khớp chữ 'd' trong Zqxdach").isZero();
    }

    @Test
    @DisplayName("total của bộ đếm khớp số dòng thực trả về — count và page dùng chung điều kiện")
    void totalMatchesReturnedRows() {
        WordListResponse res = search(TOKEN);
        assertThat(res.total()).isEqualTo(res.items().size());
    }
}
