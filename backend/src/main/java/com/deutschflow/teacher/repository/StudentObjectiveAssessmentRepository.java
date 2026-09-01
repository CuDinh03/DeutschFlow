package com.deutschflow.teacher.repository;

import com.deutschflow.teacher.entity.StudentObjectiveAssessment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface StudentObjectiveAssessmentRepository
        extends JpaRepository<StudentObjectiveAssessment, Long> {

    /** Các bản ĐANG HIỆU LỰC của lớp (mỗi (student, objective) đúng một bản — uq_soa_current). */
    List<StudentObjectiveAssessment> findByClassIdAndSupersededFalse(Long classId);

    Optional<StudentObjectiveAssessment> findByClassIdAndStudentIdAndObjectiveIdAndSupersededFalse(
            Long classId, Long studentId, Long objectiveId);

    /** Lịch sử một (học viên, mục tiêu) — bản mới nhất trước. */
    List<StudentObjectiveAssessment> findByClassIdAndStudentIdAndObjectiveIdOrderByAssessedAtDesc(
            Long classId, Long studentId, Long objectiveId);
}
