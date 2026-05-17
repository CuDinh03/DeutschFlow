package com.deutschflow.grammar.controller;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.font.Standard14Fonts;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.io.ByteArrayOutputStream;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.*;

/**
 * CEFR Certificate API — Phase 6
 * Endpoint to check/issue certificates after passing mock exams
 */
@Slf4j
@RestController
@RequestMapping("/api/certificates")
@RequiredArgsConstructor
public class CertificateController {

    private final JdbcTemplate jdbcTemplate;

    private long userId(UserDetails p) {
        try { return Long.parseLong(p.getUsername()); }
        catch (Exception e) { throw new RuntimeException("Cannot resolve user ID"); }
    }

    /** List all certificates for the current user */
    @GetMapping("/me")
    public ResponseEntity<List<Map<String, Object>>> getMyCertificates(
            @AuthenticationPrincipal UserDetails principal) {
        long uid = userId(principal);
        var certs = jdbcTemplate.queryForList("""
            SELECT id, cefr_level, issued_at, exam_score,
                   certificate_code, is_active
            FROM cefr_certificates
            WHERE user_id = ? AND is_active = TRUE
            ORDER BY issued_at DESC
            """, uid);
        return ResponseEntity.ok(certs);
    }

    /** Generate and download a PDF certificate */
    @GetMapping("/{id}/pdf")
    public ResponseEntity<byte[]> downloadPdf(
            @PathVariable long id,
            @AuthenticationPrincipal UserDetails principal) {
        long uid = userId(principal);

        var rows = jdbcTemplate.queryForList("""
            SELECT c.id, c.cefr_level, c.issued_at, c.exam_score, c.certificate_code,
                   u.display_name
            FROM cefr_certificates c
            JOIN users u ON u.id = c.user_id
            WHERE c.id = ? AND c.user_id = ? AND c.is_active = TRUE
            """, id, uid);

        if (rows.isEmpty()) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }

        Map<String, Object> cert = rows.get(0);
        String cefrLevel  = String.valueOf(cert.get("cefr_level"));
        String code       = String.valueOf(cert.get("certificate_code"));
        String name       = String.valueOf(cert.getOrDefault("display_name", "Learner"));
        int score         = ((Number) cert.get("exam_score")).intValue();
        String issuedDate = LocalDate.now().format(DateTimeFormatter.ofPattern("dd/MM/yyyy"));

