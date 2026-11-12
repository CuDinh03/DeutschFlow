package com.deutschflow.vocabulary.saved;

import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.common.exception.RateLimitExceededException;
import com.deutschflow.speaking.ai.AiChatCompletionResult;
import com.deutschflow.speaking.ai.OpenAiChatClient;
import com.deutschflow.speaking.ai.TokenUsage;
import com.deutschflow.testsupport.AbstractPostgresIntegrationTest;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserRepository;
import com.deutschflow.vocabulary.saved.SavedWordDtos.SaveRequest;
import com.deutschflow.vocabulary.saved.SavedWordDtos.SavedWord;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.jdbc.core.JdbcTemplate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.reset;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Sổ từ riêng (V386) trên Postgres thật: kho trước rồi AI, bộ nhớ tra dùng chung, chủ đề, thẻ ôn, gỡ từ.
 * AI là mock — không gọi nhà cung cấp thật.
 */
@SpringBootTest
@DisplayName("sổ từ riêng — lưu từ khi luyện đề đọc")
class SavedWordIntegrationTest extends AbstractPostgresIntegrationTest {

    private static final String KHO_LEMMA = "Mzzwohnung";
    private static final String KHO_FORM = "Mzzwohnungen";

    @Autowired private SavedWordService service;
    @Autowired private UserRepository userRepository;
    @Autowired private JdbcTemplate jdbc;

    @MockBean private OpenAiChatClient chatClient;

    private long userId;
    private long khoWordId;

    @BeforeEach
    void seed() {
        reset(chatClient);
        User u = userRepository.save(User.builder()
                .email("so-tu-" + System.nanoTime() + "@local.test")
                .passwordHash("x")
                .displayName("So Tu")
                .role(User.Role.STUDENT)
                .build());
        userId = u.getId();

        jdbc.update("DELETE FROM words WHERE base_form = ?", KHO_LEMMA);
        khoWordId = jdbc.queryForObject("""
                INSERT INTO words (dtype, base_form, cefr_level, created_at, updated_at)
                VALUES ('Noun', ?, 'B1', NOW(), NOW()) RETURNING id
                """, Long.class, KHO_LEMMA);
        jdbc.update("INSERT INTO nouns (id, gender, noun_type) VALUES (?, 'DIE', 'STARK')", khoWordId);
        jdbc.update("INSERT INTO noun_declension_forms (noun_id, kasus, numerus, form) VALUES (?, 'NOMINATIV', 'PLURAL', ?)",
                khoWordId, KHO_FORM);
        jdbc.update("INSERT INTO word_translations (word_id, locale, meaning) VALUES (?, 'vi', 'căn hộ thử')", khoWordId);
        jdbc.update("""
                INSERT INTO word_tags (word_id, tag_id)
                SELECT ?, id FROM tags WHERE name = 'Wohnen' AND is_topic_taxonomy IS TRUE
                """, khoWordId);
        jdbc.update("DELETE FROM vocab_lookup_cache WHERE surface_key LIKE 'mzz%'");
    }

    private void aiReturns(String json) {
        when(chatClient.chatCompletionForTier(any(), any(), anyDouble(), any()))
                .thenReturn(new AiChatCompletionResult(json, new TokenUsage(100, 30, 130, false), "test", "test-model"));
    }

    private SaveRequest req(String text, String sentence) {
        return new SaveRequest(text, sentence, null, "LESEN-2", "ctx", 10, 10 + text.length());
    }

    private int cards(String vocabId) {
        return jdbc.queryForObject("SELECT COUNT(*) FROM vocab_review_schedule WHERE user_id = ? AND vocab_id = ?",
                Integer.class, userId, vocabId);
    }

