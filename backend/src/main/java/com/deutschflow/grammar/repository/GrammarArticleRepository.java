package com.deutschflow.grammar.repository;

import com.deutschflow.grammar.entity.GrammarArticle;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface GrammarArticleRepository extends JpaRepository<GrammarArticle, Long> {
    Optional<GrammarArticle> findByGenderAndKasus(String gender, String kasus);
}
