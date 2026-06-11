package com.deutschflow.organization.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "org_invoices")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class OrgInvoice {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "org_id", nullable = false)
    private Long orgId;

    @Column(name = "period_start")
    private LocalDate periodStart;

    @Column(name = "period_end")
    private LocalDate periodEnd;

    @Column(nullable = false)
    @Builder.Default
    private int seats = 0;

    @Column(name = "amount_vnd", nullable = false)
    @Builder.Default
    private long amountVnd = 0;

    @Column(nullable = false)
    @Builder.Default
    private String status = "DRAFT"; // DRAFT | SENT | PAID | VOID

    /** Code put in the VietQR transfer memo; SePay webhook matches the payment by it (C3). */
    @Column(name = "payment_code", length = 32, unique = true)
    private String paymentCode;

    @Column
    private String note;

    @Column(name = "created_by")
    private Long createdBy;

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
