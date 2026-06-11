-- V216: SePay bank-transfer payment for org invoices (checklist C3).
-- Flow: admin creates a DRAFT/SENT OrgInvoice → org transfers via VietQR with the invoice's
-- payment_code in the memo → SePay POSTs a webhook → we match by payment_code, mark the invoice
-- PAID, and activate the org plan. payment_code is UPPERCASE alphanumeric so it survives bank
-- memo normalization (banks often strip diacritics/lowercase).

ALTER TABLE org_invoices ADD COLUMN IF NOT EXISTS payment_code VARCHAR(32);
-- UNIQUE over non-null only (existing invoices keep NULL; Postgres UNIQUE ignores NULLs).
CREATE UNIQUE INDEX IF NOT EXISTS uq_org_invoices_payment_code ON org_invoices (payment_code);

-- Idempotency + audit log of every SePay webhook delivery (matched or not). UNIQUE(sepay_id)
-- makes redeliveries of the same transaction a no-op.
CREATE TABLE org_payment_events (
    id          BIGSERIAL PRIMARY KEY,
    sepay_id    VARCHAR(64)  NOT NULL UNIQUE,   -- SePay's transaction id (idempotency key)
    invoice_id  BIGINT,                         -- matched OrgInvoice, null when no match
    org_id      BIGINT,
    amount_vnd  BIGINT       NOT NULL DEFAULT 0,
    content     TEXT,                           -- raw transfer memo
    gateway     VARCHAR(64),                    -- bank name from SePay
    matched     BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX idx_org_payment_events_invoice ON org_payment_events (invoice_id);