        try (PDDocument doc = new PDDocument()) {
            PDPage page = new PDPage(PDRectangle.A4);
            doc.addPage(page);

            try (PDPageContentStream cs = new PDPageContentStream(doc, page)) {
                float w = PDRectangle.A4.getWidth();
                float h = PDRectangle.A4.getHeight();

                cs.setNonStrokingColor(0.98f, 0.98f, 1f);
                cs.addRect(0, 0, w, h);
                cs.fill();

                cs.setStrokingColor(0.24f, 0.27f, 0.98f);
                cs.setLineWidth(3f);
                cs.addRect(30, 30, w - 60, h - 60);
                cs.stroke();

                cs.setLineWidth(1f);
                cs.addRect(38, 38, w - 76, h - 76);
                cs.stroke();

                var bold   = new PDType1Font(Standard14Fonts.FontName.HELVETICA_BOLD);
                var normal = new PDType1Font(Standard14Fonts.FontName.HELVETICA);
                var italic = new PDType1Font(Standard14Fonts.FontName.HELVETICA_OBLIQUE);

                cs.setNonStrokingColor(0.24f, 0.27f, 0.98f);
                centerText(cs, bold, 28, "DEUTSCHFLOW", w, h - 120);

                cs.setNonStrokingColor(0.1f, 0.1f, 0.1f);
                centerText(cs, normal, 14, "CERTIFICATE OF ACHIEVEMENT", w, h - 150);

                cs.setStrokingColor(0.85f, 0.85f, 0.85f);
                cs.setLineWidth(0.8f);
                cs.moveTo(80, h - 170); cs.lineTo(w - 80, h - 170); cs.stroke();

                cs.setNonStrokingColor(0.4f, 0.4f, 0.4f);
                centerText(cs, italic, 13, "This certifies that", w, h - 210);

                cs.setNonStrokingColor(0.05f, 0.05f, 0.05f);
                centerText(cs, bold, 26, name, w, h - 260);

                cs.setNonStrokingColor(0.4f, 0.4f, 0.4f);
                centerText(cs, italic, 13, "has successfully passed the DeutschFlow", w, h - 295);
                centerText(cs, italic, 13, "standardized proficiency assessment at level", w, h - 315);

                cs.setNonStrokingColor(0.24f, 0.27f, 0.98f);
                centerText(cs, bold, 56, cefrLevel, w, h - 390);

                cs.setNonStrokingColor(0.3f, 0.3f, 0.3f);
                centerText(cs, normal, 13, "Exam Score: " + score + " / 100", w, h - 420);

                cs.setStrokingColor(0.85f, 0.85f, 0.85f);
                cs.moveTo(80, h - 450); cs.lineTo(w - 80, h - 450); cs.stroke();

                cs.setNonStrokingColor(0.5f, 0.5f, 0.5f);
                cs.beginText();
                cs.setFont(normal, 10);
                cs.newLineAtOffset(60, 80);
                cs.showText("Certificate Code: " + code);
                cs.endText();

                cs.beginText();
                cs.setFont(normal, 10);
                cs.newLineAtOffset(w - 200, 80);
                cs.showText("Issued: " + issuedDate);
                cs.endText();

                centerText(cs, italic, 10, "This certificate is issued by DeutschFlow and is verified by the DeutschFlow platform.", w, 55);
            }

            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            doc.save(baos);
            byte[] pdfBytes = baos.toByteArray();

            String filename = "DeutschFlow-Certificate-" + cefrLevel + "-" + code + ".pdf";
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_PDF);
            headers.setContentDispositionFormData("attachment", filename);
            return new ResponseEntity<>(pdfBytes, headers, HttpStatus.OK);

        } catch (Exception e) {
            log.error("Failed to generate certificate PDF id={}", id, e);
            return ResponseEntity.internalServerError().build();
        }
    }

    /** Check if user is eligible and issue certificate for a CEFR level */
    @PostMapping("/claim")
    public ResponseEntity<Map<String, Object>> claimCertificate(
            @RequestBody Map<String, String> body,
            @AuthenticationPrincipal UserDetails principal) {
        long uid = userId(principal);
        String cefrLevel = body.getOrDefault("cefrLevel", "A1");

        var existing = jdbcTemplate.queryForList("""
            SELECT id, certificate_code FROM cefr_certificates
            WHERE user_id = ? AND cefr_level = ? AND is_active = TRUE
            """, uid, cefrLevel);
        if (!existing.isEmpty()) {
            var cert = existing.get(0);
            cert.put("alreadyHas", true);
            return ResponseEntity.ok(cert);
        }

        var passedExam = jdbcTemplate.queryForList("""
            SELECT a.id, a.total_score FROM mock_exam_attempts a
            JOIN mock_exams e ON e.id = a.exam_id
            WHERE a.user_id = ? AND e.cefr_level = ?
              AND a.status = 'COMPLETED' AND a.passed = TRUE
            ORDER BY a.total_score DESC
            LIMIT 1
            """, uid, cefrLevel);

        if (passedExam.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of(
                "error", "Chưa pass mock exam " + cefrLevel,
                "requirement", "Cần đạt ≥ 60 điểm trong bài thi mock Goethe " + cefrLevel
            ));
        }

        var bestAttempt = passedExam.get(0);
        int score = ((Number) bestAttempt.get("total_score")).intValue();
        long attemptId = ((Number) bestAttempt.get("id")).longValue();
        String code = "DF-" + cefrLevel + "-" + java.time.Year.now().getValue() + "-" + String.format("%05d", uid);

        try {
            var cert = jdbcTemplate.queryForMap("""
                INSERT INTO cefr_certificates (user_id, cefr_level, exam_score, attempt_id, certificate_code)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT (user_id, cefr_level) DO UPDATE
                  SET exam_score = EXCLUDED.exam_score, is_active = TRUE
                RETURNING id, cefr_level, issued_at, exam_score, certificate_code
                """, uid, cefrLevel, score, attemptId, code);
            cert.put("justIssued", true);
            return ResponseEntity.ok(cert);
        } catch (Exception e) {
            log.error("Error issuing certificate", e);
            return ResponseEntity.internalServerError().body(Map.of("error", "Không thể cấp chứng chỉ"));
        }
    }

    private void centerText(PDPageContentStream cs, PDType1Font font, float size, String text, float pageWidth, float y) throws Exception {
        float tw = font.getStringWidth(text) / 1000 * size;
        cs.beginText();
        cs.setFont(font, size);
        cs.newLineAtOffset((pageWidth - tw) / 2, y);
        cs.showText(text);
        cs.endText();
    }
}
