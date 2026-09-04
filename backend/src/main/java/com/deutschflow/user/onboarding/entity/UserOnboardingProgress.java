package com.deutschflow.user.onboarding.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.List;

/**
 * Tiến độ onboarding server-side của một user (V287).
 *
 * <p>{@code activatedAt} là ACTIVATION theo định nghĩa của sản phẩm: HOÀN THÀNH
 * BÀI HỌC ĐẦU TIÊN. Không phải lúc lưu hồ sơ, và không phải sự kiện
 * {@code onboarding_completed} đang chạy hôm nay (xem spec §1).
 */
@Entity
@Table(name = "user_onboarding_progress")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserOnboardingProgress {

    @Id
    @Column(name = "user_id", nullable = false, updatable = false)
    private Long userId;

    @Column(name = "flow_version", nullable = false, length = 16)
    private String flowVersion;

    @Column(name = "last_step", nullable = false, length = 32)
    private String lastStep;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "completed_activities", nullable = false, columnDefinition = "jsonb")
    private List<String> completedActivities;

    @Column(name = "activated_at")
    private Instant activatedAt;

    @Column(name = "core_completed_at")
    private Instant coreCompletedAt;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}
