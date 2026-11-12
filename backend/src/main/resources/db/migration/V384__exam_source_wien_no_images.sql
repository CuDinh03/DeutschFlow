-- Xưởng đề — feed Rathauskorrespondenz Wien lẫn mục ẢNH (/presse/bilder/…): trang không có chữ, lượt tạo bộ đề #6
-- loại liền 6 bài vì "đọc được 0 ký tự". Chỉ nhận đường dẫn tin bài /presse/YYYY/MM/DD/…; mẫu này giờ áp cho cả
-- nguồn RSS (SourceCatalogService.poll). Các mục ảnh đã nằm trong sổ được chuyển sang "loại".
-- Chỉ sửa dữ liệu: màu cũ vẫn chạy được.

UPDATE exam_source_feeds
SET link_pattern = 'presse\.wien\.gv\.at/presse/\d{4}/\d{2}/\d{2}/[^/?#]+$'
WHERE code = 'WIEN_RK';

UPDATE exam_source_articles a
SET status = 'REJECTED', reject_reason = 'Mục ảnh của feed, không phải tin bài.'
FROM exam_source_feeds f
WHERE f.id = a.feed_id AND f.code = 'WIEN_RK' AND a.status = 'SEEN' AND a.url LIKE '%/presse/bilder/%';
