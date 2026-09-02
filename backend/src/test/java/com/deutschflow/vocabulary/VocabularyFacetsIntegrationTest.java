package com.deutschflow.vocabulary;

import com.deutschflow.testsupport.AbstractPostgresIntegrationTest;
import com.deutschflow.vocabulary.dto.WordFacetsResponse;
import com.deutschflow.vocabulary.dto.WordTopicFacet;
import com.deutschflow.vocabulary.service.WordQueryService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Bộ đếm facet của hub Từ vựng trên PostgreSQL thật.
 *
 * <p>Bất biến quan trọng nhất ở đây: <b>đếm cho trục nào thì bỏ chính bộ lọc của trục đó ra khỏi WHERE.</b>
 * Nếu giữ lại, mọi chip không được chọn sẽ hiện 0 và người học không còn đường đổi lựa chọn — đúng cái bẫy
 * mà nguyên tắc "chip không bao giờ dẫn tới danh sách rỗng" của kế hoạch 02/09/2026 muốn chặn.
 *
 * <p>Mọi phép đếm đều thu hẹp bằng {@code q=fzz} để không phụ thuộc dữ liệu seed của migration.
 */
@SpringBootTest
class VocabularyFacetsIntegrationTest extends AbstractPostgresIntegrationTest {

    private static final String TOKEN = "fzz";
    private static final String TOPIC = "Reise";

    private static final String NOUN_DER = "Fzznounder";
    private static final String NOUN_DIE = "Fzznoundie";
    private static final String NOUN_DAS = "Fzznoundas";
    private static final String VERB = "Fzzverb";
    private static final String ADJ = "Fzzadjektiv";
    /** Danh từ do migration cũ seed — cột dtype của chúng viết HOA ('NOUN'), không phải 'Noun'. */
    private static final String LEGACY_NOUN = "Fzzlegacynomen";
    /** Nhãn ngoài bốn nhóm hợp lệ (PRONOUN/NUMBER/PHRASE/INTERJECTION cũng có thật trong kho). */
    private static final String LEGACY_PHRASE = "Fzzphrase";
    /** Danh từ KHÔNG có dòng trong bảng nouns — bộ lọc dtype=Noun vốn đã loại chúng ra. */
    private static final String NOUN_NO_GENDER = "Fzznounohnegenus";
    private static final List<String> FIXTURES =
            List.of(NOUN_DER, NOUN_DIE, NOUN_DAS, VERB, ADJ, LEGACY_NOUN, LEGACY_PHRASE, NOUN_NO_GENDER);

    @Autowired JdbcTemplate jdbcTemplate;
    @Autowired WordQueryService wordQueryService;

    private long userId;

    @BeforeEach
    void seed() {
        userId = jdbcTemplate.queryForObject("SELECT MIN(id) FROM users", Long.class);

        for (String lemma : FIXTURES) {
            jdbcTemplate.update("DELETE FROM vocab_review_schedule WHERE vocab_id IN"
                    + " (SELECT 'word_' || id FROM words WHERE base_form = ?)", lemma);
            jdbcTemplate.update("DELETE FROM word_tags WHERE word_id IN (SELECT id FROM words WHERE base_form = ?)", lemma);
            jdbcTemplate.update("DELETE FROM nouns WHERE id IN (SELECT id FROM words WHERE base_form = ?)", lemma);
            jdbcTemplate.update("DELETE FROM words WHERE base_form = ?", lemma);
        }

        long derId = insertWord(NOUN_DER, "Noun", "A1");
        long dieId = insertWord(NOUN_DIE, "Noun", "A2");
        long dasId = insertWord(NOUN_DAS, "Noun", null);
        long verbId = insertWord(VERB, "Verb", "A1");
        insertWord(ADJ, "Adjective", "B1");
        long legacyNounId = insertWord(LEGACY_NOUN, "NOUN", "A1");
        insertWord(LEGACY_PHRASE, "PHRASE", "B1");
        insertNoun(legacyNounId, "DER");
        insertWord(NOUN_NO_GENDER, "Noun", "A2");

        insertNoun(derId, "DER");
        insertNoun(dieId, "DIE");
        insertNoun(dasId, "DAS");

        tagAsTopic(derId);
        tagAsTopic(verbId);

        // Một thẻ đang học (interval < 21) và một thẻ đã thuộc (>= 21) — hai nhánh của SRS_STATUS_EXPR.
        scheduleFor(dieId, 5);
        scheduleFor(dasId, 30);
    }

    private long insertWord(String lemma, String dtype, String cefr) {
        jdbcTemplate.update(
                "INSERT INTO words (dtype, base_form, cefr_level, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW())",
                dtype, lemma, cefr);
        return jdbcTemplate.queryForObject("SELECT id FROM words WHERE base_form = ?", Long.class, lemma);
    }

