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

-- Hàng chờ việc của owner (owner chốt 13/11/2026): bấm "Làm lại Teil này" (REDO) hoặc "Tạo phần Nghe" (ADD_HOEREN)
-- lúc tự nối đang bật mà máy đang chạy lượt khác ⇒ xếp một dòng WAITING. Nhịp nền chạy dòng WAITING cũ nhất ngay khi
-- không còn lượt nào chạy, TRƯỚC khi tự tạo lượt mới. Dòng đã chạy giữ lại làm lịch sử (DONE, hoặc FAILED kèm lý do).
CREATE TABLE IF NOT EXISTS exam_set_pending (
    id          BIGSERIAL    PRIMARY KEY,
    kind        VARCHAR(20)  NOT NULL CHECK (kind IN ('REDO', 'ADD_HOEREN')),
    run_id      BIGINT       NOT NULL REFERENCES exam_set_runs (id) ON DELETE CASCADE,
    section     VARCHAR(20),
    teil        INT,
    channel     VARCHAR(20),
    status      VARCHAR(10)  NOT NULL DEFAULT 'WAITING' CHECK (status IN ('WAITING', 'DONE', 'FAILED')),
    error       TEXT,
    created_by  BIGINT       REFERENCES users (id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    finished_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_exam_set_pending_status ON exam_set_pending (status, id);
