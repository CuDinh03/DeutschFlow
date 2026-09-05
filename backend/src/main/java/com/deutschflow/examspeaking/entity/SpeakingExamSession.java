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
    /** Chấm nền thất bại (job FAILED/mồ côi) — client thấy lỗi thật + được chấm lại, không kẹt GRADING. */
    public static final String STATE_GRADING_FAILED = "GRADING_FAILED";
    public static final String STATE_ABORTED = "ABORTED";

    /** Lý do phiên ở GRADING_FAILED — client hiện đúng thông điệp (F-08: hết quota ≠ job chết). */
    public static final String GRADING_ERROR_QUOTA = "QUOTA_EXCEEDED";
    public static final String GRADING_ERROR_JOB_FAILED = "JOB_FAILED";
    public static final String GRADING_ERROR_JOB_STUCK = "JOB_STUCK";

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

    /** Lý do GRADING_FAILED (QUOTA_EXCEEDED | JOB_FAILED | JOB_STUCK); null khi không lỗi. Regrade xoá. */
    @Column(name = "grading_error", length = 64)
    private String gradingError;

    /**
     * Khoá lạc quan (audit 31/08 F-05): hai finish/lượt nói song song cùng phiên → lần commit sau ném
     * ObjectOptimisticLockingFailureException (409), không còn hai job chấm cùng lúc. Hibernate tự
     * khởi tạo 0 khi insert.
     */
    @jakarta.persistence.Version
    @Column(name = "version", nullable = false)
    private Long version;

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
                || STATE_RESULTS.equals(state) || STATE_GRADING_FAILED.equals(state)
                || STATE_ABORTED.equals(state);
    }
}
