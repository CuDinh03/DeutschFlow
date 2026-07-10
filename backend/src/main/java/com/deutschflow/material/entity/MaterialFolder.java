package com.deutschflow.material.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

/**
 * A one-level folder for organizing teaching materials (Materials Library, V258). Ownership mirrors
 * {@link Material}: PERSONAL → {@code teacherId} set; ORG → {@code orgId} set (DB CHECK
 * {@code chk_folder_owner} enforces exactly one). {@code createdBy} is the AUTHOR only (audit) — it
 * gives ORG folders the same "author-or-admin" manage parity that materials have; it never decides
 * ownership. A material's {@code folderId} is SET NULL when its folder is deleted (FK ON DELETE SET NULL).
 */
@Entity
@Table(name = "material_folders")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MaterialFolder {

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
    private String name;

    @Column(name = "order_index", nullable = false)
    @Builder.Default
    private Integer orderIndex = 0;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist
    void onCreate() {
        if (createdAt == null) createdAt = Instant.now();
    }
}
