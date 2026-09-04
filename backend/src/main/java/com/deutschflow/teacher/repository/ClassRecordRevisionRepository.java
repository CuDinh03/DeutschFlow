package com.deutschflow.teacher.repository;

import com.deutschflow.teacher.entity.ClassRecordRevision;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ClassRecordRevisionRepository extends JpaRepository<ClassRecordRevision, Long> {

    List<ClassRecordRevision> findByClassIdOrderByChangedAtDesc(Long classId);

    List<ClassRecordRevision> findByEntityTypeAndEntityIdOrderByChangedAtDesc(
            ClassRecordRevision.EntityType entityType, Long entityId);
}
