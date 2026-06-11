package com.deutschflow.teacher.service;

import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.organization.entity.Organization;
import com.deutschflow.organization.repository.OrganizationRepository;
import com.deutschflow.teacher.dto.CertificateDto;
import com.deutschflow.teacher.dto.CertificateSummaryDto;
import com.deutschflow.teacher.dto.IssueCertificateRequest;
import com.deutschflow.teacher.entity.OrgCertificate;
import com.deutschflow.teacher.repository.ClassStudentRepository;
import com.deutschflow.teacher.repository.OrgCertificateRepository;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Issues and verifies co-branded readiness/completion certificates (checklist D5).
 *
 * <p>A teacher issues a certificate to a student in one of their own classes; the center (the
 * issuer's org) name/logo is co-branded onto it. Authorization reuses the existing teacher
 * ownership guard ({@link TeacherService#assertTeacherOwnsClass}) plus a class-membership check —
 * the same belt-and-braces pattern the rest of the teacher API uses against IDOR. All display
 * names are snapshotted at issue time so the certificate is immutable afterwards.
 */
@Service
@RequiredArgsConstructor
public class OrgCertificateService {

    private static final Set<String> VALID_LEVELS = Set.of("A1", "A2", "B1", "B2", "C1", "C2");
    private static final int MAX_NOTE_LENGTH = 500;
    private static final String DEFAULT_STUDENT_NAME = "Học viên";

    private final OrgCertificateRepository certificateRepository;
    private final TeacherService teacherService;
    private final ClassStudentRepository classStudentRepository;
    private final UserRepository userRepository;
    private final OrganizationRepository organizationRepository;

    /** Issue a co-branded certificate for {@code req.studentId} in {@code req.classId}. */
    @Transactional
    public CertificateDto issue(Long issuerUserId, IssueCertificateRequest req) {
        if (req == null || req.classId() == null || req.studentId() == null) {
            throw new BadRequestException("Thiếu lớp hoặc học viên");
        }
        String level = req.cefrLevel() == null ? "" : req.cefrLevel().trim().toUpperCase(Locale.ROOT);
        if (!VALID_LEVELS.contains(level)) {
            throw new BadRequestException("Trình độ CEFR không hợp lệ");
        }
        if (req.score() != null && (req.score() < 0 || req.score() > 100)) {
            throw new BadRequestException("Điểm phải trong khoảng 0–100");
        }
        String note = normalizeNote(req.note());

        // Authz: teacher must own the class AND the student must be enrolled in it.
        teacherService.assertTeacherOwnsClass(issuerUserId, req.classId());
        if (!classStudentRepository.existsByIdClassIdAndIdStudentId(req.classId(), req.studentId())) {
            throw new BadRequestException("Học viên không thuộc lớp này");
        }

        User student = userRepository.findById(req.studentId())
                .orElseThrow(() -> new NotFoundException("Không tìm thấy học viên"));

        User issuer = userRepository.findById(issuerUserId).orElse(null);
        Long orgId = issuer != null ? issuer.getOrgId() : null;
        String orgName = null;
        String orgLogoUrl = null;
        if (orgId != null) {
            Organization org = organizationRepository.findById(orgId).orElse(null);
            if (org != null) {
                orgName = org.getName();
                orgLogoUrl = org.getLogoUrl();
            }
        }

        String token = newToken();
        OrgCertificate cert = OrgCertificate.builder()
                .verifyToken(token)
                .certificateCode(buildCode(level, token))
                .classId(req.classId())
                .orgId(orgId)
                .orgNameSnapshot(orgName)
                .orgLogoUrlSnapshot(orgLogoUrl)
                .studentUserId(student.getId())
                .studentNameSnapshot(displayNameOf(student))
                .cefrLevel(level)
                .score(req.score())
                .note(note)
                .issuedByUserId(issuerUserId)
                .issuedByNameSnapshot(issuer != null ? displayNameOf(issuer) : null)
                .active(true)
                .build();

        return toDto(certificateRepository.save(cert));
    }

    /** Public verification: fetch an ACTIVE certificate by its verify token. */
    @Transactional(readOnly = true)
    public CertificateDto getByToken(String verifyToken) {
        return certificateRepository.findByVerifyToken(verifyToken)
                .filter(OrgCertificate::isActive)
                .map(this::toDto)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy chứng nhận"));
    }

    /** Certificates issued from a class — for the teacher who owns it. */
    @Transactional(readOnly = true)
    public List<CertificateSummaryDto> listByClass(Long teacherUserId, Long classId) {
        teacherService.assertTeacherOwnsClass(teacherUserId, classId);
        return certificateRepository.findByClassIdOrderByCreatedAtDesc(classId).stream()
                .map(this::toSummary)
                .collect(Collectors.toList());
    }

    /** Revoke a certificate (soft delete). Only a teacher who owns its class may revoke it. */
    @Transactional
    public void revoke(Long teacherUserId, Long certificateId) {
        OrgCertificate cert = certificateRepository.findById(certificateId)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy chứng nhận"));
        teacherService.assertTeacherOwnsClass(teacherUserId, cert.getClassId());
        cert.setActive(false);
        certificateRepository.save(cert);
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    private String normalizeNote(String raw) {
        if (raw == null) {
            return null;
        }
        String trimmed = raw.trim();
        if (trimmed.isEmpty()) {
            return null;
        }
        return trimmed.length() > MAX_NOTE_LENGTH ? trimmed.substring(0, MAX_NOTE_LENGTH) : trimmed;
    }

    private String displayNameOf(User user) {
        String name = user.getDisplayName();
        return (name == null || name.isBlank()) ? DEFAULT_STUDENT_NAME : name.trim();
    }

    /** URL-safe random token (UUID without dashes), mirroring LeadMagnetService. */
    private String newToken() {
        return UUID.randomUUID().toString().replace("-", "");
    }

    /** Human-readable code for display/print, e.g. {@code DF-B1-2026-AB12CD34}. */
    private String buildCode(String level, String token) {
        return "DF-" + level + "-" + LocalDate.now().getYear() + "-"
                + token.substring(0, 8).toUpperCase(Locale.ROOT);
    }

    private CertificateDto toDto(OrgCertificate c) {
        return new CertificateDto(
                c.getCertificateCode(),
                c.getVerifyToken(),
                c.getStudentNameSnapshot(),
                c.getCefrLevel(),
                c.getScore(),
                c.getNote(),
                c.getOrgNameSnapshot(),
                c.getOrgLogoUrlSnapshot(),
                c.getIssuedByNameSnapshot(),
                c.getCreatedAt(),
                c.isActive());
    }

    private CertificateSummaryDto toSummary(OrgCertificate c) {
        return new CertificateSummaryDto(
                c.getId(),
                c.getCertificateCode(),
                c.getVerifyToken(),
                c.getStudentNameSnapshot(),
                c.getCefrLevel(),
                c.getScore(),
                c.getCreatedAt(),
                c.isActive());
    }
}
