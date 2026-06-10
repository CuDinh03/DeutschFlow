package com.deutschflow.organization.dto;

import java.time.LocalDate;

/** Tạo hoá đơn nháp cho tổ chức (platform-admin). */
public record CreateInvoiceRequest(
        LocalDate periodStart,
        LocalDate periodEnd,
        int seats,
        long amountVnd,
        String note
) {}
