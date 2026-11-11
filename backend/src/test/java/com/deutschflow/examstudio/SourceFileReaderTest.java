package com.deutschflow.examstudio;

import com.deutschflow.common.exception.BadRequestException;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDDocumentInformation;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.encryption.AccessPermission;
import org.apache.pdfbox.pdmodel.encryption.StandardProtectionPolicy;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.font.Standard14Fonts;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@DisplayName("Xưởng đề — đọc tệp nguồn tải lên")
class SourceFileReaderTest {

    private final SourceFileReader reader = new SourceFileReader();

    private static final String SENTENCE =
            "Viele Erwachsene in Deutschland schlafen unter der Woche weniger als sieben Stunden pro Nacht";

    /** PDF nhiều dòng; mỗi phần tử là một dòng in ra trang. */
    private static byte[] pdf(List<String> lines, String title, boolean encrypt) throws Exception {
        try (PDDocument doc = new PDDocument(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            PDPage page = new PDPage();
            doc.addPage(page);
            try (PDPageContentStream cs = new PDPageContentStream(doc, page)) {
                cs.beginText();
                cs.setFont(new PDType1Font(Standard14Fonts.FontName.HELVETICA), 9);
                cs.setLeading(11);
                cs.newLineAtOffset(40, 750);
                for (String l : lines) {
                    cs.showText(l);
                    cs.newLine();
                }
                cs.endText();
            }
            if (title != null) {
                PDDocumentInformation info = new PDDocumentInformation();
                info.setTitle(title);
                info.setAuthor("Kersjes, Christina");
                doc.setDocumentInformation(info);
            }
            if (encrypt) {
                doc.protect(new StandardProtectionPolicy("owner", "geheim", new AccessPermission()));
            }
            doc.save(out);
            return out.toByteArray();
        }
    }

    private static List<String> article() {
        List<String> lines = new ArrayList<>();
        for (int i = 0; i < 6; i++) lines.add(SENTENCE + " (" + i + "),");
        lines.add("das zeigt eine neue Studie.");
        return lines;
    }

    @Test
    @DisplayName("PDF: bóc chữ, nối dòng trong đoạn, lấy tiêu đề và tác giả từ siêu dữ liệu, đoán giấy phép")
    void pdfText() throws Exception {
        List<String> lines = article();
        lines.add("Dieses Werk ist lizenziert unter einer Creative Commons Namensnennung 4.0");
        lines.add("International Lizenz.");
        SourceFileReader.Extracted x = reader.read("johm.pdf", pdf(lines, "Wahrgenommener Stress und Coping", false));

        assertThat(x.text()).contains("(0), " + SENTENCE + " (1),");
        assertThat(x.title()).isEqualTo("Wahrgenommener Stress und Coping");
        assertThat(x.author()).isEqualTo("Kersjes, Christina");
        assertThat(x.licenseText()).isEqualTo("CC BY 4.0");
        assertThat(x.ccBy()).isTrue();
    }

    @Test
    @DisplayName("PDF có mật khẩu hoặc gần như không có chữ (ảnh quét) bị từ chối, kèm lời báo dán văn bản")
    void pdfRejected() throws Exception {
        assertThatThrownBy(() -> reader.read("x.pdf", pdf(article(), null, true)))
                .isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> reader.read("scan.pdf", pdf(List.of("Seite 1"), null, false)))
                .isInstanceOf(BadRequestException.class).hasMessageContaining("ảnh quét");
    }

    @Test
    @DisplayName("DOCX: mỗi đoạn văn thành một đoạn")
    void docx() throws Exception {
        byte[] bytes;
        try (XWPFDocument d = new XWPFDocument(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            for (int i = 0; i < 5; i++) d.createParagraph().createRun().setText(SENTENCE + " (" + i + ").");
            d.write(out);
            bytes = out.toByteArray();
        }
        SourceFileReader.Extracted x = reader.read("bai.docx", bytes);
        assertThat(x.text().split("\n\n")).hasSize(5);
        assertThat(x.licenseText()).isNull();
        assertThat(x.ccBy()).isFalse();
    }

    @Test
    @DisplayName("TXT UTF-8 đọc được; tệp nhị phân lạ, tệp trống và tệp quá 10 MB bị từ chối")
    void plainAndRejects() {
        String body = (SENTENCE + ". ").repeat(6) + "Für Umlaute: Müdigkeit, Größe, Ärztin.";
        assertThat(reader.read("a.txt", body.getBytes(StandardCharsets.UTF_8)).text()).contains("Müdigkeit, Größe");

        assertThatThrownBy(() -> reader.read("a.bin", new byte[]{(byte) 0xff, (byte) 0xfe, 0, 1, 2, (byte) 0xc3}))
                .isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> reader.read("a.txt", new byte[0])).isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> reader.read("a.pdf", new byte[SourceFileReader.MAX_BYTES + 1]))
                .isInstanceOf(BadRequestException.class).hasMessageContaining("10 MB");
    }

    @Test
    @DisplayName("normalize: bỏ gạch nối cuối dòng và dòng số trang; dropReferences: cắt danh mục tài liệu ở cuối")
    void normalizeAndReferences() {
        String raw = "Stress ist eine zentrale Determinante der psychi-\nschen Gesundheit in Deutschland.\n12\n"
                + "Etwa 20 Prozent zeigen ein erhöhtes Stressniveau.\n";
        assertThat(SourceFileReader.normalize(raw))
                .contains("psychischen Gesundheit")
                .doesNotContain("\n12\n");

        String body = "Erster Absatz mit Inhalt. ".repeat(20);
        String withRefs = body + "\n\nLiteratur\n\n1. Autor A. Titel. Zeitschrift 2020.";
        assertThat(SourceFileReader.dropReferences(withRefs)).doesNotContain("Autor A.").contains("Erster Absatz");
        // "Literatur" ở đầu bài (trước nửa sau) không phải danh mục tham khảo ⇒ giữ nguyên.
        String early = "Literatur\n\n" + body;
        assertThat(SourceFileReader.dropReferences(early)).isEqualTo(early);
    }

    @Test
    @DisplayName("detectLicense: URL giấy phép, viết tắt, tên tiếng Đức; bản NC/ND/SA không phải CC BY trơn")
    void license() {
        assertThat(SourceFileReader.detectLicense("siehe http://creativecommons.org/licenses/by/3.0/de/ ."))
                .isEqualTo("CC BY 3.0 DE");
        assertThat(SourceFetcher.isPlainCcBy("CC BY 3.0 DE")).isTrue();
        assertThat(SourceFileReader.detectLicense("Lizenz: CC BY-NC-ND 4.0")).isEqualTo("CC BY NC ND 4.0");
        assertThat(SourceFetcher.isPlainCcBy("CC BY NC ND 4.0")).isFalse();
        String de = SourceFileReader.detectLicense(
                "unter der Creative Commons Namensnennung - Nicht kommerziell - Keine Bearbeitungen 4.0 Lizenz");
        assertThat(de).isEqualTo("CC BY NC ND 4.0");
        assertThat(SourceFetcher.isPlainCcBy(de)).isFalse();
        assertThat(SourceFileReader.detectLicense("Alle Rechte vorbehalten.")).isNull();
    }
}
