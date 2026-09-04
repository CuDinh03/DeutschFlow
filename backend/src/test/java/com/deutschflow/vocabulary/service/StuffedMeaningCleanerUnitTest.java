package com.deutschflow.vocabulary.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Khoá quy tắc cắt {@code meaning_en} bị nhồi — mọi chuỗi dưới đây là DỮ LIỆU THẬT lấy từ prod
 * (mẫu 2.314 bản ghi qua review-queue), không phải ví dụ bịa.
 *
 * <p>Rủi ro lớn nhất của bản vá này là <b>cắt lố</b> làm mất nghĩa thật, nên test bám hai phía:
 * cắt đúng chỗ ở ca bẩn, và <b>tuyệt đối không đụng</b> ca sạch.
 */
@DisplayName("vocabulary · cắt nghĩa tiếng Anh bị nhồi trích dẫn")
class StuffedMeaningCleanerUnitTest {

    @Test
    @DisplayName("cắt ở năm trích dẫn, giữ nguyên phần giải nghĩa trong ngoặc")
    void keepsParentheticalGloss() {
        assertThat(VocabularyCleanupService.cleanStuffedMeaning(
                "village (rural habitation of size between a hamlet and a town) 1903, Fanny zu Reventlow,"
                        + " Ellen Olestjerne, in Franziska Gräfin zu Reventlow: Gesammelte Werke"))
                .isEqualTo("village (rural habitation of size between a hamlet and a town)");

        assertThat(VocabularyCleanupService.cleanStuffedMeaning(
                "court (of justice) 2010, Der Spiegel, number 27/2010, page 109: Ein Gericht verurteilt"))
                .isEqualTo("court (of justice)");
    }

    @Test
    @DisplayName("cắt ở câu ví dụ tiếng Đức (không có năm đứng trước)")
    void cutsAtGermanExampleSentence() {
        assertThat(VocabularyCleanupService.cleanStuffedMeaning(
                "lake Dieser See ist sehr klein. This lake is very small. \"Görlitzer Park\","
                        + " Berliner Zeitung, November 11, 2013."))
                .isEqualTo("lake");

        // #2356 "Welt" — bản thật dài 618kt, không có năm đứng ngay sau nghĩa nên phải dựa vào
        // chữ hoa đầu tiên; chuỗi phải đủ dài để lọt ngưỡng nghi ngờ.
        assertThat(VocabularyCleanupService.cleanStuffedMeaning(
                "world Georg Büchner, Dantons Tod. Ein Drama (Condor Bibliothek im Apollo Verlag,"
                        + " Lindau, p. 50) CAMILLE: Die Welt ist der Ewige Jude, das Nichts ist der Tod,"
                        + " aber er ist unmöglich. Oh, nicht sterben können, nicht sterben können"))
                .isEqualTo("world");
    }

    @Test
    @DisplayName("cắt ở danh sách đồng nghĩa")
    void cutsAtSynonymList() {
        assertThat(VocabularyCleanupService.cleanStuffedMeaning(
                "face Synonyms: (both poetic) Angesicht, Antlitz, (both derogatory) Fresse, Visage"))
                .isEqualTo("face");
    }

    @Test
    @DisplayName("bảng biến cách khổng lồ → giữ lại phần trước dấu hai chấm")
    void trimsInflectionDump() {
        assertThat(VocabularyCleanupService.cleanStuffedMeaning(
                "inflection of alt: strong/mixed nominative/accusative feminine singular strong"
                        + " nominative/accusative plural weak nominative all-gender singular"))
                .isEqualTo("inflection of alt");
    }

    @ParameterizedTest(name = "giữ nguyên: {0}")
    @DisplayName("nghĩa sạch KHÔNG bao giờ bị đụng tới")
    @ValueSource(strings = {
            "chair",
            "brother",
            "past participle of abhauen",
            "hope (belief that something wished for can happen)",
            "to keep busy",
            "photograph"
    })
    void leavesCleanMeaningsAlone(String clean) {
        assertThat(VocabularyCleanupService.cleanStuffedMeaning(clean)).isEqualTo(clean);
    }

    @Test
    @DisplayName("không bao giờ trả về rỗng — thà giữ bản bẩn còn hơn mất nghĩa")
    void neverReturnsEmpty() {
        // Chuỗi mở đầu ngay bằng chữ hoa: cắt sẽ ra rỗng ⇒ phải giữ nguyên bản gốc.
        String startsCapital = "Dieser See ist sehr klein. This lake is very small, 2013.";
        assertThat(VocabularyCleanupService.cleanStuffedMeaning(startsCapital)).isEqualTo(startsCapital);

        assertThat(VocabularyCleanupService.cleanStuffedMeaning(null)).isNull();
        assertThat(VocabularyCleanupService.cleanStuffedMeaning("   ")).isEqualTo("   ");
    }
}
