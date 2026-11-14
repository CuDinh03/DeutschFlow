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
     * ROUTE-01: biểu thức boolean "mọi tiền đề đã xong" — "xong" theo đúng định nghĩa của
     * {@link #status}: {@code COMPLETED} hoặc điểm tốt nhất đạt ngưỡng của bài đó. Hai tham số theo
     * thứ tự: {@code userId}, {@code entryDay} (tiền đề nằm trước điểm vào không tính).
     */
    public static final String DEPENDENCIES_MET = """
            NOT EXISTS (
                SELECT 1 FROM skill_tree_node_dependencies d
                JOIN skill_tree_nodes dn ON dn.id = d.depends_on_node_id
                LEFT JOIN skill_tree_user_progress dp
                    ON dp.node_id = d.depends_on_node_id AND dp.user_id = ?
                WHERE d.node_id = n.id
                  AND COALESCE(dn.day_number, 9999) >= ?
                  AND NOT (COALESCE(dp.status, '') = 'COMPLETED'
                           OR COALESCE(dp.best_score, 0) >= CASE
                                  WHEN dn.mastery_threshold BETWEEN 1 AND 100 THEN dn.mastery_threshold
                                  ELSE 70 END)
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

    /** Ngưỡng đạt của bài; giá trị thiếu hoặc ngoài 1–100 dùng 70 (như lúc nộp bài). */
    public static int mastery(Object raw) {
        int m = raw instanceof Number n ? n.intValue() : 0;
        return m >= 1 && m <= 100 ? m : 70;
    }

    /**
     * ROUTE-09: trạng thái MỘT bài cho học viên, dùng chung cho {@code /skill-tree/me} và
     * {@code /roadmap/me} để hai đường không bao giờ lệch nhau.
     *
     * <ul>
     *   <li>{@code COMPLETED}: dòng tiến độ COMPLETED, hoặc điểm tốt nhất đạt ngưỡng của bài;</li>
     *   <li>{@code IN_PROGRESS}: đã bắt đầu;</li>
     *   <li>{@code UNLOCKED}: đã có dòng mở khoá, hoặc mọi tiền đề đã xong ({@link #DEPENDENCIES_MET});</li>
     *   <li>{@code LOCKED}: còn lại.</li>
     * </ul>
     */
    public static String status(Object userStatus, Object bestScore, Object masteryThreshold, Object dependenciesMet) {
        String st = userStatus == null ? "LOCKED" : userStatus.toString();
        int best = bestScore instanceof Number n ? n.intValue() : 0;
        if ("COMPLETED".equals(st) || best >= mastery(masteryThreshold)) {
            return "COMPLETED";
        }
        if ("IN_PROGRESS".equals(st)) {
            return "IN_PROGRESS";
        }
        if ("UNLOCKED".equals(st) || Boolean.TRUE.equals(dependenciesMet)) {
            return "UNLOCKED";
        }
        return "LOCKED";
    }
}
