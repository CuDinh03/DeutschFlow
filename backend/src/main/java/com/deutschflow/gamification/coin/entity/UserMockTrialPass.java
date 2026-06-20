package com.deutschflow.gamification.coin.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

/**
 * A coin-purchased entitlement granting exactly ONE attempt on an otherwise PRO-gated mock-exam
 * pack. Status flows {@code PURCHASED -> CONSUMED}; consumed at attempt-start. A partial unique index
 * ({@code uq_trial_one_active_per_pack}) allows at most one un-consumed pass per (user, pack).
 */
@Entity
@Table(name = "user_mock_trial_passes")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserMockTrialPass {

    public static final String PURCHASED = "PURCHASED";
    public static final String CONSUMED = "CONSUMED";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "pack_id", nullable = false)
    private Long packId;

    @Column(name = "status", nullable = false, length = 16)
    @Builder.Default
    private String status = PURCHASED;

    @Column(name = "purchased_at", nullable = false, updatable = false)
    @Builder.Default
    private LocalDateTime purchasedAt = LocalDateTime.now();

    @Column(name = "consumed_at")
    private LocalDateTime consumedAt;

    @Column(name = "attempt_id")
    private Long attemptId;
}
