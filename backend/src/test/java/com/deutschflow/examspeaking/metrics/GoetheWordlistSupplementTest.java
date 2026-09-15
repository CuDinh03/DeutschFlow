package com.deutschflow.examspeaking.metrics;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/** F-14: tầng B2/C1 suy từ tần suất chỉ điền chỗ trống; cấp chính thức A1–B1 không bao giờ bị ghi đè. */
class GoetheWordlistSupplementTest {

    @Test
    @DisplayName("từ A1 giữ nguyên cấp chính thức; từ ngoài Wortliste B1 có cấp B2/C1 từ tầng bổ sung")
    void supplementFillsOnlyGaps() {
        GoetheWordlist wl = new GoetheWordlist();
        wl.load();
        assertThat(wl.size()).isGreaterThan(10_000);
        // danh từ Wortliste ghi "das Haus" — trước bản vá 05/09 tra "haus" rỗng (danh từ chưa từng khớp)
        assertThat(wl.levelOf("haus")).contains("A1");
        assertThat(wl.levelOf("Häuser")).as("bỏ đuôi + umlaut không xử lý: chỉ cần không rơi nhầm vào B2/C1").isNotEqualTo(java.util.Optional.of("C1"));
        assertThat(wl.levelOf("Ausbildung")).as("có trong Wortliste chính thức → không bị tầng bổ sung ghi đè").contains("A2");
        assertThat(wl.levelOf("freuen")).as("'sich freuen' → khoá 'freuen'").isPresent();
        assertThat(wl.levelOf("Zwillinge")).contains("B2");
        assertThat(wl.levelOf("Rückenmark")).contains("C1");
        assertThat(wl.levelOf("xyzzyq")).isEmpty();
        assertThat(GoetheWordlist.normalizeLemma("das Kranken-")).containsExactly("kranken");
        assertThat(GoetheWordlist.normalizeLemma("Wir wollen ein Haus bauen")).isEmpty();
        assertThat(GoetheWordlist.normalizeLemma("zu Hause")).containsExactly("zu hause", "hause");
    }
}
