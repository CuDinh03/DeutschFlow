package com.deutschflow.grammar.service;

import com.deutschflow.grammar.service.ExamStrategyCatalog.StrategyDto;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/** LT2 — nội dung chiến thuật telc B1: đủ 12 Teil, khớp trọng số đề, chưa duyệt thì học viên không thấy. */
@DisplayName("ExamStrategyCatalog — chiến thuật từng Teil (LT2)")
class ExamStrategyCatalogTest {

    private final ExamStrategyCatalog catalog = new ExamStrategyCatalog(new ObjectMapper());

    @Test
    @DisplayName("đủ 12 Teil telc B1, tổng điểm 300 (viết 225 + nói 75), mỗi Teil đủ khung nội dung cả VI lẫn EN")
    void telcB1HasTwelveCompleteTeile() {
        for (String lang : List.of("vi", "en")) {
            List<StrategyDto> all = catalog.forExam("TELC", "B1", lang, true);
            assertThat(all).hasSize(12);
            assertThat(all).extracting(s -> s.section() + s.teil()).containsExactly(
                    "LESEN1", "LESEN2", "LESEN3", "SPRACHBAUSTEINE1", "SPRACHBAUSTEINE2",
                    "HOEREN1", "HOEREN2", "HOEREN3", "SCHREIBEN1", "SPRECHEN1", "SPRECHEN2", "SPRECHEN3");
            assertThat(all.stream().mapToDouble(StrategyDto::points).sum()).isEqualTo(300);
            assertThat(all.stream().filter(s -> s.section().equals("SPRECHEN")).mapToDouble(StrategyDto::points).sum())
                    .isEqualTo(75);
            for (StrategyDto s : all) {
                var c = s.content();
                assertThat(c.title()).as("%s %s %d", lang, s.section(), s.teil()).isNotBlank();
                assertThat(c.format()).isNotBlank();
                assertThat(c.steps()).hasSizeGreaterThanOrEqualTo(3);
                assertThat(c.traps()).hasSize(3);
                assertThat(c.fixes()).isNotEmpty().allMatch(f -> !f.cause().isBlank() && !f.fix().isBlank());
            }
        }
    }

    @Test
    @DisplayName("chưa duyệt: học viên nhận COMING_SOON không nội dung; người duyệt thấy bản nháp")
    void unreviewedIsHiddenFromStudents() {
        List<StrategyDto> student = catalog.forExam("telc", "b1", "vi", false);
        List<StrategyDto> reviewer = catalog.forExam("TELC", "B1", "vi", true);

        // Nháp hiện tại chưa Teil nào được duyệt.
        assertThat(student).allMatch(s -> s.status().equals(ExamStrategyCatalog.COMING_SOON) && s.content() == null);
        assertThat(reviewer).allMatch(s -> s.status().equals(ExamStrategyCatalog.DRAFT) && s.content() != null);
    }

    @Test
    @DisplayName("giao diện tiếng Đức dùng bản tiếng Anh; đề chưa có nội dung ⇒ rỗng")
    void languageFallbackAndUnknownExam() {
        StrategyDto de = catalog.forExam("TELC", "B1", "de", true).get(0);
        StrategyDto en = catalog.forExam("TELC", "B1", "en", true).get(0);
        assertThat(de.content().title()).isEqualTo(en.content().title());
        assertThat(catalog.forExam("GOETHE", "B1", "vi", true)).isEmpty();
        assertThat(catalog.forExam(null, null, "vi", true)).isEmpty();
    }
}
