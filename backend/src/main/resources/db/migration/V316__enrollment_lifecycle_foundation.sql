-- V316 — NỀN VÒNG ĐỜI GHI DANH (Đợt 4).
--
-- ⚠️ ĐÂY LÀ MIGRATION DUY NHẤT CỦA CẢ ĐỢT 4. Cố ý gom TOÀN BỘ schema mà các PR sau của đợt này
-- cần (tách chức danh giáo viên, sổ vào/ra trung tâm) vào một tệp, dù đợt này mới dùng phần (a).
-- Lý do: Flyway ở dự án chạy với `out-of-order=false`, nên hai PR song song mỗi bên thêm một
-- migration là sinh ra bẫy thứ tự kinh điển — nhánh nào merge sau bị đánh số thấp hơn baseline
-- và không bao giờ chạy trên môi trường đã áp bản kia. Một tệp thì không có bẫy đó.
-- 👉 PR sau của Đợt 4: KHÔNG thêm migration mới, cột đã có sẵn ở đây.
--
-- Trạng thái trước bản này: class_students vẫn đúng ba cột từ V133 (class_id, student_id,
-- joined_at) cộng mấy cột đánh giá của V209 — không có trạng thái, không có ngày rời. Gỡ một học
-- viên khỏi lớp chỉ có cách DELETE, mà DELETE thì cuốn theo cả điểm danh/điểm số quá khứ.

-- ─────────────────────────────────────────────────────────────────────────────
-- (a) VÒNG ĐỜI GHI DANH TRONG LỚP
-- ─────────────────────────────────────────────────────────────────────────────
-- ACTIVE      : đang học.
-- RESERVED    : bảo lưu — theo quyết định D1 VẪN GIỮ CHỖ (vẫn tính ghế) và vẫn xem được nội dung
--               lớp ở chế độ chỉ đọc. Vì vậy "còn chiếm ghế" = {ACTIVE, RESERVED}, còn "đang học"
--               (điểm danh, giao bài mới) = {ACTIVE}. Hai tập KHÁC NHAU, đừng gộp.
-- ENDED       : đã rời lớp — dòng KHÔNG bị xoá (D2: bài nộp, điểm, điểm danh giữ nguyên).
-- TRANSFERRED : chuyển sang lớp khác; lớp đích ghi ở transferred_to_class_id.
--
-- An toàn trên dữ liệu thật:
--   • ADD COLUMN có DEFAULT hằng: PostgreSQL ≥11 ghi default vào catalog, KHÔNG viết lại bảng —
--     mọi dòng đang có tự nhận 'ACTIVE', đúng ngữ nghĩa cũ ("có dòng nghĩa là đang học").
--   • Vì mọi dòng cũ đã là 'ACTIVE' nên NOT NULL và CHECK thoả ngay, không cần backfill riêng.
--   • ended_at / end_reason / transferred_to_class_id để NULL — chưa ai rời lớp.
--   • IF NOT EXISTS ở mọi bước để bản này chạy lại được (replay từ đầu trong cổng fresh-migration).
ALTER TABLE class_students
    ADD COLUMN IF NOT EXISTS status                  VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
    ADD COLUMN IF NOT EXISTS ended_at                TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS end_reason              VARCHAR(32),
    ADD COLUMN IF NOT EXISTS transferred_to_class_id BIGINT;

