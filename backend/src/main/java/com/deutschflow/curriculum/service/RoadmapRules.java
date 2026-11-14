package com.deutschflow.curriculum.service;

/**
 * Luật chung của lộ trình, dùng cho MỌI đường đọc và ghi (đợt 1 thiết kế lại lộ trình, 14/11/2026).
 *
 * <p>Trước đợt này {@code /roadmap/me} và {@code /skill-tree/me} lọc bài và mở khoá theo hai luật khác
 * nhau ({@code prerequisites_json} so với {@code skill_tree_node_dependencies}), nên mobile — đọc cả
 * hai — từng thấy hai trạng thái khác nhau cho cùng một bài. Mọi câu SQL cần lọc bài phát hành hoặc
 * xét bài đã mở phải lấy biểu thức từ đây, không tự viết lại.
 *
 * <ul>
 *   <li>ROUTE-01 — một luật mở khoá: bài mở khi mọi dòng {@code skill_tree_node_dependencies} của nó
 *       trỏ tới bài {@code COMPLETED}, hoặc tới bài nằm trước điểm vào theo trình độ
 *       ({@link RoadmapEntry}). {@code prerequisites_json} không còn quyết định trạng thái.</li>
 *   <li>ROUTE-02 — một bộ lọc phát hành: bài hiện khi {@code is_active} và {@code node_family} thuộc
 *       FOUNDATION, CORE, CHECKPOINT ({@code node_family} là cờ phát hành, V352).</li>
 *   <li>ROUTE-08 — số mục chấm điểm thật của bài: câu {@code MULTIPLE_CHOICE}/{@code FILL_BLANK} có
 *       {@code id} trong {@code exercises.theory_gate} và {@code exercises.practice}, đúng như
 *       {@link NodeExerciseGrader#countScored}.</li>
 * </ul>
 *
 * <p>Các biểu thức giả định bảng bài có bí danh {@code n}.
 */
public final class RoadmapRules {

    private RoadmapRules() {}

    /** ROUTE-02: bài đã phát hành. Không có tham số. */
    public static final String PUBLISHED =
            "n.is_active = TRUE AND n.node_family IN ('FOUNDATION', 'CORE', 'CHECKPOINT')";

    /**
     * ROUTE-01: biểu thức boolean "mọi tiền đề đã xong". Hai tham số theo thứ tự: {@code userId},
     * {@code entryDay} (tiền đề nằm trước điểm vào không tính).
     */
    public static final String DEPENDENCIES_MET = """
            NOT EXISTS (
                SELECT 1 FROM skill_tree_node_dependencies d
                JOIN skill_tree_nodes dn ON dn.id = d.depends_on_node_id
                LEFT JOIN skill_tree_user_progress dp
                    ON dp.node_id = d.depends_on_node_id AND dp.user_id = ?
                WHERE d.node_id = n.id
                  AND COALESCE(dn.day_number, 9999) >= ?
                  AND (dp.status IS NULL OR dp.status <> 'COMPLETED')
            )""";

    /** ROUTE-08: số mục chấm điểm thật của bài (đọc {@code content_json} trong SQL). Không có tham số. */
    public static final String SCORED_ITEM_COUNT = """
            (
                SELECT COUNT(*)
                FROM skill_tree_nodes c,
                     jsonb_array_elements(
                         CASE WHEN jsonb_typeof(c.content_json -> 'exercises' -> 'theory_gate') = 'array'
                              THEN c.content_json -> 'exercises' -> 'theory_gate' ELSE '[]'::jsonb END
                         || CASE WHEN jsonb_typeof(c.content_json -> 'exercises' -> 'practice') = 'array'
                              THEN c.content_json -> 'exercises' -> 'practice' ELSE '[]'::jsonb END
                     ) AS x
                WHERE c.id = n.id
                  AND jsonb_typeof(x) = 'object'
                  AND x ->> 'type' IN ('MULTIPLE_CHOICE', 'FILL_BLANK')
                  AND jsonb_typeof(x -> 'id') IS NOT NULL
                  AND jsonb_typeof(x -> 'id') <> 'null'
            )""";
}
