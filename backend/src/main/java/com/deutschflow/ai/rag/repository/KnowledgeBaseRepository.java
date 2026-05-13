package com.deutschflow.ai.rag.repository;

import com.deutschflow.ai.rag.entity.KnowledgeBase;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface KnowledgeBaseRepository extends JpaRepository<KnowledgeBase, Long> {

    /**
     * Vector Cosine Distance search (`<=>`) for text-embedding-3-small (length 1536).
     * The `vectorString` should be formatted as "[0.1, 0.2, 0.3...]"
     */
    @Query(value = "SELECT * FROM knowledge_base WHERE cefr_level = :cefrLevel ORDER BY embedding <=> CAST(:vectorString AS vector) LIMIT :limit", nativeQuery = true)
    List<KnowledgeBase> findSimilarContext(String cefrLevel, String vectorString, int limit);
}
