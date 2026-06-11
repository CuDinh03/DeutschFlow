package com.deutschflow.payment.dto;

/**
 * SePay bank-transfer webhook body (C3). SePay POSTs this JSON on every transaction into the
 * configured bank account. Unknown fields are ignored (Jackson fail-on-unknown=false); missing
 * fields arrive as null.
 *
 * <p>Key fields: {@code id} = SePay's transaction id (idempotency key); {@code transferType} =
 * {@code "in"} for money received; {@code transferAmount} = VND; {@code content} = the raw
 * transfer memo we parse the invoice payment-code from; {@code code} = the code SePay already
 * extracted (preferred when present).
 *
 * @see <a href="https://docs.sepay.vn/tich-hop-webhooks.html">SePay webhook docs</a>
 */
public record SepayWebhookPayload(
        Long id,
        String gateway,
        String transactionDate,
        String accountNumber,
        String code,
        String content,
        String transferType,
        Long transferAmount,
        Long accumulated,
        String subAccount,
        String referenceCode,
        String description
) {}
