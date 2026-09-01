package com.deutschflow.vocabulary;

import com.deutschflow.testsupport.AbstractPostgresIntegrationTest;
import com.deutschflow.vocabulary.dto.WordListItem;
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
 * Cách bốc từ cho ba bài luyện, trên PostgreSQL thật.
 *
 * <p>Trước 02/09/2026 cả swipe lẫn quiz mạo từ đều gọi {@code /words?page=0&size=20} rồi trộn TRONG đúng 20
 * thẻ đó. Server sắp theo cấp rồi alphabet nên trang 0 là bất biến ⇒ học bao nhiêu lượt cũng chừng ấy từ, và
 * luôn bắt đầu từ chữ A. Bộ bài phải trả lời theo thứ tự sư phạm: <b>đến hạn ôn trước → từ chưa học theo dải
 * tần suất → phần còn lại</b>, và đổi bộ theo ngày để hai lượt trong cùng ngày vẫn ổn định.
 */
@SpringBootTest
class VocabularyDeckIntegrationTest extends AbstractPostgresIntegrationTest {

    private static final String TOPIC_TAG = "Dzz_deck_it";

    @Autowired JdbcTemplate jdbcTemplate;
    @Autowired WordQueryService wordQueryService;

    private long userId;
    private long tagId;

    @BeforeEach
    void seed() {
        userId = jdbcTemplate.queryForObject("SELECT MIN(id) FROM users", Long.class);

        jdbcTemplate.update("DELETE FROM vocab_review_schedule WHERE vocab_id IN"
                + " (SELECT 'word_' || id FROM words WHERE base_form LIKE 'Dzz%')");
        jdbcTemplate.update("DELETE FROM word_tags WHERE word_id IN (SELECT id FROM words WHERE base_form LIKE 'Dzz%')");
        jdbcTemplate.update("DELETE FROM nouns WHERE id IN (SELECT id FROM words WHERE base_form LIKE 'Dzz%')");
        jdbcTemplate.update("DELETE FROM words WHERE base_form LIKE 'Dzz%'");
        jdbcTemplate.update("DELETE FROM tags WHERE name = ?", TOPIC_TAG);

        jdbcTemplate.update("INSERT INTO tags (name, is_topic_taxonomy) VALUES (?, TRUE)", TOPIC_TAG);
        tagId = jdbcTemplate.queryForObject("SELECT id FROM tags WHERE name = ?", Long.class, TOPIC_TAG);
    }

    private long word(String lemma, String dtype, Integer frequencyRank) {
        jdbcTemplate.update("""
                INSERT INTO words (dtype, base_form, cefr_level, frequency_rank, created_at, updated_at)
                VALUES (?, ?, 'A1', ?, NOW(), NOW())
                """, dtype, lemma, frequencyRank);
        long id = jdbcTemplate.queryForObject("SELECT id FROM words WHERE base_form = ?", Long.class, lemma);
        jdbcTemplate.update("INSERT INTO word_tags (word_id, tag_id) VALUES (?, ?)", id, tagId);
        return id;
    }

    private void noun(long wordId, String gender) {
        jdbcTemplate.update("INSERT INTO nouns (id, gender, noun_type) VALUES (?, ?, 'STARK')", wordId, gender);
    }

    /** {@code dueDaysAgo > 0} = quá hạn, {@code < 0} = chưa tới hạn. */
    private void scheduled(long wordId, int dueDaysAgo, int intervalDays) {
        jdbcTemplate.update("""
                INSERT INTO vocab_review_schedule
                  (user_id, vocab_id, german, meaning, ease_factor, interval_days, repetitions,
                   next_review_at, created_at, algorithm_version, fsrs_state)
                VALUES (?, 'word_' || ?, 'x', 'x', 2.5, ?, 1, NOW() - MAKE_INTERVAL(days => ?), NOW(), 'FSRS_4_5', 1)
                """, userId, wordId, intervalDays, dueDaysAgo);
    }

    private List<String> deckLemmas(String mode, int size) {
        WordListResponse res = wordQueryService.deck(userId, mode, size, null, false, null, null, TOPIC_TAG, "vi");
        return res.items().stream().map(WordListItem::baseForm).toList();
    }

    @Test
    @DisplayName("từ đến hạn ôn đứng trước từ chưa học, quá hạn lâu nhất lên đầu")
    void dueWordsComeFirstMostOverdueFirst() {
        long fresh = word("Dzzneu", "Word", 1);
        long dueToday = word("Dzzheute", "Word", 2);
        long dueLongAgo = word("Dzzlangst", "Word", 3);
        scheduled(dueToday, 1, 5);
        scheduled(dueLongAgo, 30, 5);

        assertThat(deckLemmas("SWIPE", 10))
                .as("quá hạn 30 ngày → quá hạn 1 ngày → chưa học")
                .containsExactly("Dzzlangst", "Dzzheute", "Dzzneu");
        assertThat(fresh).isPositive();
    }

    @Test
    @DisplayName("thẻ CHƯA tới hạn xếp sau từ chưa học — đừng bắt ôn sớm khi còn từ mới")
    void notYetDueRanksBelowNewWords() {
        long notDue = word("Dzznochnicht", "Word", 1);
        word("Dzzunbekannt", "Word", 900);
        scheduled(notDue, -7, 30);

        assertThat(deckLemmas("SWIPE", 10)).containsExactly("Dzzunbekannt", "Dzznochnicht");
    }

