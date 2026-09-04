package com.deutschflow.organization.repository;

import com.deutschflow.organization.entity.OrgCurriculumVersion;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;

@Repository
public interface OrgCurriculumVersionRepository extends JpaRepository<OrgCurriculumVersion, Long> {

    List<OrgCurriculumVersion> findByCurriculumIdOrderByVersionNoDesc(Long curriculumId);

    List<OrgCurriculumVersion> findByCurriculumIdInOrderByCurriculumIdAscVersionNoDesc(Collection<Long> curriculumIds);

    @Query("SELECT COALESCE(MAX(v.versionNo), 0) FROM OrgCurriculumVersion v WHERE v.curriculumId = :curriculumId")
    int findMaxVersionNo(@Param("curriculumId") Long curriculumId);
}
