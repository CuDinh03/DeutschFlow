-- Xưởng đề — danh mục nguồn: thêm cách lấy danh sách bài bằng sitemap, bật cho oesterreich.gv.at
-- (owner chốt 12/11/2026: thêm nguồn này trước bộ đề tự động đầu tiên).
--
-- oesterreich.gv.at không có feed nhưng công bố sitemap (~3,5 MB, ~13 000 địa chỉ). Chỉ lấy các mục đời sống
-- hợp đề B1–B2; bỏ pháp luật, chính trị, EU, người nước ngoài, thuế, tội phạm (luật chủ đề trung lập).
-- Chỉ nới ràng buộc và sửa một dòng dữ liệu: màu cũ vẫn chạy được.

ALTER TABLE exam_source_feeds DROP CONSTRAINT IF EXISTS exam_source_feeds_listing_kind_check;
ALTER TABLE exam_source_feeds ADD CONSTRAINT exam_source_feeds_listing_kind_check
    CHECK (listing_kind IN ('RSS', 'INDEX_PAGE', 'SITEMAP', 'NONE'));

UPDATE exam_source_feeds
SET listing_url       = 'https://www.oesterreich.gv.at/sitemap.xml',
    listing_kind      = 'SITEMAP',
    link_pattern      = '/de/themen/(bauen_und_wohnen|familie_und_partnerschaft|reisen_und_freizeit|arbeit_beruf_und_pension|bildung_und_ausbildung|mobilitaet|gesundheit|pflege|umwelt_und_klima|onlinesicherheit_internet_und_neue_medien|hilfe_leisten)/[^?#]+$',
    min_delay_seconds = 3600,
    notes             = 'Trang hướng dẫn đời sống (nhà ở, gia đình, việc làm, giáo dục, đi lại, sức khoẻ, môi trường); tiếng Đức Áo. Lấy địa chỉ từ sitemap; tiêu đề tạm suy từ đường dẫn.'
WHERE code = 'OESTERREICH_GV';
