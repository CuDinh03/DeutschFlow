package com.deutschflow.interview.repository;

import com.deutschflow.interview.entity.InterviewQuestion;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface InterviewQuestionRepository extends JpaRepository<InterviewQuestion, String> {

    List<InterviewQuestion> findByPersonaCodeAndPhaseAndActiveTrue(String personaCode, String phase);

    List<InterviewQuestion> findByPersonaCodeAndActiveTrue(String personaCode);
}
