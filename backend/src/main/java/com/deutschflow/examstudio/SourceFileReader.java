package com.deutschflow.examstudio;

import com.deutschflow.common.exception.BadRequestException;
import lombok.extern.slf4j.Slf4j;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDDocumentInformation;
import org.apache.pdfbox.text.PDFTextStripper;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.apache.poi.xwpf.usermodel.XWPFParagraph;
import org.springframework.stereotype.Component;

import java.io.ByteArrayInputStream;
import java.nio.ByteBuffer;
import java.nio.charset.CharacterCodingException;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Đọc tệp nguồn admin tải lên Xưởng đề (PDF, DOCX, TXT) thành văn bản thuần.
 *
 * <p>Nhiều nguồn mở (bài khoa học, báo cáo cơ quan nhà nước) chỉ có toàn văn ở dạng PDF; trang web của
 * chúng chỉ là trang giới thiệu nên {@link SourceFetcher} không đọc được. Tệp và văn bản bóc ra chỉ sống
 * trong bộ nhớ, giống văn bản dán tay: không ghi DB, không ghi đĩa.
 *
 * <p>Giới hạn: 10 MB, PDF tối đa 80 trang; loại tệp xét theo nội dung (chữ ký đầu tệp), không tin phần
 * mở rộng hay Content-Type của trình duyệt.
 */
@Slf4j
@Component
public class SourceFileReader {

    static final int MAX_BYTES = 10 * 1024 * 1024;
    static final int MAX_PDF_PAGES = 80;
    static final int MIN_TEXT_CHARS = 300;
    /** Trần văn bản giữ lại sau khi bóc — đủ cho một bài khoa học, không để một tệp khổng lồ vào hàng job. */
    static final int MAX_TEXT_CHARS = 120_000;

    public record Extracted(String text, String title, String author, String licenseText, boolean ccBy) {}

    public Extracted read(String fileName, byte[] bytes) {
        if (bytes == null || bytes.length == 0) throw new BadRequestException("Tệp trống.");
        if (bytes.length > MAX_BYTES) throw new BadRequestException("Tệp lớn hơn 10 MB.");

        String raw;
        String title = null;
        String author = null;
        if (startsWith(bytes, "%PDF-")) {
            try (PDDocument pdf = Loader.loadPDF(bytes)) {
                if (pdf.isEncrypted()) throw new BadRequestException("PDF có mật khẩu, không đọc được.");
                PDDocumentInformation info = pdf.getDocumentInformation();
                if (info != null) {
                    title = blankToNull(info.getTitle());
                    author = blankToNull(info.getAuthor());
                }
                PDFTextStripper stripper = new PDFTextStripper();
                stripper.setSortByPosition(false);
                stripper.setEndPage(MAX_PDF_PAGES);
                raw = stripper.getText(pdf);
            } catch (BadRequestException e) {
                throw e;
            } catch (Exception e) {
                log.warn("[ExamStudio] không đọc được PDF {}: {}", fileName, e.toString());
                throw new BadRequestException("Không đọc được tệp PDF này (tệp hỏng hoặc có mật khẩu).");
            }
        } else if (startsWith(bytes, "PK")) {
            try (XWPFDocument docx = new XWPFDocument(new ByteArrayInputStream(bytes))) {
                StringBuilder sb = new StringBuilder();
                for (XWPFParagraph p : docx.getParagraphs()) {
                    String t = p.getText();
                    if (t != null && !t.isBlank()) sb.append(t.trim()).append("\n\n");
                }
                raw = sb.toString();
            } catch (Exception e) {
                log.warn("[ExamStudio] không đọc được DOCX {}: {}", fileName, e.toString());
                throw new BadRequestException("Không đọc được tệp này. Chỉ nhận PDF, DOCX hoặc TXT.");
            }
        } else {
            raw = decodeUtf8(bytes);
        }

        // Giấy phép dò trên văn bản gốc (chưa cắt mục tài liệu tham khảo, chưa nối dòng).
        String license = detectLicense(raw);
        String text = dropReferences(normalize(raw));
        if (text.length() > MAX_TEXT_CHARS) text = text.substring(0, MAX_TEXT_CHARS);
        if (text.length() < MIN_TEXT_CHARS) {
            throw new BadRequestException("Chỉ đọc được " + text.length() + " ký tự từ tệp (có thể là PDF ảnh quét). "
                    + "Hãy dán văn bản bài báo.");
        }
        return new Extracted(text, clean(title), clean(author), license, SourceFetcher.isPlainCcBy(license));
    }

    private static boolean startsWith(byte[] bytes, String magic) {
        byte[] m = magic.getBytes(StandardCharsets.US_ASCII);
        if (bytes.length < m.length) return false;
        for (int i = 0; i < m.length; i++) if (bytes[i] != m[i]) return false;
        return true;
    }

    private static String decodeUtf8(byte[] bytes) {
        int off = bytes.length >= 3 && (bytes[0] & 0xff) == 0xef && (bytes[1] & 0xff) == 0xbb
                && (bytes[2] & 0xff) == 0xbf ? 3 : 0;
        try {
            String s = StandardCharsets.UTF_8.newDecoder()
                    .onMalformedInput(CodingErrorAction.REPORT)
                    .onUnmappableCharacter(CodingErrorAction.REPORT)
                    .decode(ByteBuffer.wrap(bytes, off, bytes.length - off)).toString();
            if (s.indexOf('\u0000') >= 0) throw new CharacterCodingException();
            return s;
        } catch (CharacterCodingException e) {
            throw new BadRequestException("Không đọc được tệp này. Chỉ nhận PDF, DOCX hoặc TXT (UTF-8).");
        }
    }

