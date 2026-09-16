package com.deutschflow.testsupport;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static com.deutschflow.testsupport.PdfTextAssert.assertThatPdfText;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Trợ giúp so khớp văn bản PDF: phải chịu được ngắt dòng mà KHÔNG nới lỏng phép kiểm.
 *
 * <p>Ca đầu tiên dựng lại đúng hình dạng lỗi đã quan sát trên CI 15/09/2026 (PR #661) — nhờ vậy
 * chứng minh được bản vá mà không phải chờ lỗi ngẫu nhiên tái hiện.
 */
@DisplayName("PdfTextAssert")
class PdfTextAssertTest {

    /** Đúng hình dạng đã quan sát: hai ký tự đầu của mã phiếu nằm ở dòng trước. */
    private static final String PDF_BI_GAY_DONG = """
            TT Phiếu ff
            e61285 DEUTSCHFLOW
            Đối tác đào tạo DeutschFlow
            Lớp: B1 tối — d8caaf
            """;

    @Test
    @DisplayName("chuỗi bị ngắt dòng giữa chừng vẫn được coi là có mặt")
    void contains_needleSplitAcrossLines_passes() {
        assertThatCode(() -> assertThatPdfText(PDF_BI_GAY_DONG).contains("TT Phiếu ffe61285"))
                .doesNotThrowAnyException();
    }

    @Test
    @DisplayName("HỒI QUY: cách so cũ đỏ đúng ở ca đó — đây chính là lỗi cần vá")
    void plainContains_wouldHaveFailed_onTheSameText() {
        assertThat(PDF_BI_GAY_DONG)
                .as("bằng chứng: phép so thẳng KHÔNG thấy chuỗi, dù mã phiếu có đủ trong PDF")
                .doesNotContain("TT Phiếu ffe61285");
    }

    @Test
    @DisplayName("KHÔNG nới lỏng: chuỗi thật sự vắng mặt thì vẫn đỏ")
    void contains_missingNeedle_stillFails() {
        assertThatThrownBy(() -> assertThatPdfText(PDF_BI_GAY_DONG).contains("Mã phiếu: 99999999"))
                .isInstanceOf(AssertionError.class)
                .hasMessageContaining("Mã phiếu: 99999999");
    }

    @Test
    @DisplayName("KHÔNG nới lỏng: thứ tự ký tự vẫn phải đúng")
    void contains_scrambledNeedle_stillFails() {
        assertThatThrownBy(() -> assertThatPdfText(PDF_BI_GAY_DONG).contains("e61285ff Phiếu TT"))
                .isInstanceOf(AssertionError.class);
    }

    @Test
    @DisplayName("NGHIÊM HƠN trước: bí mật bị ngắt dòng giữa chừng vẫn bị bắt")
    void doesNotContain_secretSplitAcrossLines_isCaught() {
        String pdf = "Ghi chú nội bộ: sk-live-ab\ncd1234 — không được in ra phiếu";

        // Cách so cũ cho lọt, vì trong văn bản gốc chuỗi đã bị cắt làm đôi.
        assertThat(pdf).doesNotContain("sk-live-abcd1234");

        assertThatThrownBy(() -> assertThatPdfText(pdf).doesNotContain("sk-live-abcd1234"))
                .isInstanceOf(AssertionError.class)
                .hasMessageContaining("kể cả khi bị ngắt dòng");
    }

    @Test
    @DisplayName("bí mật thật sự vắng mặt thì vẫn xanh")
    void doesNotContain_absentSecret_passes() {
        assertThatCode(() -> assertThatPdfText(PDF_BI_GAY_DONG).doesNotContain("sk-live-abcd1234"))
                .doesNotThrowAnyException();
    }

    @Test
    @DisplayName("văn bản null coi như rỗng, không ném NullPointerException giữa lúc chẩn lỗi")
    void nullText_isTreatedAsEmpty() {
        assertThatCode(() -> assertThatPdfText(null).doesNotContain("bất kỳ"))
                .doesNotThrowAnyException();
        assertThat(PdfTextAssert.flatten(null)).isEmpty();
    }

    @Test
    @DisplayName("thông báo lỗi in kèm văn bản PDF để chẩn được ngay")
    void failureMessage_includesPdfText() {
        assertThatThrownBy(() -> assertThatPdfText(PDF_BI_GAY_DONG).contains("không có chuỗi này"))
                .hasMessageContaining("Đối tác đào tạo DeutschFlow");
    }
}
