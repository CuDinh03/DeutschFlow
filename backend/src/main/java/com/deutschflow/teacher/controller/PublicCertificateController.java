package com.deutschflow.teacher.controller;

import com.deutschflow.teacher.dto.CertificateDto;
import com.deutschflow.teacher.service.OrgCertificateService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Public certificate verification (checklist D5) — anyone with the verify token can confirm a
 * co-branded certificate is genuine. Under {@code /api/public/**} (permitAll). Returns only what
 * is printed on the certificate (student name + level + center + code); no other PII.
 */
@RestController
@RequestMapping("/api/public/certificate")
@RequiredArgsConstructor
public class PublicCertificateController {

    private final OrgCertificateService certificateService;

    @GetMapping("/{token}")
    public CertificateDto verify(@PathVariable String token) {
        return certificateService.getByToken(token);
    }
}
