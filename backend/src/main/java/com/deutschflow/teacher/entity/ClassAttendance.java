package com.deutschflow.teacher.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "class_attendance")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ClassAttendance {

    @EmbeddedId
    private ClassAttendanceId id;

    /** PRESENT | ABSENT | LATE */
    @Column(nullable = false, length = 10)
    private String status;

    @Column(columnDefinition = "TEXT")
    private String note;

    /** AC13 (V296): vắng → "cần bù riêng" (mặc định bật khi ABSENT, giáo viên bỏ được); lớp giữ tiến độ chung. */
    @Column(name = "needs_makeup", nullable = false)
    @Builder.Default
    private boolean needsMakeup = false;
}
