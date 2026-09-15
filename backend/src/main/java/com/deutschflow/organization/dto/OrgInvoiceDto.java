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
        Instant createdAt,
        /** Hạn thanh toán (SENT + 7 ngày, Q4). null = hoá đơn chưa gửi nên chưa có hạn. */
        Instant dueDate
) {}
