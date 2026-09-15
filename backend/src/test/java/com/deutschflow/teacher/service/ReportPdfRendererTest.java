package com.deutschflow.teacher.service;

import com.deutschflow.teacher.entity.StudentReportIssue;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.text.PDFTextStripper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * PDF phiếu gửi gia đình (§3.3–3.4): A4 DỌC, font nhúng vẽ được dấu tiếng Việt lẫn ß/ä/ö/ü, ba ngôn ngữ
 * nhãn, nhận xét nguyên văn, khối chứng nhận chỉ FINAL, phiếu dài tự sang trang, phiếu thu hồi có dấu.
 */
class ReportPdfRendererTest {

    private static final String VN_NAME = "Nguyễn Thị Ánh Nguyệt Đỗ";
    private static final String COMMENT = "Em phát âm ß trong „Straße“ đã chuẩn, Übung với ä/ö/ü còn cần luyện. Tiến bộ rõ!";
    private static final String URL = "https://mydeutschflow.com/phieu/0123456789abcdef0123456789abcdef01234567?lang=vi";

    private final ReportPdfRenderer renderer = new ReportPdfRenderer(new ReportI18n());

    @Test
    @DisplayName("A4 dọc; tên có dấu tiếng Việt và ß/ü trích xuất lại đúng chữ; mã phiếu, nhãn tiếng Việt, khối chứng nhận FINAL")
    void rendersVietnameseAndGerman_onPortraitA4() throws Exception {
        StudentReportIssue issue = issue("vi", StudentReportIssue.Period.FINAL, COMMENT, true);

        byte[] pdf = renderer.render(issue, URL);

        assertThat(pdf).isNotEmpty();
        try (PDDocument doc = Loader.loadPDF(pdf)) {
            assertThat(doc.getNumberOfPages()).isEqualTo(1);
            PDPage page = doc.getPage(0);
            PDRectangle box = page.getMediaBox();
            assertThat(box.getWidth()).isEqualTo(PDRectangle.A4.getWidth());
            assertThat(box.getHeight()).isEqualTo(PDRectangle.A4.getHeight());
            assertThat(box.getHeight()).as("A4 DỌC, không ngang").isGreaterThan(box.getWidth());

            String text = new PDFTextStripper().getText(doc);
            assertThat(text).contains(VN_NAME)
                    .contains("Straße").contains("Übung").contains("ä/ö/ü")
                    .contains("Phiếu đánh giá kết quả học tập").contains("Kỳ cuối khoá")
                    .contains("TT Hoa Sen").contains("Đối tác đào tạo DeutschFlow")
                    .contains("Nghe · Hören").contains("Nói · Sprechen")
                    .contains("Có mặt 10 · Vắng 1 · Muộn 1 · Tổng buổi đã ghi nhận 12")
                    .contains("Tỉ lệ chuyên cần: 92%")
                    .contains("4 bài đã chốt · 1 bài đang chờ chấm")
                    .contains("7 đạt · 3 cần luyện · 2 chưa đánh giá (trên 12 mục tiêu)")
                    .contains("Kann nach dem Weg fragen")
                    .contains("12 phiên luyện nói với AI · 85 phút")
                    .contains("Đủ điều kiện cấp chứng nhận")
                    .contains("điểm bài đã chốt ≥ 50/100 và chuyên cần ≥ 80%")
                    .contains("Mã phiếu: 01234567")
                    .contains("Cô Hạnh")
                    .contains("Giáo viên").contains("Trung tâm")
                    .contains("Trang 1/1");
            assertThat(text).doesNotContain("THU HỒI");
            assertThat(text).as("điểm 8,5 định dạng theo locale vi").contains("8,5");
        }
    }

    @Test
    @DisplayName("MIDTERM: không có khối chứng nhận; nhãn tiếng Anh / tiếng Đức đúng ngôn ngữ; nhận xét vẫn nguyên văn tiếng Việt")
    void midterm_enAndDe_labels_commentVerbatim() throws Exception {
        String en = text(renderer.render(issue("en", StudentReportIssue.Period.MIDTERM, COMMENT, false), URL));
        assertThat(en).contains("Learning progress report").contains("Mid-course").contains("Listening · Hören")
                .contains("Attendance rate: 92%").contains("Page 1/1").contains(COMMENT)
                .doesNotContain("certificate requirements").doesNotContain("Phiếu đánh giá");
        assertThat(en).as("locale en dùng dấu chấm thập phân").contains("8.5");

        String de = text(renderer.render(issue("de", StudentReportIssue.Period.MIDTERM, COMMENT, false), URL));
        assertThat(de).contains("Lernstandsbericht").contains("Kurshälfte").contains("Anwesenheitsquote: 92%")
                .contains("Seite 1/1").contains(COMMENT).doesNotContain("Zertifikatsvoraussetzungen");
        assertThat(de).contains("8,5");
    }

