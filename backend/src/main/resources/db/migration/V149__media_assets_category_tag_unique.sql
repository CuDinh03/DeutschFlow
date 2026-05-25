-- Preserve all historical rows while enforcing uniqueness for tagged assets.
-- If multiple rows share the same (category, tag), keep the newest one tagged
-- and clear tag on older duplicates so no data is deleted.
WITH ranked AS (
    SELECT id,
           ROW_NUMBER() OVER (PARTITION BY category, tag ORDER BY id DESC) AS rn
    FROM media_assets
    WHERE tag IS NOT NULL
)
UPDATE media_assets m
SET tag = NULL
FROM ranked r
WHERE m.id = r.id
  AND r.rn > 1;

-- Enforce one tagged asset per category; rows with tag = NULL remain allowed.
CREATE UNIQUE INDEX idx_media_assets_category_tag_unique
    ON media_assets (category, tag)
    WHERE tag IS NOT NULL;
