package com.deutschflow.grammar.service;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class PracticeAnalysisTest {

    private static Map<String, Object> headlineTeil() {
        return Map.of(
                "teil", 1, "type", "MATCH_HEADLINE", "point_per_item", 5,
                "headlines", Map.of("a", "Nachtbusse fahren länger", "b", "Busfahren wird teurer", "c", "Neue Bibliothek"),
                "items", List.of(
                        Map.of("id", "LV1-1", "question", "Text 1", "correct", "a",
                                "explanation_vi", "Xe buýt đêm chạy suốt đêm ⇒ a."),
                        Map.of("id", "LV1-2", "question", "Text 2", "correct", "c",
                                "explanation_vi", "Thư viện mới ⇒ c.")));
    }

    @Test
    void chamDungTrongSoVaGhiViSaoDungTuDe() {
        var r = PracticeAnalysis.analyse("LESEN-1", headlineTeil(), Map.of(), Map.of("LV1-1", "a", "LV1-2", "b"));

        assertThat(r.score()).isEqualTo(5.0);
        assertThat(r.max()).isEqualTo(10.0);
        assertThat(r.correctCount()).isEqualTo(1);
        var first = r.items().get(0);
        assertThat(first.isCorrect()).isTrue();
        assertThat(first.label()).isEqualTo("1");
        assertThat(first.whyRight()).isEqualTo("Xe buýt đêm chạy suốt đêm ⇒ a.");
        assertThat(first.whyWrong()).isNull();
    }

    @Test
    void viSaoSaiRiengChoPhuongAnDuocUuTienKemNhanBay() {
        Map<String, Object> notes = Map.of("items", Map.of("LV1-2", Map.of(
                "evidence", List.of("neue Bibliothek"),
                "wrong", Map.of("b", Map.of("why_vi", "Bài không nói chuyện giá vé.", "trap", "Bẫy cùng chủ đề")))));

        var item = PracticeAnalysis.analyse("LESEN-1", headlineTeil(), notes, Map.of("LV1-2", "b")).items().get(1);

        assertThat(item.isCorrect()).isFalse();
        assertThat(item.givenText()).isEqualTo("Busfahren wird teurer");
        assertThat(item.correctText()).isEqualTo("Neue Bibliothek");
        assertThat(item.whyWrong()).isEqualTo("Bài không nói chuyện giá vé.");
        assertThat(item.trap()).isEqualTo("Bẫy cùng chủ đề");
        assertThat(item.evidence()).containsExactly("neue Bibliothek");
    }

    @Test
    void chuaCoYRiengThiRapTuNghiaLuaChonVaYChinh() {
        Map<String, Object> notes = Map.of(
                "options", Map.of("b", Map.of("meaning_vi", "đi xe buýt đắt hơn")),
                "items", Map.of("LV1-2", Map.of("gist_vi", "thư viện mới mở")));

        var item = PracticeAnalysis.analyse("LESEN-1", headlineTeil(), notes, Map.of("LV1-2", "b")).items().get(1);

        assertThat(item.whyWrong())
                .contains("„Busfahren wird teurer“ nghĩa là đi xe buýt đắt hơn")
                .contains("thư viện mới mở");
    }

    @Test
    void cauBoTrongKhongBiTinhLaSaiCoLyDo() {
        var item = PracticeAnalysis.analyse("LESEN-1", headlineTeil(), Map.of(), Map.of()).items().get(0);

        assertThat(item.answered()).isFalse();
        assertThat(item.isCorrect()).isFalse();
        assertThat(item.whyWrong()).isNull();
        assertThat(item.whyRight()).isNotBlank();
    }

    @Test
    void luaChonThuaDuocLietKeKemGhiChu() {
        Map<String, Object> notes = Map.of("options", Map.of("b", Map.of("distractor_vi", "Gần text 1 nhưng sai giá vé.")));

        var unused = PracticeAnalysis.analyse("LESEN-1", headlineTeil(), notes, Map.of()).unusedOptions();

        assertThat(unused).hasSize(1);
        assertThat(unused.get(0).key()).isEqualTo("b");
        assertThat(unused.get(0).note()).isEqualTo("Gần text 1 nhưng sai giá vé.");
    }

    @Test
    void hopTuNoiChoCanLoaiTuGi() {
        Map<String, Object> teil = Map.of("teil", 2, "type", "GAP_WORDBANK", "point_per_item", 1.5,
                "word_bank", Map.of("a", "IM", "b", "OBWOHL"),
                "items", List.of(Map.of("id", "SB2-31", "gap", 31, "correct", "a", "explanation_vi", "im Internet")));
        Map<String, Object> notes = Map.of(
                "options", Map.of("b", Map.of("meaning_vi", "liên từ „mặc dù“, mở câu phụ")),
                "items", Map.of("SB2-31", Map.of("need_vi", "một giới từ chỉ nơi chốn")));

        var item = PracticeAnalysis.analyse("SPRACHBAUSTEINE-2", teil, notes, Map.of("SB2-31", "b")).items().get(0);

        assertThat(item.label()).isEqualTo("31");
        assertThat(item.points()).isEqualTo(1.5);
        assertThat(item.whyWrong()).isEqualTo("„OBWOHL“ là liên từ „mặc dù“, mở câu phụ. Chỗ này cần một giới từ chỉ nơi chốn.");
        assertThat(item.need()).isEqualTo("một giới từ chỉ nơi chốn");
    }

    @Test
    void raoVatChonXKhiCoMauHop() {
        Map<String, Object> teil = Map.of("teil", 3, "type", "MATCH_AD_X", "point_per_item", 2.5,
                "ads", Map.of("a", "Babysitterin"),
                "items", List.of(Map.of("id", "LV3-14", "question", "Kino am Samstag", "correct", "a")));

        var item = PracticeAnalysis.analyse("LESEN-3", teil, Map.of(), Map.of("LV3-14", "x")).items().get(0);

        assertThat(item.givenText()).isEqualTo("Không mẩu nào phù hợp");
        assertThat(item.whyWrong()).contains("mẩu a đáp ứng đúng tình huống");
        assertThat(item.label()).isEqualTo("14");
    }

    @Test
    void hoerenDungSai_khongKhaiOptions_vanCoChuDapAn() {
        Map<String, Object> teil = Map.of("teil", 1, "point_per_item", 5, "items", List.of(
                Map.of("id", "HV1-41", "question", "Sie fährt auch im Winter.", "correct", "richtig",
                        "explanation_vi", "„auch im Winter“ ⇒ ĐÚNG."),
                Map.of("id", "HV1-42", "question", "Kein Bus.", "correct", "falsch",
                        "explanation_vi", "Ban ngày có xe buýt ⇒ SAI.")));

        var r = PracticeAnalysis.analyse("HOEREN-1", teil, Map.of(), Map.of("HV1-41", "richtig", "HV1-42", "richtig"));

        assertThat(r.score()).isEqualTo(5.0);
        assertThat(r.max()).isEqualTo(10.0);
        var wrong = r.items().get(1);
        assertThat(wrong.label()).isEqualTo("42");
        assertThat(wrong.givenText()).isEqualTo("Richtig");
        assertThat(wrong.correctText()).isEqualTo("Falsch");
        assertThat(wrong.whyRight()).isEqualTo("Ban ngày có xe buýt ⇒ SAI.");
    }
}
