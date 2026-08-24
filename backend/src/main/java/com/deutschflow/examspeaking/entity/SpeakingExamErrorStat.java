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

import java.time.LocalDateTime;

/**
 * Thống kê lỗi luyện thi nói theo dạng bài (V282): một dòng = user × hệ × cấp × Teil × mã lỗi.
 * Upsert tại thời điểm ingest (chấm mock + chấm nhanh drill) — nguồn cho màn "Ôn yếu điểm".
 */
@Entity
@Table(name = "speaking_exam_error_stats")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SpeakingExamErrorStat {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "provider", nullable = false, length = 16)
    private String provider;

    @Column(name = "level", nullable = false, length = 8)
    private String level;

    @Column(name = "teil_no", nullable = false)
    private int teilNo;

    @Column(name = "archetype", nullable = false, length = 32)
    private String archetype;

    @Column(name = "error_code", nullable = false, length = 80)
    private String errorCode;

    @Column(name = "seen_count", nullable = false)
    @Builder.Default
    private int seenCount = 0;

    @Column(name = "last_seen_at", nullable = false)
    private LocalDateTime lastSeenAt;

    @Column(name = "last_original")
    private String lastOriginal;

    @Column(name = "last_correction")
    private String lastCorrection;
}
