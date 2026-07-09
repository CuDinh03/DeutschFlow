package com.deutschflow.teacher.repository;

import com.deutschflow.teacher.entity.StudentCompetency;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface StudentCompetencyRepository extends JpaRepository<StudentCompetency, Long> {

    Optional<StudentCompetency> findByStudentIdAndCanDoStatementId(Long studentId, Long canDoStatementId);

    List<StudentCompetency> findByStudentIdAndCanDoStatementIdIn(Long studentId, List<Long> canDoStatementIds);
}
