package com.deutschflow.teacher.service;

import com.deutschflow.teacher.entity.StudentReportIssue;
import lombok.RequiredArgsConstructor;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDFont;
import org.apache.pdfbox.pdmodel.font.PDType0Font;
import org.springframework.stereotype.Component;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.text.NumberFormat;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Vẽ phiếu đánh giá gửi gia đình thành PDF <b>A4 DỌC</b> (thiết kế 10/09/2026 §3.3–3.4) từ
 * {@link StudentReportIssue} — đọc {@code payload_json} đã đóng băng + các cột snapshot, KHÔNG chạm
 * bảng nguồn. PDFBox 3 + Plus Jakarta Sans nhúng (cùng font đã vá tiếng Việt ở
 * {@code CertificateController.renderPdf}, F-UTF-03): đủ glyph cho dấu tiếng Việt và ß/ä/ö/ü; ký tự
 * font không có (chữ Hán, emoji) thay bằng '?' thay vì vỡ cả file.
 *
 * <p>Nhãn ba ngôn ngữ qua {@link ReportI18n}; số liệu và nhận xét giáo viên in nguyên văn theo payload
 * (không dịch máy — §5). Logo trung tâm KHÔNG nhúng vào PDF: nhúng nghĩa là backend phải tải một URL
 * ngoài lúc render (độ trễ + bề mặt SSRF); PDF co-brand bằng TÊN trung tâm, logo hiển thị trên trang
 * web công khai (PR-R3). Không lưu S3; controller trả attachment {@code Cache-Control: no-store}.
 *
 * <p>Bố cục chảy theo con trỏ {@code y}; nhận xét dài tự sang trang, chân trang (mã phiếu, link xác
 * thực, người phát hành, hai dòng kẻ ký tay — R7) đi theo nội dung ở trang cuối; số trang đóng sau cùng.
 */
@Component
@RequiredArgsConstructor
public class ReportPdfRenderer {

    static final float PAGE_W = PDRectangle.A4.getWidth();
    static final float PAGE_H = PDRectangle.A4.getHeight();
    static final float MARGIN = 48f;
    static final float CONTENT_W = PAGE_W - 2 * MARGIN;
    /** Dưới mốc này thì sang trang — đủ chỗ cho số trang. */
    static final float BOTTOM = 56f;

    private static final ZoneId ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    private static final float[] INK = {0.10f, 0.10f, 0.12f};
    private static final float[] MUTED = {0.45f, 0.45f, 0.48f};
    private static final float[] ACCENT = {0.05f, 0.42f, 0.42f};
    private static final float[] BAR_BG = {0.90f, 0.91f, 0.92f};
    private static final float[] RULE = {0.80f, 0.80f, 0.82f};
    private static final float[] DANGER = {0.85f, 0.16f, 0.11f};

    private final ReportI18n i18n;

