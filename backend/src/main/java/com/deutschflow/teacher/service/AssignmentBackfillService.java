package com.deutschflow.teacher.service;

import com.deutschflow.teacher.entity.ClassAssignment;
import com.deutschflow.teacher.entity.StudentAssignment;
import com.deutschflow.teacher.repository.ClassAssignmentRepository;
import com.deutschflow.teacher.repository.StudentAssignmentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Gives a newly-enrolled student a {@link StudentAssignment} row for every assignment the class already
 * handed out before they arrived.
 *
 * <p>A class assignment fans out into one StudentAssignment row per student <em>at creation time</em>
 * ({@code TeacherService.createAssignment}). A student who joins later therefore has no row for the older
 * assignments — yet the class counters (which iterate {@code ClassAssignment}) still count them as
 * "chờ nộp". The student was told they have pending work they literally could not open or submit. This
 * service closes that gap on every enrollment path (join approved, added directly, org roster import).
 *
 * <p>Idempotent: only the missing (student, assignment) pairs are inserted, so re-running is a no-op.
 * Paired with the read-side net in {@code StudentClassroomService.listAssignments} (which also synthesises
 * a PENDING entry for any still-missing row) and the one-time V260 backfill for pre-existing members.
 */
@Service
@RequiredArgsConstructor
public class AssignmentBackfillService {

    private final ClassAssignmentRepository assignmentRepository;
    private final StudentAssignmentRepository studentAssignmentRepository;

    /**
     * Ensure {@code studentId} has a PENDING StudentAssignment row for every assignment in {@code classId}.
     *
     * @return the number of rows created (0 when the student was already fully provisioned)
     */
    @Transactional
    public int ensureAssignmentsForStudent(Long classId, Long studentId) {
        List<Long> assignmentIds = assignmentRepository.findByClassIdOrderByCreatedAtDesc(classId)
                .stream().map(ClassAssignment::getId).toList();
        if (assignmentIds.isEmpty()) return 0;

        Set<Long> alreadyHas = studentAssignmentRepository
                .findByStudentIdAndAssignmentIdInAndDeletedFalseOrderByCreatedAtDesc(studentId, assignmentIds)
                .stream().map(StudentAssignment::getAssignmentId).collect(Collectors.toSet());

        List<StudentAssignment> missing = assignmentIds.stream()
                .filter(id -> !alreadyHas.contains(id))
                .map(id -> StudentAssignment.builder()
                        .assignmentId(id)
                        .studentId(studentId)
                        .status("PENDING")
                        .build())
                .toList();

        if (!missing.isEmpty()) {
            studentAssignmentRepository.saveAll(missing);
        }
        return missing.size();
    }
}
