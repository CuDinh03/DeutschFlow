package com.deutschflow.organization.entity;

import jakarta.persistence.*;
import lombok.*;

import java.io.Serializable;
import java.time.LocalDateTime;

/** Cấu hình theo trung tâm (V298, key-value) — ngưỡng gợi ý hỗ trợ (PR-9), chính sách tính công P04 (PR-10). */
@Entity
@Table(name = "org_settings")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class OrgSetting {

    @EmbeddedId
    private Id id;

    @Column(nullable = false)
    private String value;

    @Column(name = "updated_by")
    private Long updatedBy;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    @PreUpdate
    protected void touch() {
        updatedAt = LocalDateTime.now();
    }

    @Embeddable
    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @EqualsAndHashCode
    public static class Id implements Serializable {
        @Column(name = "org_id")
        private Long orgId;

        @Column(name = "setting_key")
        private String settingKey;
    }
}