    /** @param publicUrl link xác thực đầy đủ (domain web + {@code /phieu/{token}?lang=…}) in ở chân trang. */
    public byte[] render(StudentReportIssue issue, String publicUrl) throws IOException {
        String lang = ReportI18n.normalize(issue.getLang());
        Map<String, Object> p = issue.getPayload() == null ? Map.of() : issue.getPayload();
        Locale numLocale = Locale.forLanguageTag(lang);

        try (PDDocument doc = new PDDocument(); Canvas c = new Canvas(doc)) {
            // ── Đầu trang: co-brand ──────────────────────────────────────────
            String orgName = issue.getOrgNameSnapshot();
            c.text(MARGIN, c.y - 14, c.bold, 15, orgName != null ? orgName : "DeutschFlow", INK);
            String brand = "DEUTSCHFLOW";
            c.text(PAGE_W - MARGIN - c.width(c.bold, 9, brand), c.y - 12, c.bold, 9, brand, MUTED);
            c.y -= 18;
            if (orgName != null) {
                c.text(MARGIN, c.y - 10, c.italic, 9, t(lang, "report.partner"), MUTED);
                c.y -= 12;
            }
            c.rule();

            // ── Tiêu đề + kỳ ─────────────────────────────────────────────────
            c.y -= 20;
            c.text(MARGIN, c.y, c.bold, 18, t(lang, "report.title"), ACCENT);
            c.y -= 16;
            c.text(MARGIN, c.y, c.regular, 12, t(lang, "report.period." + issue.getPeriod().name()), MUTED);
            if (issue.isRevoked()) {
                c.y -= 15;
                c.text(MARGIN, c.y, c.bold, 11, t(lang, "report.revoked"), DANGER);
            }
            c.y -= 16;

            // ── Thông tin lớp / học viên: hai cột ────────────────────────────
            Map<String, Object> cls = map(p.get("class"));
            Map<String, Object> student = map(p.get("student"));
            float leftX = MARGIN;
            float rightX = MARGIN + CONTENT_W / 2 + 8;
            float top = c.y;
            float yl = c.labelValue(leftX, top, t(lang, "report.class"), str(cls.get("name")));
            String level = str(cls.get("level"));
            if (level != null) {
                yl = c.labelValue(leftX, yl, t(lang, "report.level"), level);
            }
            yl = c.labelValue(leftX, yl, t(lang, "report.teacher"), str(cls.get("primaryTeacherName")));
            float yr = c.labelValue(rightX, top, t(lang, "report.student"), issue.getStudentNameSnapshot());
            yr = c.labelValue(rightX, yr, t(lang, "report.joinedAt"), formatIsoDate(str(student.get("joinedAt"))));
            yr = c.labelValue(rightX, yr, t(lang, "report.issuedAt"), formatInstant(issue.getIssuedAt()));
            c.y = Math.min(yl, yr) - 4;
            c.rule();

            // ── Bốn kỹ năng ──────────────────────────────────────────────────
            c.section(t(lang, "report.section.skills"));
            for (Object row : list(p.get("skills"))) {
                Map<String, Object> s = map(row);
                c.skillBar(t(lang, "report.skill." + str(s.get("code"))), num(s.get("score")),
                        gradeLabel(lang, str(s.get("grade"))), numLocale, false);
            }
            Map<String, Object> overall = map(p.get("overall"));
            c.skillBar(t(lang, "report.overall"), num(overall.get("score")),
                    gradeLabel(lang, str(overall.get("grade"))), numLocale, true);

            // ── Chuyên cần ───────────────────────────────────────────────────
            Map<String, Object> att = map(p.get("attendance"));
            c.section(t(lang, "report.section.attendance"));
            if (intOf(att.get("recorded")) > 0) {
                c.line(t(lang, "report.attendance.summary", intStr(att.get("present")), intStr(att.get("absent")),
                        intStr(att.get("late")), intStr(att.get("recorded"))));
                c.line(t(lang, "report.attendance.rate", intStr(att.get("ratePct"))));
            } else {
                c.line(t(lang, "report.attendance.none"));
            }

            // ── Bài tập ──────────────────────────────────────────────────────
            Map<String, Object> asg = map(p.get("assignments"));
            c.section(t(lang, "report.section.assignments"));
            if (intOf(asg.get("confirmed")) > 0) {
                c.line(t(lang, "report.assignments.avg", formatScore(num(asg.get("avgScore")), numLocale)));
            } else {
                c.line(t(lang, "report.assignments.none"));
            }
            c.line(t(lang, "report.assignments.counts", intStr(asg.get("confirmed")), intStr(asg.get("awaitingTeacher"))));

            // ── Mục tiêu giáo trình (ẩn nếu lớp không gắn giáo trình) ────────
            if (p.get("objectives") instanceof Map<?, ?>) {
                Map<String, Object> obj = map(p.get("objectives"));
                c.section(t(lang, "report.section.objectives"));
                c.line(t(lang, "report.objectives.counts", intStr(obj.get("achieved")), intStr(obj.get("needsPractice")),
                        intStr(obj.get("notAssessed")), intStr(obj.get("total"))));
                List<Object> items = list(obj.get("needsPracticeItems"));
                if (!items.isEmpty()) {
                    c.line(t(lang, "report.objectives.needsPractice"));
                    for (Object item : items) {
                        c.paragraph("•  " + str(item), MARGIN + 12, CONTENT_W - 12, c.regular, 10);
                    }
                }
            }

            // ── Tự học ngoài lớp ─────────────────────────────────────────────
            Map<String, Object> self = map(p.get("selfStudy"));
            c.section(t(lang, "report.section.selfStudy"));
            c.line(t(lang, "report.selfStudy.speaking", intStr(self.get("speakingSessions")), intStr(self.get("speakingMinutes"))));
            c.line(t(lang, "report.selfStudy.vocab", intStr(self.get("vocabMastered"))));
            c.line(t(lang, "report.selfStudy.lessons", intStr(self.get("lessonsCompleted"))));

            // ── Nhận xét của giáo viên — nguyên văn ──────────────────────────
            c.section(t(lang, "report.section.comment"));
            String comment = str(p.get("teacherComment"));
            if (comment == null) {
                c.text(MARGIN, c.y, c.italic, 10, t(lang, "report.comment.none"), MUTED);
                c.y -= 14;
            } else {
                for (String para : comment.replace("\r", "").split("\n")) {
                    if (para.isBlank()) {
                        c.y -= 6;
                        continue;
                    }
                    c.paragraph(para, MARGIN, CONTENT_W, c.regular, 10);
                }
            }

            // ── Điều kiện chứng nhận — chỉ FINAL (R10) ───────────────────────
            if (p.get("certificate") instanceof Map<?, ?>) {
                Map<String, Object> cert = map(p.get("certificate"));
                c.section(t(lang, "report.section.certificate"));
                boolean eligible = Boolean.TRUE.equals(cert.get("eligible"));
                c.text(MARGIN, c.y, c.bold, 10, t(lang, eligible ? "report.certificate.eligible" : "report.certificate.notEligible"),
                        eligible ? ACCENT : INK);
                c.y -= 14;
                c.line(t(lang, "report.certificate.thresholds", intStr(cert.get("minAvgScore")), intStr(cert.get("minAttendancePct"))));
            }

            // ── Chân trang: xác thực + chữ ký tay (R7) ───────────────────────
            c.ensure(140);
            c.y -= 6;
            c.rule();
            c.y -= 14;
            String code = ReportIssueService.verificationCodeOf(issue.getToken());
            c.text(MARGIN, c.y, c.bold, 10, t(lang, "report.verification.code") + ": " + (code == null ? "—" : code), INK);
            c.y -= 13;
            c.paragraph(t(lang, "report.verification.url") + ": " + publicUrl, MARGIN, CONTENT_W, c.regular, 9);
            c.text(MARGIN, c.y, c.regular, 9, t(lang, "report.verification.validUntil") + ": " + formatInstant(issue.getTokenExpiresAt()), MUTED);
            c.y -= 12;
            String issuer = issue.getIssuedByNameSnapshot();
            c.text(MARGIN, c.y, c.regular, 9, t(lang, "report.issuedBy") + ": " + (issuer == null ? "—" : issuer), MUTED);
            c.y -= 28;
            float sigW = 180f;
            c.hline(MARGIN, MARGIN + sigW, c.y, RULE);
            c.hline(PAGE_W - MARGIN - sigW, PAGE_W - MARGIN, c.y, RULE);
            c.y -= 11;
            c.text(MARGIN, c.y, c.regular, 9, t(lang, "report.sign.teacher"), MUTED);
            String center = t(lang, "report.sign.center");
            c.text(PAGE_W - MARGIN - sigW, c.y, c.regular, 9, center, MUTED);
            c.y -= 15;
            c.paragraph(t(lang, "report.footer"), MARGIN, CONTENT_W, c.italic, 8);

            c.stampPageNumbers(lang);
            c.close();
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            doc.save(out);
            return out.toByteArray();
        }
    }

