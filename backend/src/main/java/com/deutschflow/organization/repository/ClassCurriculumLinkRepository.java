package com.deutschflow.organization.repository;

import com.deutschflow.organization.entity.ClassCurriculumLink;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.Optional;

@Repository
public interface ClassCurriculumLinkRepository extends JpaRepository<ClassCurriculumLink, Long> {

    Optional<ClassCurriculumLink> findByClassId(Long classId);

    boolean existsByClassId(Long classId);

    long countByVersionId(Long versionId);

    boolean existsByVersionIdIn(Collection<Long> versionIds);
}
