package com.deutschflow.teacher.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

/**
 * Co-branded readiness/completion certificate issued by a center (org) to one of its students
 * (checklist D5 — "cert-lite co-brand"). A B2B sales/retention artifact.
 *
 * <p>Distinct from {@code cefr_certificates} (V122), which a student auto-earns by passing a mock
 * exam. This one is TEACHER-ISSUED and carries the center's name/logo. Center/student/issuer names
 * are snapshotted so the certificate stays immutable even if those records later change; it is
 * verified publicly by {@code verifyToken} (no live PII join — the student name is printed on it
 * by design, mirroring {@code SharedGradeReport}).
 */
@Entity
@Table(name = "org_certificates")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class OrgCertificate {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "verify_token", nullable = false, unique = true, length = 40)
    private String verifyToken;

    @Column(name = "certificate_code", nullable = false, length = 64)
    private String certificateCode;

    @Column(name = "class_id", nullable = false)
    private Long classId;

    @Column(name = "org_id")
    private Long orgId;

    @Column(name = "org_name_snapshot")
    private String orgNameSnapshot;

    @Column(name = "org_logo_url_snapshot", length = 512)
    private String orgLogoUrlSnapshot;

    @Column(name = "student_user_id", nullable = false)
    private Long studentUserId;

    @Column(name = "student_name_snapshot", nullable = false)
    private String studentNameSnapshot;

    @Column(name = "cefr_level", nullable = false, length = 5)
    private String cefrLevel;

    @Column
    private Integer score;

    @Column(columnDefinition = "text")
    private String note;

    @Column(name = "issued_by_user_id", nullable = false)
    private Long issuedByUserId;

    @Column(name = "issued_by_name_snapshot")
    private String issuedByNameSnapshot;

    @Column(nullable = false)
    @Builder.Default
    private boolean active = true;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist
    void onCreate() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }
    }
}
