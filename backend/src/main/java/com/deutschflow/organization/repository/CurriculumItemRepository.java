package com.deutschflow.organization.repository;

import com.deutschflow.organization.entity.CurriculumItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;

@Repository
public interface CurriculumItemRepository extends JpaRepository<CurriculumItem, Long> {

    List<CurriculumItem> findByLektionIdOrderByOrderIndexAsc(Long lektionId);

    List<CurriculumItem> findByLektionIdInOrderByLektionIdAscOrderIndexAsc(Collection<Long> lektionIds);

    long countByLektionId(Long lektionId);

    @Modifying
    @Query("DELETE FROM CurriculumItem i WHERE i.lektionId = :lektionId")
    void deleteByLektionId(@Param("lektionId") Long lektionId);
}
