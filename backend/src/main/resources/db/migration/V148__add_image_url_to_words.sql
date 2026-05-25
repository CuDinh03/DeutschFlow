-- V148: Add image_url column to words table
-- Allows each vocabulary word to have an associated illustration image stored in S3
ALTER TABLE words ADD COLUMN IF NOT EXISTS image_url VARCHAR(512);
