-- ============================================================
-- V338: Hồ sơ học có nghề và ngày mốc (20/10/2026, đợt 2e định hướng A + B + E)
--
-- Onboarding mới hỏi "Bạn làm nghề gì?" (danh mục V334) và "Bạn cần sẵn sàng khi nào?" (ngày mốc:
-- buổi phỏng vấn, kỳ thi, ngày sang Đức). Cả hai không bắt buộc; hồ sơ cũ để NULL.
-- occupation_code tham chiếu occupation(code) — mã nghề không bao giờ bị xoá, chỉ tắt active.
--
-- Số V338: V337 đã dành cho PR #700 (đổi từ V333, chưa merge) — Flyway out-of-order: false nên
-- #700 phải lên prod TRƯỚC bản này; nếu không thì đổi số một trong hai trước khi merge.
-- ============================================================

ALTER TABLE user_learning_profiles ADD COLUMN IF NOT EXISTS occupation_code VARCHAR(64) REFERENCES occupation (code);
ALTER TABLE user_learning_profiles ADD COLUMN IF NOT EXISTS target_date DATE;