    private void insertNoun(long wordId, String gender) {
        jdbcTemplate.update("INSERT INTO nouns (id, gender, noun_type) VALUES (?, ?, 'STARK')", wordId, gender);
    }

    private void tagAsTopic(long wordId) {
        Long tagId = jdbcTemplate.queryForObject("SELECT id FROM tags WHERE name = ?", Long.class, TOPIC);
        jdbcTemplate.update("INSERT INTO word_tags (word_id, tag_id) VALUES (?, ?)", wordId, tagId);
    }

    private void scheduleFor(long wordId, int intervalDays) {
        jdbcTemplate.update("""
                INSERT INTO vocab_review_schedule
                  (user_id, vocab_id, german, meaning, ease_factor, interval_days, repetitions,
                   next_review_at, created_at, algorithm_version, fsrs_state)
                VALUES (?, 'word_' || ?, 'x', 'x', 2.5, ?, 1, NOW(), NOW(), 'FSRS_4_5', 1)
                """, userId, wordId, intervalDays);
    }

    /**
     * Trục cấp độ được đếm theo TỪNG CẤP, nên phải gọi ở chế độ {@code exact} thì con số mới khớp — hub /v2
     * gửi {@code exact=true} vì thế. Chế độ cộng dồn (mặc định của API, giữ cho mobile và web v1) trả về
     * A1+A2 khi hỏi A2, không phải thứ mà chip cấp độ hứa.
     */
    private WordFacetsResponse facets(String cefr, String dtype, String gender, String status, String tag) {
        return wordQueryService.facets(userId, cefr, true, TOKEN, null, null, tag, dtype, gender, status, "vi");
    }

    @Test
    @DisplayName("cấp độ ở chế độ cộng dồn KHÔNG khớp chip — chip là từng cấp, hub phải gửi exact=true")
    void cumulativeModeDiffersFromPerLevelChip() {
        long cumulativeA2 = wordQueryService
                .facets(userId, "A2", false, TOKEN, null, null, null, null, null, null, "vi").total();
        long exactA2 = wordQueryService
                .facets(userId, "A2", true, TOKEN, null, null, null, null, null, null, "vi").total();

        assertThat(exactA2).as("đúng một cấp A2").isEqualTo(2);
        assertThat(cumulativeA2).as("cộng dồn A1+A2").isGreaterThan(exactA2);
    }

    @Test
    @DisplayName("tổng và trục cấp độ đếm đúng, kể cả nhóm chưa phân cấp")
    void cefrAxisCountsIncludeUngraded() {
        WordFacetsResponse f = facets(null, null, null, null, null);

        assertThat(f.total()).isEqualTo(8);
        assertThat(f.cefr()).containsEntry("A1", 3L).containsEntry("A2", 2L).containsEntry("B1", 2L)
                .containsEntry("UNGRADED", 1L).containsEntry("B2", 0L).containsEntry("C1", 0L);
    }

    @Test
    @DisplayName("trục từ loại và trục mạo từ đếm đúng")
    void dtypeAndGenderAxesCount() {
        WordFacetsResponse f = facets(null, null, null, null, null);

        assertThat(f.dtype())
                .as("'NOUN' viết hoa của migration cũ phải nằm chung nhóm 'Noun'; danh từ chưa gán giống"
                        + " cũng thuộc nhóm này từ khi ràng buộc mạo từ chuyển sang /words/deck (đợt 4)")
                .containsEntry("Noun", 5L).containsEntry("Verb", 1L).containsEntry("Adjective", 1L)
                .as("nhãn ngoài danh mục phải rơi vào nhóm 'Word', không được biến mất")
                .containsEntry("Word", 1L);
        assertThat(f.gender()).containsEntry("DER", 2L).containsEntry("DIE", 1L).containsEntry("DAS", 1L);
    }

    @Test
    @DisplayName("trục trạng thái đếm theo lịch SRS của chính người dùng")
    void statusAxisIsPerUser() {
        WordFacetsResponse f = facets(null, null, null, null, null);

        assertThat(f.status()).containsEntry("NEW", 6L).containsEntry("LEARNING", 1L).containsEntry("MASTERED", 1L);
    }

