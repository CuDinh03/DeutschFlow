package com.deutschflow.organization.dto;

/** Bank-transfer instructions shown to an org for paying invoices via VietQR (C3). */
public record PaymentInfoDto(String bankAccount, String bankName, String accountName) {}
