CREATE TABLE IF NOT EXISTS translation_provider_monthly_usage (
    provider VARCHAR(32) NOT NULL,
    billing_month VARCHAR(7) NOT NULL,
    chars_input BIGINT NOT NULL DEFAULT 0,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_translation_provider_monthly_usage PRIMARY KEY (provider, billing_month)
);

CREATE INDEX IF NOT EXISTS idx_translation_provider_month_updated
    ON translation_provider_monthly_usage (billing_month DESC, updated_at DESC);