    @Test
    @DisplayName("dạng biến cách có trong kho ⇒ dạng gốc + nghĩa + chủ đề của kho, không gọi AI, có thẻ ôn word_<id>")
    void khoWordNoAi() {
        SavedWord w = service.save(userId, req(KHO_FORM, "Die Mzzwohnungen sind teuer."));

        assertThat(w.lemma()).isEqualTo(KHO_LEMMA);
        assertThat(w.article()).isEqualTo("die");
        assertThat(w.meaning()).isEqualTo("căn hộ thử");
        assertThat(w.topic()).isEqualTo("Wohnen");
        assertThat(w.topicLabel()).isEqualTo("Nhà ở");
        assertThat(w.alreadySaved()).isFalse();
        assertThat(cards("word_" + khoWordId)).isEqualTo(1);
        verify(chatClient, never()).chatCompletionForTier(any(), any(), anyDouble(), any());
    }

    @Test
    @DisplayName("lưu lại cùng từ (khác chữ bôi) ⇒ trả hàng cũ, alreadySaved, không thêm hàng")
    void savingTwiceKeepsOneRow() {
        service.save(userId, req(KHO_FORM, null));
        SavedWord again = service.save(userId, req(KHO_LEMMA, null));

        assertThat(again.alreadySaved()).isTrue();
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM user_saved_words WHERE user_id = ?", Integer.class, userId))
                .isEqualTo(1);
    }

    @Test
    @DisplayName("từ ngoài kho ⇒ AI giải nghĩa theo câu, kết quả vào bộ nhớ dùng chung; người sau không gọi AI nữa")
    void outsideKhoUsesAiThenCache() {
        aiReturns("{\"lemma\":\"mzzteilnehmen\",\"article\":null,\"pos\":\"VERB\",\"meaning_vi\":\"tham gia\",\"topic\":\"Reise\"}");
        SavedWord w = service.save(userId, req("mzznimmt", "Er mzznimmt am Kurs teil."));

        assertThat(w.lemma()).isEqualTo("mzzteilnehmen");
        assertThat(w.meaning()).isEqualTo("tham gia");
        assertThat(w.topic()).isEqualTo("Reise");
        assertThat(cards("sw:mzzteilnehmen")).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT ai_lookup FROM user_saved_words WHERE id = ?", Boolean.class, w.id())).isTrue();

        long other = userRepository.save(User.builder().email("so-tu-2-" + System.nanoTime() + "@local.test")
                .passwordHash("x").displayName("B").role(User.Role.STUDENT).build()).getId();
        SavedWord w2 = service.save(other, req("Mzznimmt", null));
        assertThat(w2.meaning()).isEqualTo("tham gia");
        verify(chatClient, times(1)).chatCompletionForTier(any(), any(), anyDouble(), any());
    }

    @Test
    @DisplayName("gỡ khỏi sổ ⇒ gỡ thẻ ôn do sổ tạo; thẻ có sẵn từ trước thì giữ")
    void removeDeletesOwnCardOnly() {
        SavedWord w = service.save(userId, req(KHO_FORM, null));
        service.remove(userId, w.id());
        assertThat(cards("word_" + khoWordId)).isZero();

        jdbc.update("""
                INSERT INTO vocab_review_schedule (user_id, vocab_id, german, meaning, algorithm_version)
                VALUES (?, ?, 'die Mzzwohnung', 'căn hộ', 'FSRS')
                """, userId, "word_" + khoWordId);
        SavedWord again = service.save(userId, req(KHO_FORM, null));
        service.remove(userId, again.id());
        assertThat(cards("word_" + khoWordId)).isEqualTo(1);
    }

    @Test
    @DisplayName("gỡ từ của người khác ⇒ 404")
    void cannotRemoveOthers() {
        SavedWord w = service.save(userId, req(KHO_FORM, null));
        assertThatThrownBy(() -> service.remove(userId + 999_999, w.id())).isInstanceOf(NotFoundException.class);
    }

    @Test
    @DisplayName("chữ không hợp lệ ⇒ 400")
    void rejectsBadText() {
        assertThatThrownBy(() -> service.save(userId, req("am 3. Mai", null))).isInstanceOf(BadRequestException.class);
    }

