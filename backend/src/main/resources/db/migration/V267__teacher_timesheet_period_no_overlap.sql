-- ============================================================
-- V267: CHẶN KỲ CÔNG CHỒNG NGÀY — chốt cứng phía DB
-- ============================================================
-- V264 chỉ có uq_ttp_teacher_period(teacher_id, period_start): một giáo viên không có hai kỳ CÙNG
-- mốc bắt đầu. Nhưng nó KHÔNG chặn hai kỳ khác mốc bắt đầu mà giao ngày nhau, ví dụ:
--     A = 01/01 – 31/01   và   B = 15/01 – 15/02   (chồng 15–31/01).
--
-- Chồng kỳ gây HAI lỗi thật:
--   1) TRẢ LƯƠNG HAI LẦN: snapshotTotals() đếm dòng công theo KHOẢNG NGÀY của kỳ, không theo period_id,
--      nên các buổi 15–31/01 được cộng vào tổng của CẢ A lẫn B; orgSummary()/exportOrgCsv() cộng dồn
--      mọi kỳ → mỗi buổi chồng bị tính (và trả) hai lần.
--   2) HTTP 500: assertRecordEditable() tra kỳ phủ một ngày; nếu hai kỳ cùng phủ ngày đó, truy vấn
--      khớp nhiều dòng. (Đã đổi finder sang List ở tầng service, nhưng gốc rễ là chồng kỳ.)
--
-- Vì giáo viên tự mở kỳ với from/to bất kỳ (POST /periods) và họ là người HƯỞNG LỢI khi trả thừa,
-- bất biến "không chồng kỳ" phải được DB bảo đảm, không chỉ tầng service.
--
-- daterange dùng biên ĐÓNG '[]' vì period_end là ngày cuối NẰM TRONG kỳ (buổi 31/01 thuộc kỳ kết thúc
-- 31/01). btree_gist cho phép đưa teacher_id (=) và daterange (&&) vào chung một chỉ mục GiST.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS btree_gist;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'excl_ttp_no_overlap') THEN
    ALTER TABLE teacher_timesheet_period
      ADD CONSTRAINT excl_ttp_no_overlap
      EXCLUDE USING gist (
        teacher_id WITH =,
        daterange(period_start, period_end, '[]') WITH &&
      );
  END IF;
END $$;

COMMENT ON CONSTRAINT excl_ttp_no_overlap ON teacher_timesheet_period IS
    'Cấm một giáo viên có hai kỳ công giao ngày nhau — chồng kỳ làm buổi trong vùng giao bị trả lương hai lần và khớp nhiều kỳ khi tra cứu.';
