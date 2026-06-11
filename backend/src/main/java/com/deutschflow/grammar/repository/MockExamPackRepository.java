package com.deutschflow.grammar.repository;

import com.deutschflow.grammar.entity.MockExamPack;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface MockExamPackRepository extends JpaRepository<MockExamPack, Long> {
    List<MockExamPack> findByActiveTrueOrderBySortOrderAsc();

    /** Admin catalog view: ALL packs (active + inactive) in curation order. */
    List<MockExamPack> findAllByOrderBySortOrderAscIdAsc();
}
