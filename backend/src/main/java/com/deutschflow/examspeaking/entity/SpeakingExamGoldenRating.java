package com.deutschflow.examspeaking.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

/**
 * G.1: MỘT band do giám khảo NGƯỜI chấm cho một tiêu chí/nhiệm vụ của một phiên mock
 * (V283). {@code teilNo = 0} = tiêu chí global của rubric. Điểm số của người chấm KHÔNG lưu —
 * RubricScorer tính lại từ band để dùng chung bảng quy điểm với máy.
 */
@Entity
@Table(name = "speaking_exam_golden_ratings")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SpeakingExamGoldenRating {

    public static final int TEIL_GLOBAL = 0;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "session_id", nullable = false)
    private Long sessionId;

    @Column(name = "rater_user_id", nullable = false)
    private Long raterUserId;

    @Column(name = "teil_no", nullable = false)
    private int teilNo;

    @Column(name = "criterion_code", nullable = false, length = 64)
    private String criterionCode;

    @Column(name = "band", nullable = false, length = 8)
    private String band;

    @Builder.Default
    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    @Builder.Default
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();
}
