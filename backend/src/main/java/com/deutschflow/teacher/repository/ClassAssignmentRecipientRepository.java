package com.deutschflow.teacher.repository;

import com.deutschflow.teacher.entity.ClassAssignmentRecipient;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;

@Repository
public interface ClassAssignmentRecipientRepository
        extends JpaRepository<ClassAssignmentRecipient, ClassAssignmentRecipient.Id> {

    List<ClassAssignmentRecipient> findByIdAssignmentIdIn(Collection<Long> assignmentIds);

    List<ClassAssignmentRecipient> findByIdAssignmentId(Long assignmentId);
}
