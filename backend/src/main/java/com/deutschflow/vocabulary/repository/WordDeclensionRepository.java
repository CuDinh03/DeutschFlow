package com.deutschflow.vocabulary.repository;

import com.deutschflow.vocabulary.entity.WordDeclension;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface WordDeclensionRepository extends JpaRepository<WordDeclension, Long> {

    Optional<WordDeclension> findByWordId(Long wordId);

    boolean existsByWordId(Long wordId);
}
