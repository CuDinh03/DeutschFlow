package com.deutschflow.organization.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

@Entity
@Table(name = "org_members")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class OrgMember {

    @EmbeddedId
    private OrgMemberId id;

    @Column(nullable = false)
    @Builder.Default
    private String role = "TEACHER"; // OWNER | ADMIN | TEACHER | STUDENT

    @Column(nullable = false)
    @Builder.Default
    private String status = "ACTIVE"; // ACTIVE | REVOKED (admin) | LEFT (self)

    @Column(name = "joined_at", nullable = false, updatable = false)
    private Instant joinedAt;

    /** Set when the membership leaves ACTIVE (revoke/self-leave); null while ACTIVE. */
    @Column(name = "left_at")
    private Instant leftAt;

    @PrePersist
    protected void onCreate() {
        if (joinedAt == null) joinedAt = Instant.now();
    }
}
