package com.deutschflow.speaking.repository;

import com.deutschflow.speaking.entity.DialogueTemplate;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface DialogueTemplateRepository extends JpaRepository<DialogueTemplate, Long> {

    Optional<DialogueTemplate> findByTemplateName(String templateName);

    List<DialogueTemplate> findByDifficultyLevel(Integer difficultyLevel);

    List<DialogueTemplate> findAll();
}
