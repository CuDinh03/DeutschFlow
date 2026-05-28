package com.deutschflow.grammar.repository;

import com.deutschflow.grammar.entity.GrammarCaseExample;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface GrammarCaseExampleRepository extends JpaRepository<GrammarCaseExample, Long> {
    List<GrammarCaseExample> findByGrammarCaseId(Long caseId);
}