    @Test
    @DisplayName("quá trần tra AI trong ngày ⇒ 429; từ kho vẫn lưu được")
    void dailyCap() {
        for (int i = 0; i < 40; i++) {
            jdbc.update("""
                    INSERT INTO user_saved_words (user_id, lemma, lemma_key, surface, meaning_vi, meaning_source,
                        srs_vocab_id, ai_lookup)
                    VALUES (?, ?, ?, ?, 'x', 'AI', ?, TRUE)
                    """, userId, "Mzzcap" + i, "mzzcap" + i, "Mzzcap" + i, "sw:mzzcap" + i);
        }
        aiReturns("{\"lemma\":\"mzzneu\",\"pos\":\"OTHER\",\"meaning_vi\":\"mới\"}");

        assertThatThrownBy(() -> service.save(userId, req("mzzneu", null))).isInstanceOf(RateLimitExceededException.class);
        assertThat(service.save(userId, req(KHO_FORM, null)).lemma()).isEqualTo(KHO_LEMMA);
    }

    @Test
    @DisplayName("danh sách: chỉ từ của mình, mới nhất trước")
    void listOwnWords() {
        service.save(userId, req(KHO_FORM, null));
        var list = service.list(userId, "vi");
        assertThat(list.total()).isEqualTo(1);
        assertThat(list.items()).extracting(SavedWord::lemma).containsExactly(KHO_LEMMA);
    }

    @Test
    @DisplayName("danh sách trả vị trí trong bài để mở lại đúng câu")
    void listHasPassageLocation() {
        service.save(userId, req(KHO_FORM, "Die Mzzwohnungen sind teuer."));
        SavedWord w = service.list(userId, "vi").items().get(0);
        assertThat(w.block()).isEqualTo("ctx");
        assertThat(w.start()).isEqualTo(10);
        assertThat(w.end()).isEqualTo(10 + KHO_FORM.length());
        assertThat(w.sentence()).isEqualTo("Die Mzzwohnungen sind teuer.");
    }

    @Test
    @DisplayName("chuyển chủ đề: tên trong bộ sẵn ⇒ đổi + nhãn theo ngôn ngữ; null ⇒ chưa phân loại; tên lạ ⇒ 400")
    void changeTopic() {
        SavedWord w = service.save(userId, req(KHO_FORM, null));

        SavedWord moved = service.setTopic(userId, w.id(), "Reise", "en");
        assertThat(moved.topic()).isEqualTo("Reise");
        assertThat(moved.topicLabel()).isNotBlank();
        assertThat(jdbc.queryForObject("SELECT topic_source FROM user_saved_words WHERE id = ?", String.class, w.id()))
                .isEqualTo("USER");

        assertThat(service.setTopic(userId, w.id(), null, "vi").topic()).isNull();
        assertThatThrownBy(() -> service.setTopic(userId, w.id(), "Thuê nhà", "vi")).isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> service.setTopic(userId + 999_999, w.id(), "Reise", "vi")).isInstanceOf(NotFoundException.class);
    }

    @Test
    @DisplayName("sửa nghĩa: đổi cả thẻ ôn do sổ tạo; rỗng hay quá dài ⇒ 400")
    void editMeaning() {
        aiReturns("{\"lemma\":\"mzzanmelden\",\"pos\":\"VERB\",\"meaning_vi\":\"đăng ký\"}");
        SavedWord w = service.save(userId, req("mzzmeldet", null));

        SavedWord edited = service.setMeaning(userId, w.id(), "  đăng ký (khoá học) ", "vi");
        assertThat(edited.meaning()).isEqualTo("đăng ký (khoá học)");
        assertThat(jdbc.queryForObject("SELECT meaning FROM vocab_review_schedule WHERE user_id = ? AND vocab_id = ?",
                String.class, userId, "sw:mzzanmelden")).isEqualTo("đăng ký (khoá học)");

        assertThatThrownBy(() -> service.setMeaning(userId, w.id(), "  ", "vi")).isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> service.setMeaning(userId, w.id(), "x".repeat(201), "vi")).isInstanceOf(BadRequestException.class);
    }
}