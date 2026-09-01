package com.deutschflow.teacher.curriculumimport;

import com.deutschflow.teacher.curriculumimport.ocr.OcrProvider;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.font.Standard14Fonts;
import org.junit.jupiter.api.Test;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Getting text off the contents pages, and only those pages.
 *
 * <p>Two properties matter beyond "it reads the words": a born-digital PDF must never be sent
 * through OCR (it is slower and worse than the text layer already present), and a scan must never
 * cause the whole book to be rasterised — the extractor is capped at the front matter where a
 * table of contents lives.
 */
class PdfTocExtractorTest {

    /** Records what it was asked to recognise so the tests can assert the page budget. */
    private static final class FakeOcr implements OcrProvider {
        private final boolean available;
        private final String text;
        final AtomicInteger calls = new AtomicInteger();
        final List<Integer> sizes = new ArrayList<>();

        FakeOcr(boolean available, String text) {
            this.available = available;
            this.text = text;
        }

        @Override public String name() { return "fake"; }
        @Override public boolean isAvailable() { return available; }

        @Override
        public String ocrPage(byte[] imageBytes, String languageTag) {
            calls.incrementAndGet();
            sizes.add(imageBytes.length);
            return text;
        }
    }

    private static byte[] textPdf(List<String> pageTexts) throws IOException {
        try (PDDocument doc = new PDDocument()) {
            for (String pageText : pageTexts) {
                PDPage page = new PDPage();
                doc.addPage(page);
                try (PDPageContentStream cs = new PDPageContentStream(doc, page)) {
                    cs.beginText();
                    cs.setFont(new PDType1Font(Standard14Fonts.FontName.HELVETICA), 12);
                    cs.newLineAtOffset(50, 700);
                    for (String line : pageText.split("\n")) {
                        cs.showText(line);
                        cs.newLineAtOffset(0, -16);
                    }
                    cs.endText();
                }
            }
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            doc.save(out);
            return out.toByteArray();
        }
    }

    /** A PDF whose pages carry no text at all — the shape a scanned book has. */
    private static byte[] blankPdf(int pages) throws IOException {
        try (PDDocument doc = new PDDocument()) {
            for (int i = 0; i < pages; i++) doc.addPage(new PDPage());
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            doc.save(out);
            return out.toByteArray();
        }
    }

    @Test
    void readsTheTextLayerAndDoesNotCallOcr() throws IOException {
        FakeOcr ocr = new FakeOcr(true, "SHOULD NOT BE USED");
        PdfTocExtractor extractor = new PdfTocExtractor(ocr, 12, 200, 150);

        byte[] pdf = textPdf(List.of(
                "Titel",
                "Impressum",
                "Inhalt\n1 Erste Schritte 6\n2 Meine Stadt 16\nWortschatz Orte"));

        PdfTocExtractor.Extraction e = extractor.extract(pdf, "deu");

        assertThat(e.usedOcr()).isFalse();
        assertThat(ocr.calls.get()).isZero();
        assertThat(e.text()).contains("Erste Schritte").contains("Meine Stadt");
    }

    @Test
    void fallsBackToOcrWhenThereIsNoUsableTextLayer() throws IOException {
        FakeOcr ocr = new FakeOcr(true, "1 Erste Schritte 6\nWortschatz Orte");
        PdfTocExtractor extractor = new PdfTocExtractor(ocr, 4, 200, 120);

        PdfTocExtractor.Extraction e = extractor.extract(blankPdf(20), "deu");

        assertThat(e.usedOcr()).isTrue();
        assertThat(ocr.calls.get()).isEqualTo(4);
        assertThat(e.text()).contains("Erste Schritte");
    }

    @Test
    void neverRasterisesMoreThanTheConfiguredFrontMatter() throws IOException {
        FakeOcr ocr = new FakeOcr(true, "noise");
        PdfTocExtractor extractor = new PdfTocExtractor(ocr, 6, 200, 120);

        extractor.extract(blankPdf(176), "deu");

        // 176-page book, six-page budget: the other 170 pages are never touched.
        assertThat(ocr.calls.get()).isEqualTo(6);
    }

    @Test
    void scanningStopsAtTheDocumentEndForShortDocuments() throws IOException {
        FakeOcr ocr = new FakeOcr(true, "noise");
        PdfTocExtractor extractor = new PdfTocExtractor(ocr, 10, 200, 120);

        extractor.extract(blankPdf(3), "deu");

        assertThat(ocr.calls.get()).isEqualTo(3);
    }

    @Test
    void reportsAClearReasonWhenOcrIsNotInstalled() throws IOException {
        FakeOcr ocr = new FakeOcr(false, "");
        PdfTocExtractor extractor = new PdfTocExtractor(ocr, 8, 200, 120);

        PdfTocExtractor.Extraction e = extractor.extract(blankPdf(10), "deu");

        assertThat(e.usedOcr()).isFalse();
        assertThat(e.text()).isBlank();
        assertThat(e.warnings()).isNotEmpty();
        assertThat(ocr.calls.get()).isZero();
    }

    @Test
    void rejectsAFileThatIsNotAPdf() {
        PdfTocExtractor extractor = new PdfTocExtractor(new FakeOcr(true, ""), 8, 200, 120);

        assertThatThrownBy(() -> extractor.extract("not a pdf at all".getBytes(), "deu"))
                .isInstanceOf(com.deutschflow.common.exception.BadRequestException.class);
    }

    @Test
    void rejectsADocumentWithMorePagesThanTheCap() throws IOException {
        PdfTocExtractor extractor = new PdfTocExtractor(new FakeOcr(true, ""), 8, 5, 120);

        assertThatThrownBy(() -> extractor.extract(blankPdf(6), "deu"))
                .isInstanceOf(com.deutschflow.common.exception.BadRequestException.class);
    }
}
