-- Làm mới Luyện thi đợt (e) (07/11/2026): hướng dẫn lần đầu tự mở ở mỗi màn, đã xem thì thôi — lưu
-- THEO TÀI KHOẢN (không theo trình duyệt), để đổi máy không phải xem lại. Khoá màn do client đặt
-- (ví dụ exam.today, exam.teil, exam.mockStart), giới hạn ký tự và số khoá ở UiTourService.
CREATE TABLE IF NOT EXISTS user_ui_tours (
    user_id  BIGINT      NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    tour_key VARCHAR(40) NOT NULL,
    seen_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, tour_key)
);
