package com.deutschflow.gamification.coin.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

/**
 * Immutable ledger entry for every coin movement. {@code amount > 0} = earn, {@code amount < 0} =
 * spend. Never delete rows — {@code user_coin_wallets.balance} is the authoritative fast-read
 * aggregate, this table is the audit trail. Mirrors {@code UserXpEvent} (V58).
 */
@Entity
@Table(name = "user_coin_events")
@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserCoinEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "amount", nullable = false)
    private int amount;

    @Enumerated(EnumType.STRING)
    @Column(name = "event_type", nullable = false, length = 48)
    private CoinEventType eventType;

    /** {@code tree_nodes.id} (VARCHAR) or a legacy {@code skill_tree_nodes.id} rendered as text. */
    @Column(name = "ref_node_id", length = 64)
    private String refNodeId;

    /** {@code TREE} | {@code SKILL_TREE} — disambiguates the two node-id spaces. */
    @Column(name = "ref_node_kind", length = 16)
    private String refNodeKind;

    @Column(name = "ref_pack_id")
    private Long refPackId;

    @Column(name = "ref_attempt_id")
    private Long refAttemptId;

    @Column(name = "note")
    private String note;

    @Column(name = "created_at", nullable = false, updatable = false)
    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();

    public enum CoinEventType {
        /** +1 when a learning node is completed for the first time. */
        NODE_COMPLETE,
        /** Negative — coins spent to buy a single-attempt mock-exam trial pass. */
        SPEND_MOCK_TRIAL,
        /** Negative — coins spent to buy a one-day AI-speaking token top-up. */
        SPEND_BONUS_SPEAKING
    }
}
