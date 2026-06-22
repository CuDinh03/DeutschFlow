package com.deutschflow.teacher.entity;

import com.deutschflow.user.entity.User;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;

@Entity
@Table(name = "teacher_profiles")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TeacherProfile {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false)
    private String headline;

    @Column(columnDefinition = "TEXT")
    private String bio;

    @Column(columnDefinition = "TEXT")
    private String qualifications;

    @Column(name = "is_featured", nullable = false)
    @Builder.Default
    private boolean featured = false;

    @Column(name = "hourly_rate_vnd")
    @Builder.Default
    private long hourlyRateVnd = 200_000L;

    @Column(name = "max_students_per_week")
    @Builder.Default
    private int maxStudentsPerWeek = 10;

    /** Weekly-recurring availability ("Lịch dạy") as JSON: [{ "day":0-6, "start":"HH:mm", "end":"HH:mm" }]. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "available_slots_json", columnDefinition = "jsonb")
    private String availableSlotsJson;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) createdAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
