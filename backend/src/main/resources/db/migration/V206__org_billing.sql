CREATE TABLE org_invoices (
    id BIGSERIAL PRIMARY KEY,
    org_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    period_start DATE,
    period_end DATE,
    seats INT NOT NULL DEFAULT 0,
    amount_vnd BIGINT NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',  -- DRAFT|SENT|PAID|VOID
    note VARCHAR(500),
    created_by BIGINT REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_org_invoices_org ON org_invoices(org_id);
