package com.deutschflow.teacher.repository;

import com.deutschflow.teacher.entity.ClassMilestone;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ClassMilestoneRepository extends JpaRepository<ClassMilestone, Long> {

    List<ClassMilestone> findByClassIdOrderByPlannedDateAsc(Long classId);

    Optional<ClassMilestone> findByIdAndClassId(Long id, Long classId);
}
