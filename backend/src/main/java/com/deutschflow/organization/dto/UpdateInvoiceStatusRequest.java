package com.deutschflow.organization.dto;

/** Đổi trạng thái hoá đơn: DRAFT|SENT|PAID|VOID (platform-admin). */
public record UpdateInvoiceStatusRequest(
        String status
) {}
