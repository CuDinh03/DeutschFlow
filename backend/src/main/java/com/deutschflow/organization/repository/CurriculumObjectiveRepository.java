package com.deutschflow.organization.repository;

import com.deutschflow.organization.entity.CurriculumObjective;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;

@Repository
public interface CurriculumObjectiveRepository extends JpaRepository<CurriculumObjective, Long> {

    List<CurriculumObjective> findByLektionIdOrderByOrderIndexAsc(Long lektionId);

    List<CurriculumObjective> findByLektionIdInOrderByLektionIdAscOrderIndexAsc(Collection<Long> lektionIds);

    @Modifying
    @Query("DELETE FROM CurriculumObjective o WHERE o.lektionId = :lektionId")
    void deleteByLektionId(@Param("lektionId") Long lektionId);
}
