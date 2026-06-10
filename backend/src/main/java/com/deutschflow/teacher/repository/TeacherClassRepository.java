package com.deutschflow.teacher.repository;

import com.deutschflow.teacher.entity.TeacherClass;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface TeacherClassRepository extends JpaRepository<TeacherClass, Long> {
    List<TeacherClass> findByTeacherId(Long teacherId);
    Optional<TeacherClass> findByInviteCode(String inviteCode);

    /** Org-scoped read for the B2B org admin (GET /api/org/classes). */
    Page<TeacherClass> findByOrgId(Long orgId, Pageable pageable);
}
