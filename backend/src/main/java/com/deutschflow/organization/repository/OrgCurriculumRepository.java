package com.deutschflow.organization.repository;

import com.deutschflow.organization.entity.OrgCurriculum;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface OrgCurriculumRepository extends JpaRepository<OrgCurriculum, Long> {

    List<OrgCurriculum> findByOrgIdOrderByCreatedAtDesc(Long orgId);

    Optional<OrgCurriculum> findByIdAndOrgId(Long id, Long orgId);
}
