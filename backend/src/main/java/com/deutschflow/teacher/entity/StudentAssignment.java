package com.deutschflow.teacher.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.time.LocalDateTime;
import java.util.Map;

@Entity
@Table(name = "student_assignments")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class StudentAssignment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "assignment_id", nullable = false)
    private Long assignmentId;

    @Column(name = "student_id", nullable = false)
    private Long studentId;

    /** See {@link AssignmentStatus} for the values and the state machine. No DB CHECK — plain varchar. */
    @Column(length = 50, nullable = false)
    @Builder.Default
    private String status = AssignmentStatus.PENDING;

    /** Optimistic-lock version — a stale grade write throws instead of clobbering (auto-grade audit, Đợt 3). */
    @Version
    @Column(nullable = false)
    @Builder.Default
    private Long version = 0L;

    private Integer score;

    @Column(columnDefinition = "TEXT")
    private String feedback;

    /** AI per-criterion sub-scores, e.g. {"grammar":85,"vocabulary":78,"content":90} (0–100). */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "criteria_json", columnDefinition = "jsonb")
    private Map<String, Integer> criteria;

    /** AI self-confidence (0–100) in its own auto-score; null when the model didn't report one. */
    @Column(name = "ai_confidence")
    private Integer aiConfidence;

    /**
     * Điểm AI ĐỀ XUẤT — cột RIÊNG (V323, R3). AI ghi DUY NHẤT qua {@link #applyAiProposal}; giáo viên chốt
     * ({@code TeacherService.evaluateAssignment}) chỉ ghi {@link #score}/{@link #feedback}, KHÔNG đụng ba
     * trường này — nên đề xuất của AI sống sót sau khi bị sửa (giáo viên xem lại; chỉ số M5 =
     * {@code |ai_score - score|} trên bài EVALUATED). NULL ở dòng EVALUATED trước V323 = điểm AI đã mất,
     * không dựng lại. Không lộ ra học viên ({@code StudentAssignmentDto.forStudent} không mang) và không in
     * lên phiếu phụ huynh (R4).
     */
    @Column(name = "ai_score")
    private Integer aiScore;

    @Column(name = "ai_feedback", columnDefinition = "TEXT")
    private String aiFeedback;

    @Column(name = "ai_graded_at")
    private Instant aiGradedAt;

    @Column(name = "submitted_at")
    private LocalDateTime submittedAt;

    @Column(name = "graded_at")
    private LocalDateTime gradedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "submission_content", columnDefinition = "TEXT")
    private String submissionContent;

    @Column(name = "submission_file_url", length = 1024)
    private String submissionFileUrl;

    @Column(name = "is_deleted")
    @Builder.Default
    private boolean deleted = false;

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) createdAt = LocalDateTime.now();
    }

    /**
     * AI đề xuất điểm (R3, V323): ghi {@code ai_*} RIÊNG và đồng thời chép sang {@code score/feedback} +
     * {@link AssignmentStatus#AI_GRADED}, vì hàng đợi chấm đang đọc {@code score} khi AI_GRADED (không phá
     * giao diện đang chạy). Đây là đường ghi DUY NHẤT của {@code ai_*} — cả ba nơi gọi AI (GradingService
     * bài viết, GradingController ảnh, TeacherAiGradingService nói) đều đi qua đây để không nơi nào quên
     * một cột. Caller tự kiểm trạng thái (không đè bài đã chốt) TRƯỚC khi gọi; {@code submittedAt} không đụng.
     */
    public void applyAiProposal(Integer proposedScore, String proposedFeedback) {
        this.aiScore = proposedScore;
        this.aiFeedback = proposedFeedback;
        this.aiGradedAt = Instant.now();
        this.score = proposedScore;
        this.feedback = proposedFeedback;
        this.status = AssignmentStatus.AI_GRADED;
        this.gradedAt = LocalDateTime.now();
    }
}
