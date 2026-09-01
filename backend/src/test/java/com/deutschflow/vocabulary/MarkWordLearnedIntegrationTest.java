package com.deutschflow.vocabulary;

import com.deutschflow.testsupport.AbstractPostgresIntegrationTest;
import com.deutschflow.vocabulary.service.VocabularyService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * {@code POST /api/vocabulary/{wordId}/learn} — đường ghi tiến độ duy nhất của các bài luyện từ vựng.
 *
 * <p>Bất biến quan trọng: <b>lưu hỏng thì phải báo hỏng</b>. Trước 02/09/2026 đường này đi qua
 * {@code SrsVocabScheduler.schedule()} — một hàm best-effort nuốt mọi exception — nên endpoint trả 202 kể cả
 * khi không có dòng nào được ghi. Với một hành động tiến độ do người học chủ động bấm, "im lặng coi như xong"
 * là mất dữ liệu không ai biết.
 */
@SpringBootTest
class MarkWordLearnedIntegrationTest extends AbstractPostgresIntegrationTest {

    private static final String LEMMA = "Mzzlernwort";

    @Autowired JdbcTemplate jdbcTemplate;
    @Autowired VocabularyService vocabularyService;

    private long userId;
    private long wordId;

    @BeforeEach
    void seed() {
        userId = jdbcTemplate.queryForObject("SELECT MIN(id) FROM users", Long.class);
        jdbcTemplate.update("DELETE FROM vocab_review_schedule WHERE vocab_id IN"
                + " (SELECT 'word_' || id FROM words WHERE base_form = ?)", LEMMA);
        jdbcTemplate.update("DELETE FROM words WHERE base_form = ?", LEMMA);
        jdbcTemplate.update(
                "INSERT INTO words (dtype, base_form, cefr_level, created_at, updated_at)"
                        + " VALUES ('Word', ?, 'A1', NOW(), NOW())", LEMMA);
        wordId = jdbcTemplate.queryForObject("SELECT id FROM words WHERE base_form = ?", Long.class, LEMMA);
    }

    private int scheduleRows() {
        return jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM vocab_review_schedule WHERE user_id = ? AND vocab_id = ?",
                Integer.class, userId, "word_" + wordId);
    }

    @Test
    @DisplayName("đánh dấu đã học tạo đúng một dòng lịch ôn cho người học")
    void schedulesTheWordForReview() {
        vocabularyService.markWordLearned(userId, wordId);

        assertThat(scheduleRows()).isEqualTo(1);
    }

    @Test
    @DisplayName("gọi lại nhiều lần không tạo thẻ trùng — vuốt trúng một từ hai lần là chuyện thường")
    void isIdempotent() {
        vocabularyService.markWordLearned(userId, wordId);
        vocabularyService.markWordLearned(userId, wordId);
        vocabularyService.markWordLearned(userId, wordId);

        assertThat(scheduleRows()).isEqualTo(1);
    }

    @Test
    @DisplayName("từ không tồn tại phải NÉM lỗi, không được im lặng coi như đã lưu")
    void unknownWordFails() {
        assertThatThrownBy(() -> vocabularyService.markWordLearned(userId, 999_999_999L))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    @DisplayName("người dùng không tồn tại cũng phải NÉM lỗi — 202 giả sẽ giấu mất tiến độ đã mất")
    void unknownUserFails() {
        assertThatThrownBy(() -> vocabularyService.markWordLearned(-424_242L, wordId))
                .as("khoá ngoại user_id sẽ từ chối; lỗi đó phải nổi lên tới người gọi")
                .isInstanceOf(Exception.class);

        assertThat(jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM vocab_review_schedule WHERE user_id = -424242", Integer.class))
                .isZero();
    }
}
