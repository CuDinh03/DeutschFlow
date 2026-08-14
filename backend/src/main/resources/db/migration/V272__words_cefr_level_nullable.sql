-- Phân cấp CEFR (báo cáo 14/08/2026): words.cefr_level được tạo ở V1 là NOT NULL DEFAULT 'A1', nên MỌI từ
-- không rõ cấp đều rơi vào A1 — A1 trở thành thùng rác và bộ lọc cấp độ trên /v2/student/vocabulary vô nghĩa.
-- Từ nay chỉ wordlist Goethe chính thức (CefrLevelResolver) mới được gán cấp; từ ngoài wordlist để NULL
-- = "chưa phân cấp", tức trạng thái THẬT thay vì một cấp bịa ra.
--
-- Migration này CHỈ đổi ràng buộc cột, KHÔNG viết lại dữ liệu cũ. Việc gán lại cấp cho toàn bộ kho chạy
-- có chủ đích qua POST /api/admin/vocabulary/cefr/reclassify (OfficialCefrVocabularyImportService.reclassifyAllWords).

ALTER TABLE words ALTER COLUMN cefr_level DROP DEFAULT;
ALTER TABLE words ALTER COLUMN cefr_level DROP NOT NULL;

COMMENT ON COLUMN words.cefr_level IS
    'Cấp CEFR theo wordlist Goethe chính thức. NULL = chưa phân cấp (không có trong wordlist nào) — đừng gán mặc định A1.';
