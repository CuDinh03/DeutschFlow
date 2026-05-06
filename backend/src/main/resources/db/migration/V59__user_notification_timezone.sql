-- V59: Add notification_timezone to users table + new notification types support
ALTER TABLE users ADD COLUMN IF NOT EXISTS notification_timezone VARCHAR(50) DEFAULT 'Asia/Ho_Chi_Minh';

COMMENT ON COLUMN users.notification_timezone IS 'IANA timezone for scheduled notification delivery (streak reminder, review due). Default Asia/Ho_Chi_Minh.';