-- CHECK và FK tách khỏi ADD COLUMN để chạy lại được (ADD CONSTRAINT không có IF NOT EXISTS).
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_class_students_status') THEN
        ALTER TABLE class_students
            ADD CONSTRAINT chk_class_students_status
            CHECK (status IN ('ACTIVE','RESERVED','ENDED','TRANSFERRED'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_class_students_transferred_to') THEN
        ALTER TABLE class_students
            ADD CONSTRAINT fk_class_students_transferred_to
            FOREIGN KEY (transferred_to_class_id) REFERENCES teacher_classes(id)
            ON DELETE SET NULL;
    END IF;
END $$;

-- Cột FK cần index riêng: không có nó thì MỖI lần xoá lớp Postgres phải seq-scan class_students để
-- kiểm ràng buộc. Partial vì đại đa số dòng để NULL.
CREATE INDEX IF NOT EXISTS idx_class_students_transferred_to
    ON class_students (transferred_to_class_id)
    WHERE transferred_to_class_id IS NOT NULL;

COMMENT ON COLUMN class_students.status     IS 'ACTIVE | RESERVED (bảo lưu, vẫn giữ chỗ) | ENDED | TRANSFERRED';
COMMENT ON COLUMN class_students.ended_at   IS 'Thời điểm rời lớp; NULL khi còn ghi danh';
COMMENT ON COLUMN class_students.end_reason IS 'REMOVED_BY_TEACHER | REMOVED_BY_ORG | LEFT_ORG | …';

-- Mọi phép đếm sĩ số và mọi lần dựng roster đều lọc "còn chiếm ghế" theo lớp. Partial index giữ
-- đúng phần dòng nóng (lớp đã kết thúc để lại rất nhiều dòng ENDED mà không ai đọc nữa).
CREATE INDEX IF NOT EXISTS idx_class_students_class_enrolled
    ON class_students (class_id)
    WHERE status IN ('ACTIVE','RESERVED');

-- ─────────────────────────────────────────────────────────────────────────────
-- (b) TÁCH CHỨC DANH: "là giáo viên" ≠ "được dạy"  — CHUẨN BỊ CHO PR SAU
-- ─────────────────────────────────────────────────────────────────────────────
-- Đợt này CHỈ tạo cột + backfill, KHÔNG mã nào đọc, KHÔNG đổi hành vi.
-- An toàn: DEFAULT false nên mọi vai khác (OWNER/MANAGER/STUDENT) giữ nguyên nghĩa "không dạy";
-- backfill true đúng các dòng role='TEACHER' để bức ảnh hiện tại không đổi một li nào — hôm nay
-- mọi TEACHER đều dạy được. Câu UPDATE có điều kiện `can_teach = false` nên chạy lại là no-op.
ALTER TABLE org_members
    ADD COLUMN IF NOT EXISTS can_teach BOOLEAN NOT NULL DEFAULT false;

UPDATE org_members
SET    can_teach = true
WHERE  role = 'TEACHER'
  AND  can_teach = false;

COMMENT ON COLUMN org_members.can_teach IS
    'Được phân công dạy hay không — tách khỏi vai trò quản trị (dùng từ Đợt 4 PR sau)';

-- ─────────────────────────────────────────────────────────────────────────────
-- (c) SỔ VÀO/RA TRUNG TÂM (append-only) — CHUẨN BỊ CHO PR SAU
-- ─────────────────────────────────────────────────────────────────────────────
-- org_members có PK (org_id, user_id) nên mỗi cặp chỉ MỘT dòng: vào — ra — vào lại đè lên nhau,
-- lịch sử biến mất. Bảng này giữ từng lần. Đợt này CHỈ TẠO BẢNG, chưa ai ghi.
-- An toàn: bảng mới hoàn toàn, không đụng dữ liệu đang có.
CREATE TABLE IF NOT EXISTS org_member_history (
    id            BIGSERIAL   PRIMARY KEY,
    org_id        BIGINT      NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id       BIGINT      NOT NULL REFERENCES users(id)         ON DELETE CASCADE,
    action        VARCHAR(24) NOT NULL
                  CHECK (action IN ('JOINED','LEFT','REVOKED','ROLE_CHANGED')),
    from_role     VARCHAR(20),
    to_role       VARCHAR(20),
    actor_user_id BIGINT      REFERENCES users(id),
    note          VARCHAR(255),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_org_member_history_org_created
    ON org_member_history (org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_org_member_history_user
    ON org_member_history (user_id, created_at DESC);

COMMENT ON TABLE org_member_history IS
    'Append-only: mỗi lần một người vào/ra/đổi vai trong trung tâm (org_members chỉ giữ trạng thái hiện tại)';
