package com.deutschflow.grammar.controller;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

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

    /** Check if user is eligible and issue certificate for a CEFR level */
    @PostMapping("/claim")
    public ResponseEntity<Map<String, Object>> claimCertificate(
            @RequestBody Map<String, String> body,
            @AuthenticationPrincipal UserDetails principal) {
        long uid = userId(principal);
        String cefrLevel = body.getOrDefault("cefrLevel", "A1");

        // Check if already has certificate for this level
        var existing = jdbcTemplate.queryForList("""
            SELECT id, certificate_code FROM cefr_certificates
            WHERE user_id = ? AND cefr_level = ? AND is_active = TRUE
            """, uid, cefrLevel);
        if (!existing.isEmpty()) {
            var cert = existing.get(0);
            cert.put("alreadyHas", true);
            return ResponseEntity.ok(cert);
        }

        // Check if user passed mock exam for this level
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
}
