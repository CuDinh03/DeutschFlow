package com.deutschflow.teacher.repository;

import com.deutschflow.teacher.entity.TeacherSession;
import com.deutschflow.teacher.entity.TeacherSession.PayoutStatus;
import com.deutschflow.teacher.entity.TeacherSession.Status;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface TeacherSessionRepository extends JpaRepository<TeacherSession, Long> {

    @Query("SELECT s FROM TeacherSession s JOIN FETCH s.teacherProfile tp JOIN FETCH tp.user WHERE s.student.id = :studentId ORDER BY s.scheduledAt DESC")
    Page<TeacherSession> findByStudentId(@Param("studentId") Long studentId, Pageable pageable);

    @Query("SELECT s FROM TeacherSession s JOIN FETCH s.student WHERE s.teacherProfile.id = :profileId ORDER BY s.scheduledAt DESC")
    Page<TeacherSession> findByTeacherProfileId(@Param("profileId") Long profileId, Pageable pageable);

    @Query("SELECT s FROM TeacherSession s JOIN FETCH s.student JOIN FETCH s.teacherProfile WHERE s.id = :id")
    Optional<TeacherSession> findByIdFull(@Param("id") Long id);

    @Query("SELECT COALESCE(SUM(s.priceVnd), 0) FROM TeacherSession s WHERE s.teacherProfile.id = :profileId AND s.status = 'COMPLETED' AND s.paymentStatus = 'PAID'")
    long sumEarningsByTeacherProfile(@Param("profileId") Long profileId);

    @Query("SELECT s FROM TeacherSession s JOIN FETCH s.student JOIN FETCH s.teacherProfile WHERE s.payoutStatus = :payoutStatus ORDER BY s.updatedAt DESC")
    List<TeacherSession> findByPayoutStatus(@Param("payoutStatus") PayoutStatus payoutStatus);
}
