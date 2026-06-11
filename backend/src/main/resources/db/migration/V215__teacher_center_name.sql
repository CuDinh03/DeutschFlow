-- V215: self-declared teaching center for non-org (free) teachers (checklist D11).
-- Feeds the org-sales "cluster" signal: when ≥N free teachers from the same center are detected,
-- the admin growth dashboard surfaces that center as a B2B lead (sell them an org seat plan).
-- Org teachers already belong to a center (their org), so this is only meaningful for org_id IS NULL.
ALTER TABLE users ADD COLUMN IF NOT EXISTS center_name VARCHAR(255);
