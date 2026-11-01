-- Hàm phát hành bài trong giáo trình gốc, dùng sau khi người duyệt chốt nội dung nháp (V353, V354).
--
-- Duyệt xong chỉ cần một migration mới một dòng, duyệt theo đợt cũng được:
--     SELECT phat_hanh_node_goc(ARRAY[32, 33, 34]);
-- Hàm gán node_family (cờ phát hành) rồi nối lại chuỗi dependency qua các node đã phát hành, nên
-- node chưa duyệt không chặn node sau nó. Cùng cách V352 nhưng chạy lại được, và cũng dọn đường tắt
-- V352 để lại (35 chờ 31, 51 chờ 40) khi các bài ở giữa được phát hành.
-- Không đụng A1: chuỗi ngày 1–30 đã xong ở V352. Bài tổng kết cấp là CHECKPOINT như ngày 27–30.
-- Node chưa có theory_cards không phát hành được: vỏ rỗng mà hiện ra thì học viên kẹt.

CREATE OR REPLACE FUNCTION phat_hanh_node_goc(p_days INT[]) RETURNS INT AS $$
DECLARE
    so_node INT;
BEGIN
    UPDATE skill_tree_nodes
    SET node_family = CASE WHEN session_type = 'EXAM' THEN 'CHECKPOINT' ELSE 'CORE' END,
        mastery_threshold = COALESCE(NULLIF(mastery_threshold, 0), 70)
    WHERE node_type = 'CORE_TRUNK'
      AND node_family IS NULL
      AND day_number = ANY (p_days)
      AND jsonb_typeof(content_json -> 'theory_cards') = 'array'
      AND jsonb_array_length(content_json -> 'theory_cards') > 0;
    GET DIAGNOSTICS so_node = ROW_COUNT;

    DELETE FROM skill_tree_node_dependencies d
    USING skill_tree_nodes n, skill_tree_nodes tien_de
    WHERE n.id = d.node_id
      AND tien_de.id = d.depends_on_node_id
      AND n.node_type = 'CORE_TRUNK' AND n.node_family IS NOT NULL AND n.day_number > 30
      AND tien_de.node_type = 'CORE_TRUNK';

    INSERT INTO skill_tree_node_dependencies (node_id, depends_on_node_id, dependency_type, min_score_percent)
    SELECT id, truoc, 'HARD', 100
    FROM (
        SELECT id, day_number, LAG(id) OVER (ORDER BY day_number) AS truoc
        FROM skill_tree_nodes
        WHERE node_type = 'CORE_TRUNK' AND node_family IS NOT NULL AND day_number IS NOT NULL
    ) chuoi
    WHERE truoc IS NOT NULL AND day_number > 30
    ON CONFLICT (node_id, depends_on_node_id) DO NOTHING;

    RETURN so_node;
END;
$$ LANGUAGE plpgsql;
