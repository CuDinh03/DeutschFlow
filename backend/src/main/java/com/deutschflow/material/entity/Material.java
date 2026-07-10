package com.deutschflow.material.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

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
    private String kind; // PPTX | PDF | DOCX | IMAGE | AUDIO | VIDEO | LINK | OTHER

    // NULL cho kind=LINK (link ngoài không có object S3). DB CHECK chk_material_object_key (V258)
    // vẫn buộc NOT NULL cho mọi kind khác 'LINK'.
    @Column(name = "object_key")
    private String objectKey; // S3 key

    @Column(name = "folder_id")
    private Long folderId; // thư mục chứa (NULL = chưa xếp thư mục); FK ON DELETE SET NULL

    @Column(name = "external_url")
    private String externalUrl; // kind=LINK: URL nguồn ngoài (allango/YouTube/Drive...)

    @Column(name = "duration_seconds")
    private Integer durationSeconds; // audio/video: thời lượng track (hiển thị allango-style 12:34)

    // Tag tự do ("Netzwerk A1", "Hören", "Lektion 3"). Postgres text[] + GIN index (V258) cho filter.
    // Hibernate 6.4 map native qua @JdbcTypeCode(SqlTypes.ARRAY) — không cần hypersistence.
    @JdbcTypeCode(SqlTypes.ARRAY)
    @Column(name = "tags", columnDefinition = "text[]", nullable = false)
    @Builder.Default
    private String[] tags = new String[0];

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
