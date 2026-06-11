package com.deutschflow.organization.dto;

import java.time.Instant;
import java.time.LocalDate;

/** Hoá đơn của một tổ chức. */
public record OrgInvoiceDto(
        Long id,
        Long orgId,
        LocalDate periodStart,
        LocalDate periodEnd,
        int seats,
        long amountVnd,
        String status,
        String paymentCode,
        String note,
        Instant createdAt
) {}
