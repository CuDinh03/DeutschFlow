ALTER TABLE media_assets
    ADD COLUMN IF NOT EXISTS scope VARCHAR(20) NOT NULL DEFAULT 'SYSTEM',
    ADD COLUMN IF NOT EXISTS source VARCHAR(30) NOT NULL DEFAULT 'UPLOADED',
    ADD COLUMN IF NOT EXISTS style VARCHAR(50);

ALTER TABLE words
    ADD COLUMN IF NOT EXISTS image_source VARCHAR(30),
    ADD COLUMN IF NOT EXISTS image_style VARCHAR(50),
    ADD COLUMN IF NOT EXISTS image_prompt TEXT,
    ADD COLUMN IF NOT EXISTS image_generated_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS image_updated_at TIMESTAMP;

UPDATE media_assets
SET scope = COALESCE(scope, 'SYSTEM'),
    source = COALESCE(source, 'UPLOADED')
WHERE scope IS NULL OR source IS NULL;

UPDATE words
SET image_source = COALESCE(image_source, 'AUTO_GENERATED')
WHERE image_url IS NOT NULL AND (image_source IS NULL OR image_source = '');

CREATE INDEX IF NOT EXISTS idx_words_image_source ON words(image_source);
