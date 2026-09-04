package com.deutschflow.user.mentor;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Khoá ánh xạ industry (chuỗi tự do) → {@link IndustryFamily}.
 *
 * <p>QA 2026-08-20 (F-6) phát hiện 2/6 lựa chọn của app mobile rơi sai họ:
 * {@code Tourismus} không khớp từ khoá nào nên rơi về EDUCATION, còn
 * {@code Technik} bị nhánh IT bắt vì {@code "tech"} là chuỗi con của
 * {@code "technik"}. Hệ quả: NIKLAS (Phục vụ nhà hàng, bậc BEGINNER — tài khoản
 * FREE dùng được ngay) không tài nào chạm tới được từ onboarding, còn học viên
 * ngành kỹ thuật thì nhận mentor CNTT.
 *
 * <p>Test này khoá <b>đúng những giá trị hai client thật sự gửi lên</b>, không
 * phải từ khoá tưởng tượng — đó là chỗ hồi quy xảy ra.
 */
class IndustryFamilyTest {

    @DisplayName("6 lựa chọn của app mobile — app/(auth)/onboarding.tsx INDUSTRIES")
    @ParameterizedTest(name = "{0} → {1}")
    @CsvSource({
            "IT,          IT",
            "Pflege,      HEALTHCARE",
            "Gastronomie, GASTRONOMY",
            "Verkauf,     RETAIL",
            "Tourismus,   SERVICE",      // F-6: trước đây rơi về EDUCATION
            "Technik,     OPERATIONS",   // F-6: trước đây bị nhánh IT bắt qua "tech"
    })
    void mapsMobileIndustryOptions(String industry, IndustryFamily expected) {
        assertThat(IndustryFamily.fromText(industry)).isEqualTo(expected);
    }

    @DisplayName("7 lựa chọn của web — frontend/src/app/v2/onboarding/page.tsx INDUSTRIES")
    @ParameterizedTest(name = "{0} → {1}")
    @CsvSource({
            "IT,          IT",
            "Medizin,     HEALTHCARE",
            "Gastronomie, GASTRONOMY",
            "Handel,      RETAIL",       // F-6: "handel" không chứa "einzelhandel" nên trước đây rơi về EDUCATION
            "Bildung,     EDUCATION",
            "Sport,       EDUCATION",
            "Andere,      EDUCATION",
    })
    void mapsWebIndustryOptions(String industry, IndustryFamily expected) {
        assertThat(IndustryFamily.fromText(industry)).isEqualTo(expected);
    }

    @DisplayName("nhãn tiếng Việt người dùng có thể tự nhập")
    @ParameterizedTest(name = "{0} → {1}")
    @CsvSource({
            "'Du lịch',     SERVICE",
            "'Kỹ thuật',    OPERATIONS",
            "'Điều dưỡng',  HEALTHCARE",
            "'Nhà hàng',    GASTRONOMY",
            "'Bán lẻ',      RETAIL",
    })
    void mapsVietnameseLabels(String industry, IndustryFamily expected) {
        assertThat(IndustryFamily.fromText(industry)).isEqualTo(expected);
    }

    @DisplayName("OPERATIONS phải được xét TRƯỚC IT — \"tech\" là chuỗi con của \"technik\"")
    @Test
    void operationsWinsOverItForTechnik() {
        assertThat(IndustryFamily.fromText("Technik")).isEqualTo(IndustryFamily.OPERATIONS);
        // Nhưng "tech" trần vẫn phải là IT — thứ tự mới không được cướp mất nhánh cũ.
        assertThat(IndustryFamily.fromText("tech startup")).isEqualTo(IndustryFamily.IT);
        assertThat(IndustryFamily.fromText("Software Entwickler")).isEqualTo(IndustryFamily.IT);
    }

    @DisplayName("token ngắn không được khớp chuỗi con")
    @Test
    void shortCodesMatchWholeTokensOnly() {
        assertThat(IndustryFamily.fromText("IT")).isEqualTo(IndustryFamily.IT);
        assertThat(IndustryFamily.fromText("edit")).isEqualTo(IndustryFamily.EDUCATION);
        assertThat(IndustryFamily.fromText("comcast")).isEqualTo(IndustryFamily.EDUCATION);
    }

    @DisplayName("đầu vào rỗng/null → EDUCATION (mentor generalist, FREE luôn mở)")
    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = { "   ", "\t" })
    void blankFallsBackToEducation(String industry) {
        assertThat(IndustryFamily.fromText(industry)).isEqualTo(IndustryFamily.EDUCATION);
    }

    @DisplayName("chuỗi dài bất thường bị bỏ qua thay vì quét")
    @Test
    void pathologicallyLongInputIsIgnored() {
        String tooLong = "Pflege".repeat(50); // > MAX_SCAN_LENGTH (200)
        assertThat(tooLong.length()).isGreaterThan(200);
        assertThat(IndustryFamily.fromText(tooLong)).isEqualTo(IndustryFamily.EDUCATION);
    }

    @DisplayName("không phân biệt hoa thường")
    @Test
    void isCaseInsensitive() {
        assertThat(IndustryFamily.fromText("TOURISMUS")).isEqualTo(IndustryFamily.SERVICE);
        assertThat(IndustryFamily.fromText("technik")).isEqualTo(IndustryFamily.OPERATIONS);
    }
}
