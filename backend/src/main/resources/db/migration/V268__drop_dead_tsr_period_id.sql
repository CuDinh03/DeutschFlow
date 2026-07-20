-- ============================================================
-- V268: GỠ cột chết teacher_session_record.period_id
-- ============================================================
-- V264 thêm period_id + fk_tsr_period + idx_tsr_period với ý định nối dòng công vào kỳ. Nhưng thực tế
-- việc "dòng công thuộc kỳ nào" được suy HOÀN TOÀN theo KHOẢNG NGÀY (snapshotTotals và assertRecordEditable
-- tra theo started_at ∈ [period_start, period_end]). Entity TeacherSessionRecord KHÔNG map period_id và
-- không dòng nào ghi giá trị cho nó → cột luôn NULL, FK và partial index phủ 0 hàng = chi phí thừa, lại
-- gợi ý sai rằng bản ghi được nối FK vào kỳ.
--
-- Từ V267 kỳ công KHÔNG còn chồng ngày, nên ánh xạ theo khoảng ngày là hàm TOÀN PHẦN (mỗi dòng công rơi
-- vào tối đa một kỳ) — không cần period_id để khử nhập nhằng nữa. Gỡ cho sơ đồ trung thực với mã.
-- Tính năng chưa deploy (main dừng ở V261) nên gỡ an toàn, không mất dữ liệu.
-- ============================================================

ALTER TABLE teacher_session_record DROP CONSTRAINT IF EXISTS fk_tsr_period;
DROP INDEX IF EXISTS idx_tsr_period;
ALTER TABLE teacher_session_record DROP COLUMN IF EXISTS period_id;
