-- Audit C14/F-L9 (03/09/2026): audit_logs là bằng chứng forensics — giá trị của nó nằm ở chỗ
-- KHÔNG AI sửa/xoá được, kể cả chính ứng dụng. Trước đây immutability chỉ tồn tại ở tầng app
-- ("không code nào UPDATE/DELETE bảng này" — đã xác minh), tức một câu SQL lạc (bug, migration ẩu,
-- ai đó gõ tay qua kết nối app) xoá được vết mà không gì cản. Trigger BEFORE là chốt ở tầng DB:
-- hiệu lực với MỌI kết nối dùng role app, độc lập codebase.
--
-- Vì sao TRIGGER chứ không REVOKE: role app là chủ sở hữu bảng (Flyway chạy cùng role) — owner
-- REVOKE chính mình rồi vẫn tự GRANT lại được, còn trigger thì phải DROP tường minh (một hành động
-- có chủ đích, thấy được trong migration/lịch sử) chứ không vượt qua âm thầm được.
--
-- Bảng này KHÔNG có retention theo thiết kế ("giữ vĩnh viễn" — comment tại AdminManagementController);
-- nếu sau này cần dọn, migration đó phải DROP trigger trước — điểm quyết định lộ rõ, đúng chủ đích.

CREATE OR REPLACE FUNCTION audit_logs_block_mutation() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'audit_logs la append-only: % bi chan boi trg_audit_logs_immutable (C14)', TG_OP
        USING ERRCODE = 'raise_exception';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_logs_immutable ON audit_logs;

CREATE TRIGGER trg_audit_logs_immutable
    BEFORE UPDATE OR DELETE ON audit_logs
    FOR EACH ROW
    EXECUTE FUNCTION audit_logs_block_mutation();
