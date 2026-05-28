package com.deutschflow.grammar.repository;

import com.deutschflow.grammar.entity.GrammarCase;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface GrammarCaseRepository extends JpaRepository<GrammarCase, Long> {
    Optional<GrammarCase> findByCaseName(String caseName);
}
