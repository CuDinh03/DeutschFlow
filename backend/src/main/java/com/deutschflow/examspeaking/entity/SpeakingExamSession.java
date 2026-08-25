package com.deutschflow.examspeaking.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.Map;

/**
 * Phiên luyện thi cá nhân. Trạng thái và đồng hồ là của server (client chỉ hiển thị).
 * plan_json: đề đã rút cho từng Teil + kịch bản bước (ai nói gì tiếp theo).
 */
@Entity
@Table(name = "speaking_exam_sessions")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SpeakingExamSession {

    public static final String MODE_DRILL = "DRILL";
    public static final String MODE_MOCK = "MOCK";

    public static final String STATE_PREP = "PREP";
    public static final String STATE_IN_PART = "IN_PART";
    public static final String STATE_BETWEEN = "BETWEEN";
    public static final String STATE_DONE = "DONE";
    public static final String STATE_GRADING = "GRADING";
    public static final String STATE_RESULTS = "RESULTS";
    public static final String STATE_ABORTED = "ABORTED";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "blueprint_id", nullable = false)
    private Long blueprintId;

    @Column(name = "mode", nullable = false, length = 8)
    private String mode;

    @Column(name = "state", nullable = false, length = 16)
    private String state;

    @Column(name = "drill_teil_no")
    private Integer drillTeilNo;

    @Column(name = "current_part", nullable = false)
    private int currentPart;

    @Column(name = "current_step", nullable = false)
    private int currentStep;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "plan_json", nullable = false, columnDefinition = "jsonb")
    private Map<String, Object> planJson;

    @Column(name = "notes_text", columnDefinition = "text")
    private String notesText;

    @Column(name = "prep_started_at")
    private Instant prepStartedAt;

    @Column(name = "part_started_at")
    private Instant partStartedAt;

    @Column(name = "part_deadline_at")
    private Instant partDeadlineAt;

    @Column(name = "grading_job_id")
    private Long gradingJobId;

    /** Vorbereitungszeit hiệu lực (giây): rút gọn 5′ mặc định hoặc chuẩn thi thật theo blueprint. */
    /**
     * true = giữ lại audio từng lượt nói lên S3 ({@link SpeakingExamTurn#getAudioRef()}).
     * Chỉ bật cho phiên MOCK của người đã đồng ý tham gia hiệu chuẩn (V284) — mặc định KHÔNG lưu.
     */
    @Builder.Default
    @Column(name = "retain_audio", nullable = false)
    private boolean retainAudio = false;

    @Column(name = "prep_sec")
    private Integer prepSec;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private Instant updatedAt;

    @Column(name = "finished_at")
    private Instant finishedAt;

    public boolean isMock() {
        return MODE_MOCK.equals(mode);
    }

    public boolean isTerminal() {
        return STATE_DONE.equals(state) || STATE_GRADING.equals(state)
                || STATE_RESULTS.equals(state) || STATE_ABORTED.equals(state);
    }
}