    // ── nhãn & định dạng ─────────────────────────────────────────────────────

    private String t(String lang, String key, Object... args) {
        return i18n.t(lang, key, args);
    }

    private String gradeLabel(String lang, String code) {
        return t(lang, "report.grade." + (code == null ? "NONE" : code));
    }

    static String formatScore(Double v, Locale locale) {
        if (v == null) {
            return "—";
        }
        NumberFormat nf = NumberFormat.getNumberInstance(locale);
        nf.setMinimumFractionDigits(1);
        nf.setMaximumFractionDigits(1);
        return nf.format(v);
    }

    static String formatInstant(Instant at) {
        return at == null ? "—" : DATE.format(at.atZone(ZONE));
    }

    static String formatIsoDate(String iso) {
        if (iso == null) {
            return "—";
        }
        try {
            return DATE.format(LocalDate.parse(iso));
        } catch (RuntimeException ex) {
            return iso;
        }
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> map(Object o) {
        return o instanceof Map<?, ?> m ? (Map<String, Object>) m : Map.of();
    }

    @SuppressWarnings("unchecked")
    private static List<Object> list(Object o) {
        return o instanceof List<?> l ? (List<Object>) l : List.of();
    }

    private static String str(Object o) {
        if (o == null) {
            return null;
        }
        String s = String.valueOf(o);
        return s.isBlank() ? null : s;
    }

    private static Double num(Object o) {
        return o instanceof Number n ? n.doubleValue() : null;
    }

    private static int intOf(Object o) {
        return o instanceof Number n ? n.intValue() : 0;
    }

    private static String intStr(Object o) {
        return o instanceof Number n ? String.valueOf(n.intValue()) : "—";
    }

    /** Thay code point font không mã hoá được bằng '?' (cùng khuôn CertificateController.safeText). */
    static String safeText(PDFont font, String text) {
        if (text == null) {
            return "";
        }
        StringBuilder sb = new StringBuilder(text.length());
        text.codePoints().forEach(cp -> {
            if (cp == '\t') {
                sb.append(' ');
                return;
            }
            if (Character.isISOControl(cp)) {
                return;
            }
            String ch = new String(Character.toChars(cp));
            try {
                font.encode(ch);
                sb.append(ch);
            } catch (Exception e) {
                sb.append('?');
            }
        });
        return sb.toString();
    }

    // ── canvas: trang, font, con trỏ y ───────────────────────────────────────

    /** Con trỏ vẽ theo dòng; tự sang trang khi hết chỗ. Không thread-safe (mỗi lần render một canvas). */
    static final class Canvas implements AutoCloseable {
        final PDDocument doc;
        final PDFont regular;
        final PDFont bold;
        final PDFont italic;
        final List<PDPage> pages = new ArrayList<>();
        PDPageContentStream cs;
        float y;

        Canvas(PDDocument doc) throws IOException {
            this.doc = doc;
            this.regular = loadFont(doc, "PlusJakartaSans-Regular.ttf");
            this.bold = loadFont(doc, "PlusJakartaSans-Bold.ttf");
            this.italic = loadFont(doc, "PlusJakartaSans-Italic.ttf");
            newPage();
        }

        void newPage() throws IOException {
            if (cs != null) {
                cs.close();
            }
            PDPage page = new PDPage(PDRectangle.A4);
            doc.addPage(page);
            pages.add(page);
            cs = new PDPageContentStream(doc, page);
            y = PAGE_H - MARGIN;
        }

        void ensure(float height) throws IOException {
            if (y - height < BOTTOM) {
                newPage();
            }
        }

        float width(PDFont font, float size, String text) throws IOException {
            return font.getStringWidth(safeText(font, text)) / 1000f * size;
        }

        void text(float x, float baseline, PDFont font, float size, String text, float[] rgb) throws IOException {
            cs.setNonStrokingColor(rgb[0], rgb[1], rgb[2]);
            cs.beginText();
            cs.setFont(font, size);
            cs.newLineAtOffset(x, baseline);
            cs.showText(safeText(font, text));
            cs.endText();
        }

        /** Tiêu đề mục: chữ accent + kẻ mảnh; xuống dòng sẵn cho nội dung. */
        void section(String title) throws IOException {
            ensure(40);
            y -= 10;
            text(MARGIN, y, bold, 11, title, ACCENT);
            y -= 4;
            hline(MARGIN, MARGIN + CONTENT_W, y, RULE);
            y -= 13;
        }

        /** Một dòng nội dung 10pt; dài quá thì tự bọc. */
        void line(String s) throws IOException {
            paragraph(s, MARGIN, CONTENT_W, regular, 10);
        }

        /** Nhãn mờ + giá trị đậm trên cùng một dòng; trả về y của dòng kế. */
        float labelValue(float x, float baseline, String label, String value) throws IOException {
            text(x, baseline, regular, 9, label + ":", MUTED);
            float lw = width(regular, 9, label + ":") + 4;
            text(x + lw, baseline, bold, 10, value == null ? "—" : value, INK);
            return baseline - 15;
        }

        void paragraph(String textBlock, float x, float maxWidth, PDFont font, float size) throws IOException {
            float leading = size * 1.35f;
            for (String ln : wrap(font, size, textBlock, maxWidth)) {
                ensure(leading);
                text(x, y, font, size, ln, INK);
                y -= leading;
            }
        }

        List<String> wrap(PDFont font, float size, String text, float maxWidth) throws IOException {
            List<String> out = new ArrayList<>();
            String safe = safeText(font, text == null ? "" : text);
            StringBuilder current = new StringBuilder();
            for (String word : safe.split(" ")) {
                String candidate = current.length() == 0 ? word : current + " " + word;
                if (font.getStringWidth(candidate) / 1000f * size <= maxWidth) {
                    current.setLength(0);
                    current.append(candidate);
                    continue;
                }
                if (current.length() > 0) {
                    out.add(current.toString());
                    current.setLength(0);
                }
                // Từ đơn dài hơn cả dòng (URL, chuỗi không dấu cách): cắt cứng theo ký tự.
                String rest = word;
                while (font.getStringWidth(rest) / 1000f * size > maxWidth && rest.length() > 1) {
                    int cut = rest.length();
                    while (cut > 1 && font.getStringWidth(rest.substring(0, cut)) / 1000f * size > maxWidth) {
                        cut--;
                    }
                    out.add(rest.substring(0, cut));
                    rest = rest.substring(cut);
                }
                current.append(rest);
            }
            if (current.length() > 0 || out.isEmpty()) {
                out.add(current.toString());
            }
            return out;
        }

        /** Nhãn kỹ năng · thanh 0–10 · điểm · xếp loại trên một dòng. */
        void skillBar(String label, Double score, String grade, Locale locale, boolean emphasis) throws IOException {
            ensure(20);
            float barX = MARGIN + 150;
            float barW = 200;
            float barH = 7;
            float baseline = y - 9;
            text(MARGIN, baseline, emphasis ? bold : regular, 10, label, INK);
            cs.setNonStrokingColor(BAR_BG[0], BAR_BG[1], BAR_BG[2]);
            cs.addRect(barX, baseline - 1, barW, barH);
            cs.fill();
            if (score != null) {
                float ratio = (float) Math.max(0, Math.min(10, score)) / 10f;
                cs.setNonStrokingColor(ACCENT[0], ACCENT[1], ACCENT[2]);
                cs.addRect(barX, baseline - 1, barW * ratio, barH);
                cs.fill();
            }
            text(barX + barW + 12, baseline, bold, 10, score == null ? "—" : formatScore(score, locale), INK);
            text(barX + barW + 52, baseline, regular, 9, grade, MUTED);
            y -= 16;
        }

        void hline(float x1, float x2, float at, float[] rgb) throws IOException {
            cs.setStrokingColor(rgb[0], rgb[1], rgb[2]);
            cs.setLineWidth(0.7f);
            cs.moveTo(x1, at);
            cs.lineTo(x2, at);
            cs.stroke();
        }

        void rule() throws IOException {
            hline(MARGIN, MARGIN + CONTENT_W, y, RULE);
        }

        /** "Trang i/n" ở góc dưới phải mọi trang — mở lại content stream ở chế độ APPEND. */
        void stampPageNumbers(String lang) throws IOException {
            cs.close();
            cs = null;
            int total = pages.size();
            for (int i = 0; i < total; i++) {
                String s = pageLabel(lang, i + 1, total);
                try (PDPageContentStream ps = new PDPageContentStream(doc, pages.get(i),
                        PDPageContentStream.AppendMode.APPEND, true)) {
                    ps.setNonStrokingColor(MUTED[0], MUTED[1], MUTED[2]);
                    ps.beginText();
                    ps.setFont(regular, 8);
                    ps.newLineAtOffset(PAGE_W - MARGIN - regular.getStringWidth(s) / 1000f * 8, 30);
                    ps.showText(s);
                    ps.endText();
                }
            }
        }

        private static String pageLabel(String lang, int page, int total) {
            return switch (lang) {
                case "en" -> "Page " + page + "/" + total;
                case "de" -> "Seite " + page + "/" + total;
                default -> "Trang " + page + "/" + total;
            };
        }

        @Override
        public void close() throws IOException {
            if (cs != null) {
                cs.close();
                cs = null;
            }
        }

        private static PDFont loadFont(PDDocument doc, String file) throws IOException {
            try (InputStream in = ReportPdfRenderer.class.getResourceAsStream("/fonts/" + file)) {
                if (in == null) {
                    throw new IllegalStateException("Thiếu font nhúng /fonts/" + file);
                }
                return PDType0Font.load(doc, in);
            }
        }
    }
}
