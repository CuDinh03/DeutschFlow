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
    private String status = "ACTIVE"; // ACTIVE | REMOVED

    @Column(name = "joined_at", nullable = false, updatable = false)
    private Instant joinedAt;

    @PrePersist
    protected void onCreate() {
        if (joinedAt == null) joinedAt = Instant.now();
    }
}
