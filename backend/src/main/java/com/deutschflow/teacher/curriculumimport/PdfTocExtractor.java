package com.deutschflow.teacher.curriculumimport;

import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.teacher.curriculumimport.ocr.OcrProvider;
import lombok.extern.slf4j.Slf4j;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.rendering.PDFRenderer;
import org.apache.pdfbox.text.PDFTextStripper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

/**
 * Pulls the text of a document's front matter — where a table of contents lives — and nothing else.
 *
 * <p>Two hard limits define this class. It reads at most {@code maxScanPages} pages, so a 176-page
 * coursebook costs the same as a 20-page booklet and the body of the book is never processed; and it
 * only rasterises when the PDF has no usable text layer, because a born-digital file's own text is
 * both faster and more accurate than any OCR of it.
 *
 * <p>The document is treated as untrusted data throughout: it is read, never executed, and the text
 * that comes out is only ever matched against {@link TocParser}'s fixed patterns.
 */
@Component
@Slf4j
public class PdfTocExtractor {

    /** Below this many characters a page's text layer is decoration (page numbers), not content. */
    private static final int USABLE_TEXT_THRESHOLD = 40;

    private final OcrProvider ocrProvider;
    private final int maxScanPages;
    private final int maxDocumentPages;
    private final int renderDpi;

    public PdfTocExtractor(
            OcrProvider ocrProvider,
            @Value("${curriculum.import.max-scan-pages:12}") int maxScanPages,
            @Value("${curriculum.import.max-document-pages:600}") int maxDocumentPages,
            @Value("${curriculum.import.ocr.render-dpi:150}") int renderDpi) {
        this.ocrProvider = ocrProvider;
        this.maxScanPages = maxScanPages;
        this.maxDocumentPages = maxDocumentPages;
        this.renderDpi = renderDpi;
    }

    /**
     * @param text     concatenated text of the scanned front-matter pages
     * @param usedOcr  whether recognition was needed (drives the preview's provenance note)
     * @param pagesRead how many pages were actually looked at
     */
    public record Extraction(String text, boolean usedOcr, int pagesRead, List<String> warnings) {}

    public Extraction extract(byte[] pdfBytes, String languageTag) {
        List<String> warnings = new ArrayList<>();

        try (PDDocument doc = Loader.loadPDF(pdfBytes)) {
            int pageCount = doc.getNumberOfPages();
            if (pageCount > maxDocumentPages) {
                throw new BadRequestException(
                        "Tài liệu có " + pageCount + " trang, vượt giới hạn " + maxDocumentPages + " trang.");
            }
            int scanTo = Math.min(pageCount, maxScanPages);

            StringBuilder text = new StringBuilder();
            List<Integer> emptyPages = new ArrayList<>();
            boolean hasTextLayer = false;

            PDFTextStripper stripper = new PDFTextStripper();
            for (int page = 1; page <= scanTo; page++) {
                stripper.setStartPage(page);
                stripper.setEndPage(page);
                String pageText = stripper.getText(doc);
                if (pageText != null && pageText.strip().length() >= USABLE_TEXT_THRESHOLD) {
                    hasTextLayer = true;
                    text.append(pageText).append('\n');
                } else {
                    if (pageText != null) text.append(pageText).append('\n');
                    emptyPages.add(page);
                }
            }

            // The decision is per DOCUMENT, not per page. A born-digital book has text on its
            // content pages and almost none on its cover; OCR-ing the cover because it is sparse
            // would burn a rasterisation to recover a title we already have. Only a document with
            // no usable text layer anywhere in its front matter is treated as a scan.
            if (hasTextLayer || emptyPages.isEmpty()) {
                return new Extraction(text.toString(), false, scanTo, List.copyOf(warnings));
            }
            List<Integer> needOcr = emptyPages;
            if (!ocrProvider.isAvailable()) {
                // A normal deployment state, not a fault: say so plainly and let the wizard fall
                // back to a managed template instead of failing the import.
                warnings.add("Máy chủ chưa cài công cụ nhận dạng ký tự (OCR) nên không đọc được tài "
                        + "liệu scan. Hãy chọn một giáo trình mẫu, hoặc nhờ quản trị viên cài đặt OCR.");
                return new Extraction(text.toString(), false, scanTo, List.copyOf(warnings));
            }

            PDFRenderer renderer = new PDFRenderer(doc);
            int recognised = 0;
            for (int page : needOcr) {
                try {
                    BufferedImage image = renderer.renderImageWithDPI(page - 1, renderDpi);
                    ByteArrayOutputStream png = new ByteArrayOutputStream();
                    ImageIO.write(image, "png", png);
                    String pageText = ocrProvider.ocrPage(png.toByteArray(), languageTag);
                    if (pageText != null && !pageText.isBlank()) {
                        text.append(pageText).append('\n');
                        recognised++;
                    }
                } catch (OcrProvider.OcrException | IOException e) {
                    // One unreadable page must not sink the import — the others may still carry the
                    // contents. The page number is logged; the document's content never is.
                    log.warn("OCR failed on front-matter page {} ({})", page, e.toString());
                    warnings.add("Không đọc được trang " + page + " của tài liệu.");
                }
            }
            if (recognised == 0) {
                warnings.add("Không nhận dạng được nội dung nào ở phần đầu tài liệu.");
            }
            return new Extraction(text.toString(), recognised > 0, scanTo, List.copyOf(warnings));

        } catch (BadRequestException e) {
            throw e;
        } catch (IOException e) {
            throw new BadRequestException("Không đọc được tệp PDF. Tệp có thể hỏng hoặc được bảo vệ.");
        }
    }
}
