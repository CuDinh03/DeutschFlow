package com.deutschflow.grammar.service;

import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.grammar.service.PassageMarksValidator.Mode;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Gói đánh dấu bài đọc (09/11/2026): làm sạch, giới hạn, chế độ thi thử bỏ gắn câu + ghi chú. */
class PassageMarksValidatorTest {

    private static final String CTX = "Frau Özdemir leitet eine Agentur.\r\nWer zu uns kommt, fragt zuerst nach dem Zeitaufwand.";
    private static final Map<String, Object> TEIL = Map.of(
            "context", CTX,
            "items", List.of(
                    Map.of("id", "LV2-6", "question", "Freiwillige hören meistens auf, weil …",
                            "options", Map.of("a", "x", "b", "y", "c", "z")),
                    Map.of("id", "LV2-7", "question", "Wer kommt, fragt zuerst, …",
                            "options", Map.of("a", "x", "b", "y", "c", "z"))));

    private static final Map<String, String> BLOCKS = PassageMarksValidator.blocksOf(TEIL);
    private static final Set<String> IDS = Set.of("LV2-6", "LV2-7");
    private static final Map<String, Set<String>> OPTS = PassageMarksValidator.optionsOf(TEIL);

    private static Map<String, Object> mark(Object... kv) {
        Map<String, Object> m = new LinkedHashMap<>(Map.of("id", "h1", "g", "g1", "b", "ctx", "s", 0, "e", 4, "k", "hl", "c", "y"));
        for (int i = 0; i < kv.length; i += 2) m.put((String) kv[i], kv[i + 1]);
        return m;
    }

    private static Map<String, Object> pack(List<?> marks, Map<String, ?> struck) {
        Map<String, Object> p = new HashMap<>();
        p.put("v", 1);
        if (marks != null) p.put("marks", marks);
        if (struck != null) p.put("struck", struck);
        return p;
    }

    private static Map<String, Object> clean(Map<String, Object> raw, Mode mode) {
        return PassageMarksValidator.clean(raw, BLOCKS, IDS, OPTS, mode);
    }

    @Test
    void khoiChuChuanHoaXuongDongVaCoDeTungCau() {
        assertThat(BLOCKS).containsOnlyKeys("ctx", "q:LV2-6", "q:LV2-7");
        assertThat(BLOCKS.get("ctx")).doesNotContain("\r").contains("Agentur.\nWer");
        assertThat(OPTS.get("LV2-6")).containsExactlyInAnyOrder("a", "b", "c");
    }

    @Test
    void hashFnv1aKhopClient() {
        // cùng bộ giá trị với frontend/src/components/exam/marks/marksModel.test.ts
        assertThat(PassageMarksValidator.hash("")).isEqualTo("811c9dc5");
        assertThat(PassageMarksValidator.hash("a")).isEqualTo("e40c292c");
        assertThat(PassageMarksValidator.hash("Özdemir – „Zeit“")).isEqualTo(PassageMarksValidator.hash("Özdemir – „Zeit“"));
        assertThat(PassageMarksValidator.hash("Zeit")).isNotEqualTo(PassageMarksValidator.hash("Zeit."));
    }

    @Test
    void goiHopLeDuocLamSachVaGhiHashKhoiDaDung() {
        Map<String, Object> out = clean(pack(List.of(
                mark("q", "LV2-7", "n", "  Zeitaufwand = thời gian  ", "x", "lạ"),
                mark("id", "h2", "g", "g2", "b", "q:LV2-6", "s", 0, "e", 11, "k", "ul", "c", "y")),
                Map.of("LV2-6", List.of("a", "a", "c"))), Mode.FULL);

        assertThat(out.get("v")).isEqualTo(1);
        @SuppressWarnings("unchecked") List<Map<String, Object>> marks = (List<Map<String, Object>>) out.get("marks");
        assertThat(marks).hasSize(2);
        assertThat(marks.get(0)).containsEntry("q", "LV2-7").containsEntry("n", "Zeitaufwand = thời gian").doesNotContainKey("x");
        assertThat(marks.get(1)).containsEntry("k", "ul").containsEntry("c", null);
        assertThat(out.get("blocks")).isEqualTo(Map.of(
                "ctx", PassageMarksValidator.hash(BLOCKS.get("ctx")),
                "q:LV2-6", PassageMarksValidator.hash(BLOCKS.get("q:LV2-6"))));
        assertThat(out.get("struck")).isEqualTo(Map.of("LV2-6", List.of("a", "c")));
    }

    @Test
    void goiRongHopLe() {
        Map<String, Object> out = clean(null, Mode.FULL);
        assertThat((List<?>) out.get("marks")).isEmpty();
        assertThat((Map<?, ?>) out.get("struck")).isEmpty();
    }

    @Test
    void cheDoThiThuBoGanCauVaGhiChu() {
        Map<String, Object> out = clean(pack(List.of(mark("q", "LV2-7", "n", "ghi chú")), null), Mode.EXAM);
        @SuppressWarnings("unchecked") Map<String, Object> m = ((List<Map<String, Object>>) out.get("marks")).get(0);
        assertThat(m).containsEntry("q", null).containsEntry("n", "");
    }

    @Test
    void tuChoiGoiSai() {
        int len = BLOCKS.get("ctx").length();
        List<Map<String, Object>> bad = List.of(
                mark("b", "q:LV2-99"),                // khối lạ
                mark("s", 5, "e", 5),                 // rỗng
                mark("s", 3, "e", 2),                 // ngược
                mark("e", len + 1),                   // vượt độ dài khối
                mark("s", -1),
                mark("k", "box"),
                mark("c", "r"),
                mark("c", null),                      // hl thiếu màu
                mark("q", "LV2-99"),                  // câu lạ
                mark("n", "x".repeat(PassageMarksValidator.MAX_NOTE + 1)),
                mark("id", null),
                mark("s", "0"),                       // không phải số
                mark("s", 1.5));
        for (Map<String, Object> m : bad) {
            assertThatThrownBy(() -> clean(pack(List.of(m), null), Mode.FULL))
                    .as(m.toString()).isInstanceOf(BadRequestException.class);
        }
    }

    @Test
    void tuChoiQuaNhieuDanhDauVaGachBoSai() {
        List<Map<String, Object>> many = new ArrayList<>();
        for (int i = 0; i <= PassageMarksValidator.MAX_MARKS; i++) many.add(mark("id", "h" + i));
        assertThatThrownBy(() -> clean(pack(many, null), Mode.FULL)).isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> clean(pack(null, Map.of("LV2-6", List.of("d"))), Mode.FULL)).isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> clean(pack(null, Map.of("LV2-99", List.of("a"))), Mode.FULL)).isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> clean(pack(null, Map.of("LV2-6", "a")), Mode.FULL)).isInstanceOf(BadRequestException.class);
        Map<String, Object> notList = new HashMap<>();
        notList.put("marks", "x");
        assertThatThrownBy(() -> clean(notList, Mode.FULL)).isInstanceOf(BadRequestException.class);
    }
}