    /**
     * Hợp đồng của một con số trên chip: "chọn chip này thì còn bao nhiêu từ". Cách duy nhất kiểm được là
     * bấm thử từng chip rồi so tổng — 02/09/2026 chip "Danh từ" từng ghi 151 mà bấm vào chỉ ra 60 từ, vì bộ
     * lọc dtype=Noun còn kèm ràng buộc "phải có mạo từ" mà bộ đếm không tính.
     */
    @Test
    @DisplayName("số trên MỌI chip bằng đúng số từ nhận được khi chọn chip đó")
    void everyFacetCountMatchesWhatSelectingItReturns() {
        WordFacetsResponse base = facets(null, null, null, null, null);

        base.status().forEach((key, count) -> assertThat(facets(null, null, null, key, null).total())
                .as("chip trạng thái %s ghi %d", key, count).isEqualTo(count));
        base.dtype().forEach((key, count) -> assertThat(facets(null, key, null, null, null).total())
                .as("chip từ loại %s ghi %d", key, count).isEqualTo(count));
        base.cefr().forEach((key, count) -> assertThat(facets(key, null, null, null, null).total())
                .as("chip cấp độ %s ghi %d", key, count).isEqualTo(count));
        base.topics().forEach(topic -> assertThat(facets(null, null, null, null, topic.name()).total())
                .as("chip chủ đề %s ghi %d", topic.name(), topic.count()).isEqualTo(topic.count()));

        WordFacetsResponse nouns = facets(null, "Noun", null, null, null);
        nouns.gender().forEach((key, count) -> assertThat(facets(null, "Noun", key, null, null).total())
                .as("chip mạo từ %s ghi %d", key, count).isEqualTo(count));
    }

    @Test
    @DisplayName("lọc dtype=Noun bắt CẢ danh từ nhãn hoa của migration cũ")
    void dtypeFilterIsCaseInsensitive() {
        WordFacetsResponse nouns = facets(null, "Noun", null, null, null);
        assertThat(nouns.total())
                .as("3 danh từ có giống + 1 nhãn 'NOUN' + 1 danh từ chưa gán giống")
                .isEqualTo(5);

        WordFacetsResponse others = facets(null, "Word", null, null, null);
        assertThat(others.total()).as("nhãn PHRASE phải lọc được qua nhóm 'Word'").isEqualTo(1);
    }

    @Test
    @DisplayName("ĐANG lọc theo trục nào thì trục đó vẫn đếm đủ mọi lựa chọn — không chip nào về 0 oan")
    void axisBeingCountedIgnoresItsOwnFilter() {
        WordFacetsResponse f = facets(null, "Noun", null, null, null);

        assertThat(f.total()).as("tổng phải phản ánh bộ lọc đang bật").isEqualTo(5);
        assertThat(f.dtype())
                .as("chip 'Động từ' vẫn phải cho biết chọn nó thì còn 1 từ")
                .containsEntry("Noun", 5L).containsEntry("Verb", 1L).containsEntry("Adjective", 1L);
    }

    @Test
    @DisplayName("mạo từ là facet CON của từ loại — đếm từ loại thì bỏ luôn bộ lọc mạo từ")
    void countingDtypeAlsoDropsGenderFilter() {
        WordFacetsResponse f = facets(null, "Noun", "DER", null, null);

        assertThat(f.total()).isEqualTo(2);
        assertThat(f.dtype())
                .as("đang đứng ở 'Danh từ · der' mà chip 'Động từ' về 0 là lối cụt")
                .containsEntry("Verb", 1L).containsEntry("Adjective", 1L);
        assertThat(f.gender())
                .as("trục mạo từ bỏ bộ lọc của chính nó nhưng GIỮ 'Danh từ'")
                .containsEntry("DER", 2L).containsEntry("DIE", 1L).containsEntry("DAS", 1L);
    }

    @Test
    @DisplayName("trục trạng thái cũng bỏ bộ lọc của chính nó")
    void statusAxisIgnoresItsOwnFilter() {
        WordFacetsResponse f = facets(null, null, null, "NEW", null);

        assertThat(f.total()).isEqualTo(6);
        assertThat(f.status()).containsEntry("NEW", 6L).containsEntry("LEARNING", 1L).containsEntry("MASTERED", 1L);
    }

    @Test
    @DisplayName("chủ đề chỉ trả về chủ đề THỰC SỰ có từ — chip rỗng là chip dẫn tới lối cụt")
    void topicsOnlyIncludeNonEmptyOnes() {
        WordFacetsResponse f = facets(null, null, null, null, null);

        Map<String, Long> byName = f.topics().stream()
                .collect(java.util.stream.Collectors.toMap(WordTopicFacet::name, WordTopicFacet::count));
        assertThat(byName).containsEntry(TOPIC, 2L);
        assertThat(f.topics()).allSatisfy(t -> assertThat(t.count()).isPositive());
        assertThat(f.topics()).allSatisfy(t -> assertThat(t.label()).isNotBlank());
    }

    @Test
    @DisplayName("lọc theo chủ đề: tổng thu hẹp nhưng trục chủ đề vẫn đếm đủ")
    void tagAxisIgnoresItsOwnFilter() {
        WordFacetsResponse f = facets(null, null, null, null, TOPIC);

        assertThat(f.total()).isEqualTo(2);
        assertThat(f.topics()).anySatisfy(t -> {
            assertThat(t.name()).isEqualTo(TOPIC);
            assertThat(t.count()).isEqualTo(2L);
        });
    }
}
