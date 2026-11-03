-- V352: Mở giáo trình A1–B1 cho lộ trình theo trình độ (QA 01/11/2026).
-- /roadmap/me chỉ lấy node có node_family, mà V144 chỉ gán cho ngày 11–30, nên ngày 1–10 + A2 + B1
-- không tới được học viên: B1 rơi về ngày 11, A0 mất điểm vào (ngày 1) nên cả cây khoá.

-- Mọi node gốc đều có mã: getRoadmapMeta đưa mã vào Map.of, mã NULL ở ngày 1 ném NPE (500).
-- Ngày 11–30 giữ mã A1-001…A1-020 của V144.
UPDATE skill_tree_nodes
SET node_code = CASE
    WHEN day_number <= 10 THEN 'A1-F' || LPAD(day_number::text, 2, '0')
    WHEN cefr_level = 'A2' THEN 'A2-' || LPAD((day_number - 30)::text, 3, '0')
    WHEN cefr_level = 'B1' THEN 'B1-' || LPAD((day_number - 50)::text, 3, '0')
END
WHERE node_type = 'CORE_TRUNK' AND node_code IS NULL AND day_number IS NOT NULL;

-- node_family = đã phát hành. Chỉ gán cho node có bài thật: 16 node A2 còn là vỏ rỗng (theory_cards
-- trống) phải ẩn, không thì học viên kẹt ở bài không có gì để học. Migration soạn nội dung cho các
-- node đó thì gán node_family và nối dependency tại chỗ.
UPDATE skill_tree_nodes
SET node_family = CASE WHEN phase = 'FOUNDATION' THEN 'FOUNDATION' ELSE 'CORE' END,
    mastery_threshold = COALESCE(NULLIF(mastery_threshold, 0), 70)
WHERE node_type = 'CORE_TRUNK'
  AND node_family IS NULL
  AND day_number IS NOT NULL
  AND jsonb_typeof(content_json -> 'theory_cards') = 'array'
  AND jsonb_array_length(content_json -> 'theory_cards') > 0;

-- V144 ghi tiền đề theo ngày ("D12") trong khi RoadmapService đối chiếu với node_code ("A1-002"):
-- không bao giờ khớp nên học viên kẹt vĩnh viễn ở ngày 13. Đổi sang mã thật.
UPDATE skill_tree_nodes n
SET prerequisites_json = (
    SELECT COALESCE(jsonb_agg(m.node_code ORDER BY e.ord), '[]'::jsonb)
    FROM jsonb_array_elements_text(n.prerequisites_json) WITH ORDINALITY AS e(code, ord)
    JOIN skill_tree_nodes m
      ON m.node_type = 'CORE_TRUNK'
     AND CONCAT('D', LPAD(m.day_number::text, 2, '0')) = e.code
)
WHERE n.node_type = 'CORE_TRUNK'
  AND jsonb_typeof(n.prerequisites_json) = 'array'
  AND n.prerequisites_json <> '[]'::jsonb;

-- Chuỗi dependency đi qua node đã phát hành: node rỗng không hoàn thành được nên không được chặn
-- node sau nó (35 chờ 34…). B1 chỉ nối trong skill_tree_edges (không code nào đọc) nên nối luôn ở đây.
DELETE FROM skill_tree_node_dependencies d
USING skill_tree_nodes tien_de, skill_tree_nodes n
WHERE tien_de.id = d.depends_on_node_id
  AND n.id = d.node_id
  AND tien_de.node_type = 'CORE_TRUNK' AND tien_de.node_family IS NULL
  AND n.node_type = 'CORE_TRUNK' AND n.node_family IS NOT NULL;

INSERT INTO skill_tree_node_dependencies (node_id, depends_on_node_id, dependency_type, min_score_percent)
SELECT id, truoc, 'HARD', 100
FROM (
    SELECT id, LAG(id) OVER (ORDER BY day_number) AS truoc
    FROM skill_tree_nodes
    WHERE node_type = 'CORE_TRUNK' AND node_family IS NOT NULL AND day_number IS NOT NULL
) chuoi
WHERE truoc IS NOT NULL
ON CONFLICT (node_id, depends_on_node_id) DO NOTHING;
