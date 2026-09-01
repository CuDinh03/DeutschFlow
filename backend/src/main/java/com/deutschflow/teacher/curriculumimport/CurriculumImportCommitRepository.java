package com.deutschflow.teacher.curriculumimport;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface CurriculumImportCommitRepository extends JpaRepository<CurriculumImportCommitRecord, Long> {

    Optional<CurriculumImportCommitRecord> findByClassIdAndIdempotencyKey(Long classId, String idempotencyKey);
}
