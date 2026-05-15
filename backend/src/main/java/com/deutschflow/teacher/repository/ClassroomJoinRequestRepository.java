package com.deutschflow.teacher.repository;

import com.deutschflow.teacher.entity.ClassroomJoinRequest;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ClassroomJoinRequestRepository extends JpaRepository<ClassroomJoinRequest, Long> {
    List<ClassroomJoinRequest> findByClassroomIdAndStatusOrderByCreatedAtDesc(Long classroomId, String status);
    Optional<ClassroomJoinRequest> findByClassroomIdAndStudentId(Long classroomId, Long studentId);
}
