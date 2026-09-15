package com.deutschflow.grammar.controller;

import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.font.Standard14Fonts;
import org.apache.pdfbox.text.PDFTextStripper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * F-UTF-03 (audit UTF-8 06/09/2026): PDF chứng nhận từng vẽ tên bằng Helvetica Standard-14
 * (WinAnsi) → tên có dấu tiếng Việt làm PDFBox ném lỗi, endpoint trả 500. Nay nhúng
 * Plus Jakarta Sans (đủ glyph Việt) và thay ký tự không có glyph bằng '?'.
 */
class CertificateControllerPdfTest {

    private static final String VN_NAME = "Nguyễn Thị Ánh Nguyệt Đỗ";

    @Test
    @DisplayName("renderPdf: tên học viên có dấu tiếng Việt vẽ được và trích xuất lại đúng chữ")
    void rendersVietnameseName() throws Exception {
        byte[] pdf = CertificateController.renderPdf(VN_NAME, "B1", 87, "DF-B1-TEST01", "06/09/2026");

        assertThat(pdf).isNotEmpty();
        try (PDDocument doc = Loader.loadPDF(pdf)) {
            String text = new PDFTextStripper().getText(doc);
            assertThat(text).contains(VN_NAME)
                    .contains("CERTIFICATE OF ACHIEVEMENT")
                    .contains("Exam Score: 87 / 100")
                    .contains("DF-B1-TEST01");
        }
    }

    @Test
    @DisplayName("renderPdf: ký tự font không có glyph (chữ Hán) thành '?' thay vì vỡ cả file")
    void replacesGlyphlessCharactersInsteadOfFailing() throws Exception {
        byte[] pdf = CertificateController.renderPdf("李明 Nguyễn", "A2", 70, "DF-A2-TEST02", "06/09/2026");

        try (PDDocument doc = Loader.loadPDF(pdf)) {
            String text = new PDFTextStripper().getText(doc);
            assertThat(text).contains("?? Nguyễn");
        }
    }

    @Test
    @DisplayName("Bằng chứng lỗi cũ: Helvetica Standard-14 không mã hoá được 'ễ'/'Đ'")
    void helveticaCannotEncodeVietnamese() {
        var helvetica = new PDType1Font(Standard14Fonts.FontName.HELVETICA_BOLD);
        assertThatThrownBy(() -> helvetica.encode("ễ")).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> helvetica.encode("Đ")).isInstanceOf(IllegalArgumentException.class);
    }
}