    @Test
    @DisplayName("từ chưa học lấy theo DẢI tần suất — từ hay gặp vào bộ bài trước")
    void newWordsFollowFrequencyBands() {
        word("Dzzselten", "Word", 4500);
        word("Dzzhaeufig", "Word", 12);

        assertThat(deckLemmas("SWIPE", 10))
                .as("hạng 12 thuộc dải đầu, hạng 4500 thuộc dải sau")
                .containsExactly("Dzzhaeufig", "Dzzselten");
    }

    @Test
    @DisplayName("từ chưa có hạng tần suất (mặc định 10000) xuống cuối, không chiếm chỗ từ đã biết hạng")
    void unrankedWordsSinkToTheBottom() {
        word("Dzzohnerang", "Word", 10000);
        word("Dzzmitrang", "Word", 2000);

        assertThat(deckLemmas("SWIPE", 10)).containsExactly("Dzzmitrang", "Dzzohnerang");
    }

    @Test
    @DisplayName("mode=ARTICLE chỉ trả danh từ CÓ mạo từ — quiz der/die/das không hỏi được từ thiếu giống")
    void articleModeReturnsOnlyGenderedNouns() {
        long withGender = word("Dzznomen", "Noun", 5);
        word("Dzznomenohnegenus", "Noun", 6);
        word("Dzzverbum", "Verb", 7);
        noun(withGender, "DER");

        List<String> deck = deckLemmas("ARTICLE", 10);
        assertThat(deck).containsExactly("Dzznomen");
    }

    @Test
    @DisplayName("mode khác ARTICLE không ép từ loại — swipe học được cả động từ và tính từ")
    void swipeModeDoesNotConstrainWordType() {
        word("Dzznomen", "Noun", 5);
        word("Dzzverbum", "Verb", 6);
        word("Dzzadjektiv", "Adjective", 7);

        assertThat(deckLemmas("SWIPE", 10))
                .containsExactlyInAnyOrder("Dzznomen", "Dzzverbum", "Dzzadjektiv");
    }

    @Test
    @DisplayName("hai lượt trong cùng một ngày ra cùng một bộ — người học không bị xáo giữa chừng")
    void sameDayRequestsAreStable() {
        for (int i = 1; i <= 12; i++) {
            word("Dzzstabil" + String.format("%02d", i), "Word", 10000);
        }

        assertThat(deckLemmas("SWIPE", 5)).isEqualTo(deckLemmas("SWIPE", 5));
    }

    @Test
    @DisplayName("bộ bài KHÔNG còn là 20 từ đầu bảng chữ cái như trước")
    void deckIsNotAlphabetical() {
        for (int i = 1; i <= 12; i++) {
            // Hạng tần suất ngược với thứ tự alphabet: alphabet đầu = hạng tệ nhất.
            word("Dzz" + (char) ('a' + i - 1) + "wort", "Word", 5000 - i * 100);
        }

        List<String> deck = deckLemmas("SWIPE", 5);
        List<String> alphabetical = deck.stream().sorted().toList();
        assertThat(deck).as("bốc theo tần suất thì thứ tự phải khác hệt alphabet").isNotEqualTo(alphabetical);
    }

    @Test
    @DisplayName("cấp độ CỘNG DỒN như trước — chọn A2 vẫn ôn được từ A1")
    void cefrIsCumulativeByDefault() {
        long a1 = word("Dzza1wort", "Word", 1);
        jdbcTemplate.update("UPDATE words SET cefr_level = 'A1' WHERE id = ?", a1);
        long a2 = word("Dzza2wort", "Word", 2);
        jdbcTemplate.update("UPDATE words SET cefr_level = 'A2' WHERE id = ?", a2);

        assertThat(wordQueryService.deck(userId, "SWIPE", 10, "A2", false, null, null, TOPIC_TAG, "vi").items())
                .extracting(WordListItem::baseForm)
                .as("mức sàn A2 phải gồm cả A1")
                .containsExactlyInAnyOrder("Dzza1wort", "Dzza2wort");

        assertThat(wordQueryService.deck(userId, "SWIPE", 10, "A2", true, null, null, TOPIC_TAG, "vi").items())
                .extracting(WordListItem::baseForm)
                .as("exact=true thì đúng một cấp")
                .containsExactly("Dzza2wort");
    }

    @Test
    @DisplayName("size bị chặn trên để một lượt gọi không kéo cả kho")
    void sizeIsClamped() {
        for (int i = 1; i <= 5; i++) {
            word("Dzzlimit" + i, "Word", i);
        }

        assertThat(deckLemmas("SWIPE", 3)).hasSize(3);
        assertThat(wordQueryService.deck(userId, "SWIPE", 9999, null, false, null, null, TOPIC_TAG, "vi").items())
                .as("size quá lớn bị kẹp, không ném lỗi")
                .hasSizeLessThanOrEqualTo(100);
    }

    @Test
    @DisplayName("total là kích thước CẢ hồ chọn, không phải số thẻ trả về")
    void totalReportsPoolSize() {
        for (int i = 1; i <= 7; i++) {
            word("Dzzpool" + i, "Word", i);
        }

        WordListResponse res = wordQueryService.deck(userId, "SWIPE", 3, null, false, null, null, TOPIC_TAG, "vi");
        assertThat(res.items()).hasSize(3);
        assertThat(res.total()).isEqualTo(7);
    }
}
