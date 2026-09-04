-- Ảnh đại diện tự tải lên của người dùng (học viên + giáo viên).
-- Lưu URL public trên bucket media (prefix avatar/); NULL = chưa đặt, FE fallback chữ cái tắt.
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(500);