    private static final Pattern HYPHEN_BREAK = Pattern.compile("(\\p{L})[-\\u00ad]\\n(\\p{Ll})");
    private static final Pattern PAGE_NUMBER_LINE = Pattern.compile("(?m)^\\s*\\d{1,4}\\s*$");

    /**
     * PDF ngắt dòng theo bề rộng trang: nối các dòng trong một đoạn, bỏ gạch nối cuối dòng, giữ dòng trống
     * làm ranh giới đoạn (AI ghi "đoạn số mấy" cho từng dữ kiện theo ranh giới này).
     */
    static String normalize(String raw) {
        String s = raw.replace("\r\n", "\n").replace('\r', '\n').replace(' ', ' ');
        s = PAGE_NUMBER_LINE.matcher(s).replaceAll("");
        s = HYPHEN_BREAK.matcher(s).replaceAll("$1$2");
        List<String> paras = new ArrayList<>();
        StringBuilder cur = new StringBuilder();
        for (String line : s.split("\n", -1)) {
            String t = line.trim().replaceAll("[ \\t]+", " ");
            boolean endOfPara = t.isEmpty();
            if (!t.isEmpty()) {
                if (cur.length() > 0) cur.append(' ');
                cur.append(t);
                // PDF thường không để dòng trống giữa các đoạn: dòng ngắn kết thúc bằng dấu câu là hết đoạn.
                endOfPara = t.length() < 60 && t.matches(".*[.!?:“\"»]$");
            }
            if (endOfPara && cur.length() > 0) {
                paras.add(cur.toString());
                cur.setLength(0);
            }
        }
        if (cur.length() > 0) paras.add(cur.toString());
        return String.join("\n\n", paras).trim();
    }

    private static final Pattern REFERENCES_HEADING = Pattern.compile(
            "(?m)^(?:\\d+\\.?\\s*)?(Literatur|Literaturverzeichnis|Quellenverzeichnis|References|Referenzen)\\s*$");

    /** Bỏ danh mục tài liệu tham khảo ở cuối bài khoa học: không có dữ kiện, chỉ tốn chỗ của AI. */
    static String dropReferences(String text) {
        Matcher m = REFERENCES_HEADING.matcher(text);
        int cut = -1;
        while (m.find()) cut = m.start();
        // Chỉ cắt khi mục này nằm ở nửa sau, tránh nhầm với một tiêu đề giữa bài.
        return cut > text.length() / 2 ? text.substring(0, cut).trim() : text;
    }

    private static final Pattern CC_URL = Pattern.compile(
            "creativecommons\\.org/licenses/([a-z\\-]+)/(\\d(?:\\.\\d)?)(/de)?", Pattern.CASE_INSENSITIVE);
    private static final Pattern CC_TEXT = Pattern.compile(
            "\\bCC[ -]BY(?:[ -](?:SA|NC|ND))*(?:[ -]\\d(?:\\.\\d)?)?(?:[ -]DE\\b)?", Pattern.CASE_INSENSITIVE);
    private static final Pattern CC_GERMAN = Pattern.compile(
            "Creative[ -]Commons[ -](?:Lizenz[ -])?Namensnennung((?:[ \\-–]+(?:Nicht[ -]?kommerziell|"
                    + "Keine[ -]Bearbeitung(?:en)?|Weitergabe[ -]unter[ -]gleichen[ -]Bedingungen))*)"
                    + "[ \\-–]*(\\d(?:\\.\\d)?)?", Pattern.CASE_INSENSITIVE);

    /** Dòng giấy phép Creative Commons trong văn bản; {@code null} nếu không thấy. Chỉ là phỏng đoán — admin xác nhận. */
    static String detectLicense(String raw) {
        if (raw == null) return null;
        // Nối dòng trước khi dò: dòng giấy phép trong PDF hay bị ngắt giữa chừng.
        String s = raw.replaceAll("\\s+", " ");
        Matcher u = CC_URL.matcher(s);
        if (u.find()) {
            return ("CC " + u.group(1).toUpperCase(Locale.ROOT) + " " + u.group(2)
                    + (u.group(3) != null ? " DE" : "")).trim();
        }
        Matcher t = CC_TEXT.matcher(s);
        if (t.find()) return t.group().toUpperCase(Locale.ROOT).replace('-', ' ').replaceAll("\\s+", " ").trim();
        Matcher g = CC_GERMAN.matcher(s);
        if (g.find()) {
            String mods = g.group(1) == null ? "" : g.group(1).toLowerCase(Locale.ROOT);
            StringBuilder sb = new StringBuilder("CC BY");
            if (mods.contains("kommerziell")) sb.append(" NC");
            if (mods.contains("bearbeitung")) sb.append(" ND");
            if (mods.contains("weitergabe")) sb.append(" SA");
            if (g.group(2) != null) sb.append(' ').append(g.group(2));
            return sb.toString();
        }
        return null;
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }

    /** Siêu dữ liệu PDF hay chứa tên tệp hoặc tên phần mềm thay cho tiêu đề thật — bỏ những giá trị đó. */
    private static String clean(String s) {
        if (s == null) return null;
        String t = s.replaceAll("\\s+", " ").trim();
        if (t.length() < 4 || t.matches("(?i).*\\.(pdf|docx?|indd|qxp)$") || t.matches("(?i)(untitled|microsoft word.*)")) {
            return null;
        }
        return t.length() > 300 ? t.substring(0, 300) : t;
    }
}
