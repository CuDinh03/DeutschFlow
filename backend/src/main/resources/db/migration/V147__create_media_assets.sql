CREATE TABLE media_assets (
    id            BIGSERIAL PRIMARY KEY,
    s3_key        VARCHAR(500) NOT NULL UNIQUE,
    url           TEXT NOT NULL,
    original_name VARCHAR(255),
    content_type  VARCHAR(100),
    file_size     BIGINT,
    category      VARCHAR(50) NOT NULL,
    tag           VARCHAR(100),
    alt_text      VARCHAR(500),
    uploaded_by   BIGINT REFERENCES users(id) ON DELETE SET NULL,
    created_at    TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_media_assets_category ON media_assets(category);
CREATE INDEX idx_media_assets_category_tag ON media_assets(category, tag);
