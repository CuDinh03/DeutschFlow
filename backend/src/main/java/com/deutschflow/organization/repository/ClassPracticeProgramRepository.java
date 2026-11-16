package com.deutschflow.organization.repository;

import com.deutschflow.organization.entity.ClassPracticeProgram;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;

public interface ClassPracticeProgramRepository extends JpaRepository<ClassPracticeProgram, Long> {

    /**
     * Học viên có đang ACTIVE trong một lớp có chương trình luyện CHƯA KẾT THÚC tại {@code today} (giờ VN)
     * không — kể cả chương trình chưa tới ngày bắt đầu, để học viên quen "chỉ nói" từ buổi 0.
     */
    @Query(value = """
            SELECT EXISTS (
                SELECT 1
                FROM   class_students cs
                JOIN   class_practice_programs p ON p.class_id = cs.class_id
                WHERE  cs.student_id = :studentId
                AND    cs.status = 'ACTIVE'
                AND    :today < p.start_date + 7 * p.weeks
            )
            """, nativeQuery = true)
    boolean isStudentInRunningProgram(@Param("studentId") Long studentId, @Param("today") LocalDate today);
}
