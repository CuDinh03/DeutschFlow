package com.deutschflow.organization.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

/**
 * Audit + idempotency record of a SePay bank-transfer webhook delivery (C3). UNIQUE on
 * {@code sepayId} makes redeliveries of the same transaction a no-op. Records both matched and
 * unmatched transfers (founder can reconcile unmatched ones).
 */
@Entity
@Table(name = "org_payment_events")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class OrgPaymentEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "sepay_id", nullable = false, unique = true, length = 64)
    private String sepayId;

    @Column(name = "invoice_id")
    private Long invoiceId;

    @Column(name = "org_id")
    private Long orgId;

    @Column(name = "amount_vnd", nullable = false)
    @Builder.Default
    private long amountVnd = 0;

    @Column(columnDefinition = "text")
    private String content;

    @Column(length = 64)
    private String gateway;

    @Column(nullable = false)
    @Builder.Default
    private boolean matched = false;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist
    void onCreate() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }
    }
}
