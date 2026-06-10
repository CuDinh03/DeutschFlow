package com.deutschflow.teacher.repository;

import com.deutschflow.teacher.entity.TeacherProfile;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface TeacherProfileRepository extends JpaRepository<TeacherProfile, Long> {

    @Query("SELECT tp FROM TeacherProfile tp JOIN FETCH tp.user u WHERE tp.id = :id")
    Optional<TeacherProfile> findByIdWithUser(Long id);

    @Query(value = "SELECT tp FROM TeacherProfile tp JOIN FETCH tp.user u",
           countQuery = "SELECT count(tp) FROM TeacherProfile tp")
    Page<TeacherProfile> findAllWithUser(Pageable pageable);

    /**
     * Public marketplace directory — excludes teachers who belong to an organization
     * ({@code u.orgId IS NULL}). Org teachers are provisioned by their centre and do not
     * sell 1-1 sessions on the open marketplace.
     */
    @Query(value = "SELECT tp FROM TeacherProfile tp JOIN FETCH tp.user u WHERE u.orgId IS NULL",
           countQuery = "SELECT count(tp) FROM TeacherProfile tp JOIN tp.user u WHERE u.orgId IS NULL")
    Page<TeacherProfile> findPublicWithUser(Pageable pageable);

    @Query("SELECT tp FROM TeacherProfile tp JOIN FETCH tp.user u WHERE u.id = :userId")
    Optional<TeacherProfile> findByUserId(Long userId);
}
