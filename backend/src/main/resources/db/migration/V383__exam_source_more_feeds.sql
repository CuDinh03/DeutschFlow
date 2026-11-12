-- Xưởng đề — thêm nguồn cho dây chuyền tạo bộ đề (owner chọn qua bảng chọn 12/11/2026).
--
-- Lý do: lượt chạy thật cho thấy trang oesterreich.gv.at phần lớn quá ngắn, máy thực chất chỉ dựa vào khoảng 70 bài
-- của Destatis, EU, Leibniz — sẽ cạn sau vài bộ. Giấy phép, feed và robots.txt của từng nơi dưới đây đã mở đọc
-- ngày 12/11/2026.
-- Chỉ sửa một dòng dữ liệu và thêm dòng mới: màu cũ vẫn chạy được.

-- Statistik Berlin-Brandenburg (đã trong danh mục, CC BY 3.0 DE): không có feed nhưng sitemap liệt kê hơn 1 000
-- thông cáo dạng /NNN-YYYY, kèm ngày sửa. Sitemap không có tiêu đề ⇒ máy lấy tiêu đề thật từ trang (SourceCatalogService).
UPDATE exam_source_feeds
SET listing_url       = 'https://www.statistik-berlin-brandenburg.de/sitemap.xml',
    listing_kind      = 'SITEMAP',
    link_pattern      = 'statistik-berlin-brandenburg\.de/\d{3}-\d{4}$',
    min_delay_seconds = 3600,
    notes             = 'Thông cáo thống kê của Berlin và Brandenburg (khoảng 2 600 ký tự mỗi bài). Lấy địa chỉ từ sitemap, tiêu đề lấy từ trang.'
WHERE code = 'STATISTIK_BBB';

INSERT INTO exam_source_feeds
    (code, publisher, home_url, listing_url, listing_kind, link_pattern, usage_class, license_name, license_url,
     attribution, min_delay_seconds, notes, approved_on)
VALUES
    ('BFR', 'Bundesinstitut für Risikobewertung (BfR)', 'https://www.bfr.bund.de',
     'https://www.bfr.bund.de/presse/presseinformationen/', 'INDEX_PAGE', '/presseinformation/[^/?#]+$', 'ADAPT',
     'CC BY 4.0 (văn bản của BfR)', 'https://www.bfr.bund.de/de/impressum.html',
     'Bundesinstitut für Risikobewertung (BfR)', 30,
     'An toàn thực phẩm, sức khoẻ người tiêu dùng. Không có feed: lấy từ trang danh sách thông cáo. robots.txt yêu cầu chờ 30 giây.',
     DATE '2026-11-12'),
    ('ESO_DE', 'Europäische Südsternwarte (ESO)', 'https://www.eso.org/public/germany/',
     'https://www.eso.org/public/germany/news/feed/', 'RSS', NULL, 'ADAPT',
     'CC BY 4.0', 'https://www.eso.org/public/germany/copyright/',
     'ESO', 5, 'Thiên văn. Khoảng một bài mỗi tháng, bài dài.', DATE '2026-11-12'),
    -- Hạng CHỈ DỮ KIỆN: cho dùng lại kèm ghi nguồn nhưng không cho sửa / không nói rõ quyền sửa.
    ('STATISTIK_NORD', 'Statistisches Amt für Hamburg und Schleswig-Holstein', 'https://www.statistik-nord.de',
     'https://www.statistik-nord.de/presse-veroeffentlichungen/presseinformationen/feed/803/feed.xml', 'RSS', NULL,
     'FACTS_ONLY', 'Weiterverbreitung mit Quellenangabe, keine Veränderung', 'https://www.statistik-nord.de/impressum',
     'Statistikamt Nord', 5, 'Thông cáo thống kê Hamburg và Schleswig-Holstein.', DATE '2026-11-12'),
    ('IT_NRW', 'IT.NRW — Statistisches Landesamt Nordrhein-Westfalen', 'https://www.it.nrw',
     'https://www.it.nrw/rss.xml', 'RSS', NULL,
     'FACTS_ONLY', 'Vervielfältigung mit Quellenangabe', 'https://www.it.nrw/impressum',
     'IT.NRW', 5, 'Thông cáo thống kê Nordrhein-Westfalen.', DATE '2026-11-12'),
    ('WIEN_RK', 'Stadt Wien — Rathauskorrespondenz', 'https://presse.wien.gv.at',
     'https://presse.wien.gv.at/web/presse/rss/-/asset_publisher/jH1vdQZIY6C9/rss?feedType=RKSuche&meldungen=1&bilder=0',
     'RSS', NULL,
     'FACTS_ONLY', 'Amtliche Mitteilungen frei weiterverwendbar (Bearbeitung nicht ausdrücklich geregelt)',
     'https://www.wien.gv.at/inhalt/impressum',
     'Stadt Wien — Rathauskorrespondenz', 5,
     'Tin thành phố Wien: văn hoá, dịch vụ, sự kiện; có lẫn tin chính trị thành phố (cờ trung lập lọc). robots.txt của máy chủ không đọc được (403).',
     DATE '2026-11-12')
ON CONFLICT (code) DO NOTHING;
