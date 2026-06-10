package com.deutschflow.grammar.repository;

import com.deutschflow.grammar.entity.GrammarCaseExercise;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface GrammarCaseExerciseRepository extends JpaRepository<GrammarCaseExercise, Long> {
    List<GrammarCaseExercise> findByGrammarCaseIdAndDifficultyLevel(Long caseId, Integer difficultyLevel);
    List<GrammarCaseExercise> findByGrammarCaseId(Long caseId);
    List<GrammarCaseExercise> findByExerciseType(String exerciseType);

    /** Batch load for getAllCases() — avoids N+1 (one query for all cases). */
    List<GrammarCaseExercise> findByGrammarCaseIdIn(List<Long> caseIds);
}
