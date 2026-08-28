package com.deutschflow.user.onboarding.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

/**
 * Phiên onboarding của khách chưa có tài khoản (V285).
 *
 * <p>{@code id} vừa là khoá chính vừa là bearer token: client cầm nó để PATCH mà
 * không cần đăng nhập. Vì vậy nó PHẢI được sinh ngẫu nhiên ({@link UUID#randomUUID()}),
 * không bao giờ tuần tự.
 *
 * <p>Claim là thao tác một chiều và chỉ xảy ra đúng một lần — xem
 * {@code GuestOnboardingSessionRepository#claim}.
 */
@Entity
@Table(name = "guest_onboarding_sessions")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class GuestOnboardingSession {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "platform", nullable = false, length = 16)
    private String platform;

    @Column(name = "locale", nullable = false, length = 5)
    private String locale;

    @Column(name = "flow_version", nullable = false, length = 16)
    private String flowVersion;

    @Column(name = "current_step", nullable = false, length = 32)
    private String currentStep;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "answers", nullable = false, columnDefinition = "jsonb")
    private Map<String, Object> answers;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "activity_result", columnDefinition = "jsonb")
    private Map<String, Object> activityResult;

    @Column(name = "claimed_by_user_id")
    private Long claimedByUserId;

    @Column(name = "claimed_at")
    private Instant claimedAt;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    /** Hết hạn thì coi như không tồn tại — với cả PATCH lẫn claim. */
    public boolean isExpiredAt(Instant now) {
        return expiresAt != null && !expiresAt.isAfter(now);
    }

    public boolean isClaimed() {
        return claimedByUserId != null;
    }
}
