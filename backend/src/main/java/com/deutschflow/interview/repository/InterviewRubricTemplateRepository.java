package com.deutschflow.interview.repository;

import com.deutschflow.interview.entity.InterviewRubricTemplate;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface InterviewRubricTemplateRepository extends JpaRepository<InterviewRubricTemplate, Long> {

    List<InterviewRubricTemplate> findByIndustryAndPhaseAndActiveTrue(String industry, String phase);

    Optional<InterviewRubricTemplate> findFirstByIndustryAndPhaseAndActiveTrue(String industry, String phase);

    List<InterviewRubricTemplate> findByRoleGroupAndPhaseAndActiveTrue(String roleGroup, String phase);
}
