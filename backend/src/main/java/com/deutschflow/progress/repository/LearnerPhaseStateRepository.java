package com.deutschflow.progress.repository;

import com.deutschflow.progress.entity.LearnerPhaseState;
import com.deutschflow.progress.entity.PhaseType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface LearnerPhaseStateRepository extends JpaRepository<LearnerPhaseState, Long> {

    Optional<LearnerPhaseState> findByUserId(Long userId);

    long countByCurrentPhase(PhaseType phase);
}
