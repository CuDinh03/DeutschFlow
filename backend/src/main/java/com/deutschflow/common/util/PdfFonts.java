package com.deutschflow.common.util;

import org.apache.fontbox.ttf.GlyphSubstitutionTable;
import org.apache.fontbox.ttf.TTFParser;
import org.apache.fontbox.ttf.TrueTypeFont;
import org.apache.pdfbox.io.RandomAccessReadBuffer;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.font.PDFont;
import org.apache.pdfbox.pdmodel.font.PDType0Font;

import java.io.IOException;
import java.io.InputStream;

/**
 * Nạp font nhúng {@code /fonts/*.ttf} cho PDF vẽ bằng PDFBox, giữ văn bản trong PDF đúng chữ.
 *
 * <p>Bảng GSUB bị bỏ TRƯỚC khi nạp. {@code showText} của PDFBox tự áp GSUB nên Plus Jakarta Sans thay
 * {@code ff}, {@code ffi}, {@code ffl}, {@code fi}, {@code fl} bằng glyph ghép. Ba glyph đầu không có
 * ánh xạ Unicode: mặt chữ vẫn đúng nhưng tìm kiếm, sao chép, trích văn bản mất chữ ("Treffen" thành
 * "Tre en"). Glyph ghép còn rộng khác tổng hai chữ {@code f}, trong khi {@code getStringWidth} không
 * áp GSUB, nên số đo bọc dòng lệch với chữ thật được vẽ. Không có GSUB thì mỗi ký tự giữ glyph riêng
 * và số đo khớp nguyên chữ.
 *
 * <p>Bỏ GSUB cũng mất {@code ccmp} (chồng dấu kết hợp), nên văn bản đưa vào phải chuẩn hoá NFC trước,
 * như {@code safeText} của từng nơi vẽ PDF.
 */
public final class PdfFonts {

    private PdfFonts() {}

    /** Font nhúng dạng tập con; {@code file} là tên tệp trong {@code /fonts}. */
    public static PDFont load(PDDocument doc, String file) throws IOException {
        try (InputStream in = PdfFonts.class.getResourceAsStream("/fonts/" + file)) {
            if (in == null) {
                throw new IllegalStateException("Thiếu font nhúng /fonts/" + file);
            }
            TrueTypeFont ttf = new TTFParser().parse(new RandomAccessReadBuffer(in));
            ttf.getTableMap().remove(GlyphSubstitutionTable.TAG);
            doc.registerTrueTypeFontForClosing(ttf);
            return PDType0Font.load(doc, ttf, true);
        }
    }
}
