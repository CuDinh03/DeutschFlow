package com.deutschflow.assessment.repository;

import com.deutschflow.assessment.entity.B1AssessmentState;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface B1AssessmentStateRepository extends JpaRepository<B1AssessmentState, Long> {

    Optional<B1AssessmentState> findByUserId(Long userId);
}