    @Test
    @DisplayName("Nhận xét rất dài tự sang trang, số trang đúng, chân trang (mã phiếu) ở trang cuối")
    void longComment_paginates() throws Exception {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < 400; i++) {
            sb.append("Đoạn nhận xét số ").append(i).append(" — em cần luyện thêm phần nghe hiểu và viết câu phức. ");
            if (i % 40 == 0) sb.append("\n\n");
        }
        byte[] pdf = renderer.render(issue("vi", StudentReportIssue.Period.MIDTERM, sb.toString(), false), URL);
        try (PDDocument doc = Loader.loadPDF(pdf)) {
            int pages = doc.getNumberOfPages();
            assertThat(pages).isGreaterThanOrEqualTo(2);
            String all = new PDFTextStripper().getText(doc);
            assertThat(all).contains("Trang 1/" + pages).contains("Trang " + pages + "/" + pages)
                    .contains("Đoạn nhận xét số 399").contains("Mã phiếu: 01234567");
            PDFTextStripper last = new PDFTextStripper();
            last.setStartPage(pages);
            last.setEndPage(pages);
            assertThat(last.getText(doc)).as("chân trang đi theo nội dung ở trang cuối").contains("Mã phiếu");
        }
    }

    @Test
    @DisplayName("Phiếu đã thu hồi in dấu THU HỒI; ký tự font không có (chữ Hán) thành '?' thay vì vỡ file; payload thiếu khối không ném")
    void revokedStamp_glyphFallback_sparsePayload() throws Exception {
        StudentReportIssue revoked = issue("vi", StudentReportIssue.Period.MIDTERM, "李明 nói tốt", false);
        revoked.revoke(1L, StudentReportIssue.REVOKE_BY_OWNER, Instant.now());
        String text = text(renderer.render(revoked, URL));
        assertThat(text).contains("PHIẾU NÀY ĐÃ ĐƯỢC THU HỒI").contains("?? nói tốt");

        StudentReportIssue sparse = StudentReportIssue.builder()
                .classId(1L).studentId(2L).period(StudentReportIssue.Period.MIDTERM).lang("vi")
                .payload(new LinkedHashMap<>()).studentNameSnapshot("Lê Văn Cường")
                .issuedAt(Instant.parse("2026-09-10T03:00:00Z")).token("0123456789abcdef0123456789abcdef01234567")
                .tokenExpiresAt(Instant.parse("2026-10-10T03:00:00Z")).build();
        String sparseText = text(renderer.render(sparse, URL));
        assertThat(sparseText).contains("Lê Văn Cường").contains("Chưa có buổi điểm danh nào")
                .contains("(Giáo viên chưa ghi nhận xét.)").contains("10/09/2026");
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    private static String text(byte[] pdf) throws Exception {
        try (PDDocument doc = Loader.loadPDF(pdf)) {
            return new PDFTextStripper().getText(doc);
        }
    }

    private static StudentReportIssue issue(String lang, StudentReportIssue.Period period, String comment, boolean eligible) {
        Map<String, Object> p = new LinkedHashMap<>();
        p.put("schemaVersion", 1);
        p.put("period", period.name());
        p.put("lang", lang);
        p.put("org", Map.of("name", "TT Hoa Sen"));
        p.put("class", map("id", 1L, "name", "B1 tối thứ Ba", "level", "B1", "primaryTeacherName", "Cô Hạnh"));
        p.put("student", map("id", 2L, "name", VN_NAME, "joinedAt", "2026-08-03"));
        List<Map<String, Object>> skills = new ArrayList<>();
        skills.add(map("code", "HOREN", "score", 8.5, "grade", "GOOD"));
        skills.add(map("code", "LESEN", "score", 7.0, "grade", "FAIR"));
        skills.add(map("code", "SCHREIBEN", "score", null, "grade", null));
        skills.add(map("code", "SPRECHEN", "score", 9.0, "grade", "EXCELLENT"));
        p.put("skills", skills);
        p.put("overall", map("score", 8.2, "grade", "GOOD"));
        p.put("attendance", map("present", 10, "absent", 1, "late", 1, "recorded", 12, "ratePct", 92));
        p.put("assignments", map("avgScore", 78.4, "confirmed", 4, "awaitingTeacher", 1));
        p.put("objectives", map("total", 12, "achieved", 7, "needsPractice", 3, "notAssessed", 2,
                "needsPracticeItems", List.of("Kann sich vorstellen", "Kann nach dem Weg fragen")));
        p.put("selfStudy", map("speakingSessions", 12, "speakingMinutes", 85, "vocabMastered", 120, "lessonsCompleted", 30));
        p.put("teacherComment", comment);
        p.put("certificate", period == StudentReportIssue.Period.FINAL
                ? map("eligible", eligible, "minAvgScore", 50, "minAttendancePct", 80) : null);
        return StudentReportIssue.builder()
                .classId(1L).studentId(2L).orgId(5L).period(period).lang(lang).payload(p)
                .orgNameSnapshot("TT Hoa Sen").studentNameSnapshot(VN_NAME)
                .issuedBy(3L).issuedByNameSnapshot("Cô Hạnh")
                .issuedAt(Instant.parse("2026-09-10T03:00:00Z"))
                .token("0123456789abcdef0123456789abcdef01234567")
                .tokenExpiresAt(Instant.parse("2026-10-10T03:00:00Z"))
                .build();
    }

    private static Map<String, Object> map(Object... kv) {
        Map<String, Object> m = new LinkedHashMap<>();
        for (int i = 0; i < kv.length; i += 2) {
            m.put((String) kv[i], kv[i + 1]);
        }
        return m;
    }
}
