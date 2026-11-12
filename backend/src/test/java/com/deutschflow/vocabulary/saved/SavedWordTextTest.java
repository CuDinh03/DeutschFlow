package com.deutschflow.vocabulary.saved;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

@DisplayName("lưu từ — chuẩn hoá chữ bôi đen và đọc kết quả AI")
class SavedWordTextTest {

    @Test
    @DisplayName("bỏ dấu câu, ngoặc, số ở hai đầu và gộp khoảng trắng")
    void normalizesEdges() {
        assertThat(SavedWordText.normalizeSurface("  „Wohnung,“ ")).isEqualTo("Wohnung");
        assertThat(SavedWordText.normalizeSurface("(nimmt\n  teil).")).isEqualTo("nimmt teil");
        assertThat(SavedWordText.normalizeSurface("12 Euro")).isEqualTo("Euro");
        assertThat(SavedWordText.normalizeSurface("E-Mail")).isEqualTo("E-Mail");
    }

    @Test
    @DisplayName("từ chối chữ rỗng, quá 5 từ, có số hay ký hiệu ở giữa")
    void rejectsInvalid() {
        assertThat(SavedWordText.normalizeSurface(null)).isNull();
        assertThat(SavedWordText.normalizeSurface(" ... ")).isNull();
        assertThat(SavedWordText.normalizeSurface("eins zwei drei vier fünf sechs")).isNull();
        assertThat(SavedWordText.normalizeSurface("am 3. Mai")).isNull();
        assertThat(SavedWordText.normalizeSurface("Preis: hoch")).isNull();
        assertThat(SavedWordText.normalizeSurface("x".repeat(61))).isNull();
    }

    @Test
    @DisplayName("câu gốc: gộp khoảng trắng, cắt 500 ký tự, rỗng ⇒ null")
    void normalizesSentence() {
        assertThat(SavedWordText.normalizeSentence("  Ich   wohne\nhier. ")).isEqualTo("Ich wohne hier.");
        assertThat(SavedWordText.normalizeSentence("   ")).isNull();
        assertThat(SavedWordText.normalizeSentence("a".repeat(800))).hasSize(500);
    }

    @Test
    @DisplayName("mã thẻ ôn: từ kho dùng word_<id>, từ ngoài kho sw:<dạng gốc>, dài thì băm ≤ 80 ký tự")
    void srsVocabId() {
        assertThat(SavedWordService.srsVocabId(42L, "wohnung")).isEqualTo("word_42");
        assertThat(SavedWordService.srsVocabId(null, "teilnehmen")).isEqualTo("sw:teilnehmen");
        String longId = SavedWordService.srsVocabId(null, "a".repeat(120));
        assertThat(longId).startsWith("sw:#").hasSizeLessThanOrEqualTo(80);
        assertThat(SavedWordService.srsVocabId(null, "a".repeat(120))).isEqualTo(longId);
    }

    private final SavedWordLookupService lookup =
            new SavedWordLookupService(null, null, null, null, null, null, new ObjectMapper(), null);
    private final Set<String> taxonomy = Set.of("Wohnen", "Reise");

    @Test
    @DisplayName("đọc JSON AI kèm chữ thừa; danh từ giữ mạo từ, chủ đề trong bộ sẵn")
    void parsesAi() {
        var r = lookup.parse("Đây: {\"lemma\":\"Wohnung\",\"article\":\"Die\",\"pos\":\"noun\","
                + "\"meaning_vi\":\"căn hộ\",\"topic\":\"Wohnen\"} xong", "Wohnungen", taxonomy, "m");
        assertThat(r).isNotNull();
        assertThat(r.lemma()).isEqualTo("Wohnung");
        assertThat(r.article()).isEqualTo("die");
        assertThat(r.pos()).isEqualTo("NOUN");
        assertThat(r.meaning()).isEqualTo("căn hộ");
        assertThat(r.topic()).isEqualTo("Wohnen");
    }

    @Test
    @DisplayName("chủ đề ngoài bộ sẵn ⇒ bỏ; động từ không giữ mạo từ; dạng gốc lạ ⇒ dùng chữ bôi")
    void sanitizesAi() {
        var r = lookup.parse("{\"lemma\":\"<b>x</b>\",\"article\":\"der\",\"pos\":\"VERB\","
                + "\"meaning_vi\":\"tham gia\",\"topic\":\"Thuê nhà\"}", "nimmt teil", taxonomy, "m");
        assertThat(r).isNotNull();
        assertThat(r.lemma()).isEqualTo("nimmt teil");
        assertThat(r.article()).isNull();
        assertThat(r.topic()).isNull();
    }

    @Test
    @DisplayName("thiếu nghĩa hoặc không phải JSON ⇒ null (dịch vụ báo 503, không lưu nửa vời)")
    void rejectsBadAi() {
        assertThat(lookup.parse("không có JSON", "Haus", taxonomy, "m")).isNull();
        assertThat(lookup.parse("{\"lemma\":\"Haus\",\"meaning_vi\":null}", "Haus", taxonomy, "m")).isNull();
        assertThat(lookup.parse(null, "Haus", taxonomy, "m")).isNull();
    }

    @Test
    @DisplayName("nghĩa giữ chỗ của kho không tính là có nghĩa")
    void placeholderMeaning() {
        assertThat(SavedWordLookupService.hasMeaning("not in wordlists yet")).isFalse();
        assertThat(SavedWordLookupService.hasMeaning("  ")).isFalse();
        assertThat(SavedWordLookupService.hasMeaning("căn hộ")).isTrue();
        assertThat(SavedWordLookupService.articleOf("DIE")).isEqualTo("die");
        assertThat(SavedWordLookupService.articleOf("X")).isNull();
    }
}
