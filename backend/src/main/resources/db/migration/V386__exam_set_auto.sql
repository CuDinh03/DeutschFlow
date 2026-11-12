-- Xưởng đề — chế độ "Tự nối lượt" của "Tạo bộ đề tự động" (owner yêu cầu 13/11/2026).
--
-- Một dòng duy nhất (id = 1). Khi bật, nhịp nền thấy không còn lượt nào đang chạy thì tự tạo lượt kế tiếp với
-- đúng kỳ thi / cấp / hồ sơ / kênh AI đã lưu lúc bật. Chỉ thêm bảng mới: màu cũ vẫn chạy được trong lúc blue-green.

CREATE TABLE IF NOT EXISTS exam_set_auto (
    id          INT          PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    enabled     BOOLEAN      NOT NULL DEFAULT false,
    exam_format VARCHAR(30)  NOT NULL DEFAULT 'TELC',
    cefr_level  VARCHAR(5)   NOT NULL DEFAULT 'B1',
    profile     VARCHAR(20)  NOT NULL DEFAULT 'REAL',
    channel     VARCHAR(20)  NOT NULL DEFAULT 'FIREWORKS',
    created_by  BIGINT       REFERENCES users (id) ON DELETE SET NULL,
    note        TEXT,
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

INSERT INTO exam_set_auto (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
