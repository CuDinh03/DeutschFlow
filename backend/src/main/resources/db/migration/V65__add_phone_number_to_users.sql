-- V65: Add phone_number field to users table
-- Requirements:
--   - VN format: 0[3|5|7|8|9]XXXXXXXX (10 digits)
--   - Unique per account
--   - Nullable (existing users won't have phone)
--   - New registrations require phone

ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_number VARCHAR(15);

-- Unique index (partial: only enforces uniqueness on non-null values)
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_phone_number
    ON users(phone_number)
    WHERE phone_number IS NOT NULL;
