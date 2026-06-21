package com.deutschflow.material.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

/**
 * A persisted teaching material (B2B model §5). Ownership is explicit via {@code ownerScope}:
 * PERSONAL → {@code teacherId} set; ORG → {@code orgId} set (DB CHECK {@code chk_material_owner}
 * enforces exactly one). {@code createdBy} is the AUTHOR only (audit) — it never decides ownership,
 * so a teacher authoring a material for a center stores {@code ownerScope='ORG'} from the start.
 */
@Entity
@Table(name = "materials")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Material {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "owner_scope", nullable = false)
    private String ownerScope; // PERSONAL | ORG

    @Column(name = "teacher_id")
    private Long teacherId; // owner when PERSONAL

    @Column(name = "org_id")
    private Long orgId; // owner when ORG

    @Column(name = "created_by", nullable = false)
    private Long createdBy; // author (audit) — NOT the owner

    @Column(nullable = false)
    private String title;

    @Column
    private String description;

    @Column(nullable = false)
    private String kind; // PPTX | PDF | DOCX | IMAGE | OTHER

    @Column(name = "object_key", nullable = false)
    private String objectKey; // S3 key

    @Column(name = "mime_type")
    private String mimeType;

    @Column(name = "size_bytes")
    private Long sizeBytes;

    @Column(nullable = false)
    @Builder.Default
    private String visibility = "ORG_ALL"; // ORG_ALL | OWNER_ONLY

    @Column(nullable = false)
    @Builder.Default
    private String status = "ACTIVE"; // ACTIVE | ARCHIVED | DELETED

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @PrePersist
    void onCreate() {
        createdAt = updatedAt = Instant.now();
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = Instant.now();
    }
}
