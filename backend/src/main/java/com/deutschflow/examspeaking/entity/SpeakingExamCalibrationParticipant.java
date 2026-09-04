package com.deutschflow.examspeaking.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

/**
 * Người học đã ĐỒNG Ý cho lưu audio phục vụ hiệu chuẩn chấm điểm (G.2/G.3).
 *
 * Sự tồn tại của dòng này là điều kiện DUY NHẤT để phiên MOCK giữ lại audio.
 * Xoá dòng = rút lại đồng ý (kèm purge audio qua endpoint admin).
 */
@Entity
@Table(name = "speaking_exam_calibration_participants")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SpeakingExamCalibrationParticipant {

    @Id
    @Column(name = "user_id", nullable = false)
    private Long userId;

    /** Thời điểm người học đồng ý — ghi nhận tường minh, không suy diễn từ việc "có audio". */
    @Column(name = "consented_at", nullable = false)
    private Instant consentedAt;

    @Column(name = "note", length = 255)
    private String note;

    @Column(name = "created_by")
    private Long createdBy;

    @Column(name = "created_at", updatable = false)
    private Instant createdAt;
}
