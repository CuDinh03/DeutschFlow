package com.deutschflow.teacher.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

/**
 * Một mục nội dung được PHÂN BỔ vào một buổi (PR-4, spec §5/AC06). Vòng đời:
 * {@code PLANNED} (kế hoạch) → giáo viên xác nhận sau buổi thành {@code TAUGHT} (dạy xong) hoặc
 * {@code PARTIAL} (dở — kèm {@code remainingMinutes} ước tính, không ép chính xác giả); phần dở
 * sinh MỘT dòng kế hoạch mới ở buổi kế tiếp trỏ ngược qua {@code carriedFromId} — giữ liên kết
 * gốc, không nhân bản nội dung thành bài đếm-hai-lần (spec §5).
 *
 * <p>{@code curriculumItemId} trỏ mục BẮT BUỘC của giáo trình (bài sinh từ Lektion); NULL cho
 * phân bổ của bài bổ trợ/tự do. Hoàn thành Lektion suy từ: mọi item bắt buộc có ≥1 dòng TAUGHT
 * (AC07/AC08) — xem SessionContentService.
 */
@Entity
@Table(name = "class_session_contents")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ClassSessionContent {

    public static final String STATUS_PLANNED = "PLANNED";
    public static final String STATUS_TAUGHT = "TAUGHT";
    public static final String STATUS_PARTIAL = "PARTIAL";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "session_id", nullable = false)
    private Long sessionId;

    @Column(name = "class_lesson_id", nullable = false)
    private Long classLessonId;

    @Column(name = "curriculum_item_id")
    private Long curriculumItemId;

    @Column(name = "order_index", nullable = false)
    private Integer orderIndex;

    /** Phút dự kiến cho mục này trong buổi; null = chưa ước lượng. DB CHECK > 0 (V293). */
    @Column(name = "planned_minutes")
    private Integer plannedMinutes;

    @Column(nullable = false, length = 12)
    @Builder.Default
    private String status = STATUS_PLANNED;

    @Column(name = "actual_minutes")
    private Integer actualMinutes;

    /** Phút CÒN LẠI ước tính khi PARTIAL — nguồn cho dòng chuyển tiếp ở buổi kế. */
    @Column(name = "remaining_minutes")
    private Integer remainingMinutes;

    /** Dòng gốc mà dòng này chuyển tiếp từ đó (phần dở buổi trước) — truy vết theo spec §5. */
    @Column(name = "carried_from_id")
    private Long carriedFromId;

    @Column(name = "confirmed_by")
    private Long confirmedBy;

    @Column(name = "confirmed_at")
    private LocalDateTime confirmedAt;

    @Column(columnDefinition = "TEXT")
    private String note;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        LocalDateTime now = LocalDateTime.now();
        if (createdAt == null) createdAt = now;
        if (updatedAt == null) updatedAt = now;
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
