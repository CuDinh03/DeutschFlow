package com.deutschflow.vocabulary.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Chạy trên chính các wordlist đóng gói trong JAR — đây là hợp đồng "cấp độ đến từ đâu".
 *
 * <p>Hồi quy cho lỗi 14/08/2026: cấp độ từng được suy ra từ dải tần suất + vị trí trong danh sách, khiến
 * 407/643 lemma Goethe A1 bị đẩy lên B1 và 29% kho mang cấp ngẫu nhiên.
 */
class CefrLevelResolverTest {

    private CefrLevelResolver resolver;

    @BeforeEach
    void setUp() {
        resolver = new CefrLevelResolver();
        ReflectionTestUtils.setField(resolver, "officialTsv", "wordlists/goethe_official_wordlist.tsv");
        ReflectionTestUtils.setField(resolver, "a1AnkiTsv", "wordlists/cefr_a1_patsy.txt");
        ReflectionTestUtils.setField(resolver, "b1List", "wordlists/goethe_sorted.txt");
        ReflectionTestUtils.setField(resolver, "a2List", "");
        ReflectionTestUtils.setField(resolver, "b2List", "");
        ReflectionTestUtils.setField(resolver, "c1List", "");
        ReflectionTestUtils.setField(resolver, "c2List", "");
    }

    @Test
    @DisplayName("từ vựng lõi A1 giữ đúng cấp A1, không bị đẩy lên B1/C1")
    void coreA1WordsStayA1() {
        assertThat(resolver.resolve("trinken")).contains("A1");
        assertThat(resolver.resolve("Haus")).contains("A1");
        assertThat(resolver.resolve("arbeiten")).contains("A1");
    }

    @Test
    @DisplayName("khớp không phân biệt hoa/thường và bỏ mạo từ — base_form trong DB đang viết thường")
    void matchesRegardlessOfArticleAndCase() {
        assertThat(resolver.resolve("haus")).isEqualTo(resolver.resolve("das Haus"));
        assertThat(resolver.resolve("haus")).isNotEmpty();
    }

    @Test
    @DisplayName("từ chỉ có trong bảng tần suất ⇒ CHƯA PHÂN CẤP, không đoán")
    void frequencyOnlyWordStaysUngraded() {
        // "anzustellen" nằm trong de_50k nhưng không có trong wordlist Goethe nào.
        assertThat(resolver.resolve("anzustellen")).isEmpty();
        assertThat(resolver.resolve("Kommissar")).isEmpty();
    }

    @Test
    @DisplayName("lemma rỗng/null không tra được")
    void blankLemmaResolvesToEmpty() {
        assertThat(resolver.resolve(null)).isEmpty();
        assertThat(resolver.resolve("   ")).isEmpty();
        assertThat(resolver.resolve("123")).isEmpty();
    }

    @Test
    @DisplayName("danh sách Goethe cộng dồn ⇒ lấy cấp THẤP NHẤT (cấp gặp từ lần đầu)")
    void cumulativeListsKeepLowestLevel() {
        // "trinken" có trong cả Wortliste A1 lẫn Wortliste B1 (B1 bao gồm A1–B1) ⇒ phải là A1.
        Optional<String> level = resolver.resolve("trinken");
        assertThat(level).contains("A1");
    }

    @Test
    @DisplayName("độ phủ wordlist đủ để bộ lọc cấp độ có nghĩa")
    void wordlistCoverageIsSane() {
        Map<String, Integer> counts = resolver.countsByLevel();
        // Wortliste A1 của Goethe có ~650 mục — cùng cỡ này nghĩa là parse đúng.
        assertThat(counts.get("A1")).isBetween(500, 900);
        assertThat(counts.get("B1")).isGreaterThan(1000);
        assertThat(resolver.gradedLemmas()).hasSizeGreaterThan(2500);
        // Chưa có nguồn chính thức cho B2/C1/C2 ⇒ không được tự sinh ra cấp nào ở đó.
        assertThat(counts.get("B2")).isZero();
        assertThat(counts.get("C1")).isZero();
        assertThat(counts.get("C2")).isZero();
    }

    @Test
    @DisplayName("gradedLemmas trả dạng hiển thị đã bỏ mạo từ/đuôi số nhiều")
    void gradedLemmasAreCleanDisplayForms() {
        assertThat(resolver.gradedLemmas())
                .extracting(CefrLevelResolver.GradedLemma::lemma)
                .noneMatch(l -> l.startsWith("der ") || l.startsWith("die ") || l.startsWith("das "))
                .noneMatch(l -> l.contains(","));
    }
}
