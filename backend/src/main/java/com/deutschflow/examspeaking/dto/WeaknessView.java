package com.deutschflow.examspeaking.dto;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Màn "Ôn yếu điểm" (Đợt 5a): yếu điểm gộp theo mã lỗi (xếp theo priority của kho SRS),
 * mỗi mã kèm ngữ cảnh dạng bài (hệ × cấp × Teil × archetype) để lọc, + các gói Redemittel
 * khớp những dạng bài đang yếu.
 */
public record WeaknessView(List<WeakPoint> weakPoints, List<RedemittelPack> packs) {

    public record WeakPoint(
            String errorCode,
            String ruleVi,
            /** Số lần gặp TRONG phòng luyện thi (tổng seenCount các stats exam) — số chính trên UI. */
            int examCount,
            /** Số lần gặp trên MỌI tính năng luyện nói (user_error_skills.totalCount) — ngữ cảnh phụ. */
            int totalCount,
            int openCount,
            String lastSeverity,
            LocalDateTime lastSeenAt,
            String exampleOriginal,
            String exampleCorrection,
            List<Context> contexts
    ) {}

    /** Một dạng bài mà mã lỗi này từng xuất hiện. */
    public record Context(String provider, String level, int teilNo, String archetype, int count, LocalDateTime lastSeenAt) {}

    public record RedemittelPack(String archetype, List<String> phrases) {}
}
