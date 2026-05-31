package com.deutschflow.teacher.dto;

import com.deutschflow.teacher.entity.TeacherSession;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
public class TeacherSessionDto {
    private Long id;
    private Long studentId;
    private String studentName;
    private Long teacherProfileId;
    private String teacherName;
    private String title;
    private String notes;
    private LocalDateTime scheduledAt;
    private int durationMinutes;
    private long priceVnd;
    private String status;
    private String paymentStatus;
    private Short teacherRating;
    private String studentReviewText;
    private String payoutStatus;
    private LocalDateTime createdAt;

    public static TeacherSessionDto from(TeacherSession s) {
        return TeacherSessionDto.builder()
                .id(s.getId())
                .studentId(s.getStudent().getId())
                .studentName(s.getStudent().getDisplayName())
                .teacherProfileId(s.getTeacherProfile().getId())
                .teacherName(s.getTeacherProfile().getUser().getDisplayName())
                .title(s.getTitle())
                .notes(s.getNotes())
                .scheduledAt(s.getScheduledAt())
                .durationMinutes(s.getDurationMinutes())
                .priceVnd(s.getPriceVnd())
                .status(s.getStatus().name())
                .paymentStatus(s.getPaymentStatus().name())
                .teacherRating(s.getTeacherRating())
                .studentReviewText(s.getStudentReviewText())
                .payoutStatus(s.getPayoutStatus().name())
                .createdAt(s.getCreatedAt())
                .build();
    }
}
