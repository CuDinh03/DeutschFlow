package com.deutschflow.interview.repository;

import com.deutschflow.interview.entity.InterviewPersonaEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface InterviewPersonaRepository extends JpaRepository<InterviewPersonaEntity, Long> {

    Optional<InterviewPersonaEntity> findByCodeAndActiveTrue(String code);

    List<InterviewPersonaEntity> findAllByActiveTrue();
}
