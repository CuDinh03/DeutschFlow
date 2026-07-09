package com.deutschflow.teacher.service;

import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.common.exception.ForbiddenException;
import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.teacher.dto.SetCompetencyRequest;
import com.deutschflow.teacher.dto.StudentCompetencyDto;
import com.deutschflow.teacher.entity.CanDoStatement;
import com.deutschflow.teacher.entity.ClassAssignment;
import com.deutschflow.teacher.entity.ClassLesson;
import com.deutschflow.teacher.entity.StudentCompetency;
import com.deutschflow.teacher.repository.CanDoStatementRepository;
import com.deutschflow.teacher.repository.ClassAssignmentRepository;
import com.deutschflow.teacher.repository.ClassLessonRepository;
import com.deutschflow.teacher.repository.ClassStudentRepository;
import com.deutschflow.teacher.repository.StudentCompetencyRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * The student-facing competency ledger (Phase 2a). A student self-assesses each Kann-Beschreibung
 * (can_do_statement) of a class they are enrolled in; the status is stored per (student, can-do).
 * All reads/writes are scoped to the caller's own enrollment (no cross-class / cross-student access).
 */
@Service
@RequiredArgsConstructor
public class StudentCompetencyService {

    private static final Set<String> STATUSES = Set.of("NOT_STARTED", "IN_PROGRESS", "MASTERED");
    private static final Map<String, Integer> STATUS_RANK =
            Map.of("NOT_STARTED", 0, "IN_PROGRESS", 1, "MASTERED", 2);
    private static final String SOURCE_SELF = "SELF";
    private static final String SOURCE_GRADING = "GRADING";
    /** Score (0-100) at/above which a graded assignment marks its can-dos MASTERED (product-tunable). */
    private static final int MASTERED_THRESHOLD = 80;

    private final StudentCompetencyRepository competencyRepository;
    private final CanDoStatementRepository canDoRepository;
    private final ClassLessonRepository lessonRepository;
    private final ClassStudentRepository classStudentRepository;
    private final ClassAssignmentRepository assignmentRepository;

    /** The student's competency rows for this class's can-dos (missing = NOT_STARTED on the client). */
    @Transactional(readOnly = true)
    public List<StudentCompetencyDto> getForClass(Long studentId, Long classId) {
        assertEnrolled(studentId, classId);
        List<Long> canDoIds = classCanDoIds(classId);
        if (canDoIds.isEmpty()) return List.of();
        return competencyRepository.findByStudentIdAndCanDoStatementIdIn(studentId, canDoIds).stream()
                .map(c -> new StudentCompetencyDto(c.getCanDoStatementId(), c.getStatus(), c.getSource()))
                .toList();
    }

    /** Upserts the student's self-assessment of one can-do (must belong to a lesson of this class). */
    @Transactional
    public StudentCompetencyDto setSelfAssessment(Long studentId, Long classId, Long canDoStatementId,
                                                  SetCompetencyRequest req) {
        assertEnrolled(studentId, classId);
        String status = normalizeStatus(req == null ? null : req.status());
        assertCanDoInClass(canDoStatementId, classId);

        StudentCompetency row = competencyRepository
                .findByStudentIdAndCanDoStatementId(studentId, canDoStatementId)
                .orElseGet(() -> StudentCompetency.builder()
                        .studentId(studentId)
                        .canDoStatementId(canDoStatementId)
                        .build());
        row.setStatus(status);
        row.setSource(SOURCE_SELF);
        StudentCompetency saved = competencyRepository.save(row);
        return new StudentCompetencyDto(saved.getCanDoStatementId(), saved.getStatus(), saved.getSource());
    }

    /**
     * Auto-update the ledger from a graded assignment (Phase 2b / B4, source=GRADING). System-
     * initiated — the grading actor is already authorized upstream, so this does NOT run an
     * enrollment check (it operates on the submission's own studentId). Runs in its OWN transaction
     * (REQUIRES_NEW) and callers wrap it in try/catch: a ledger failure must never fail or roll back
     * the grade. Maps assignment → its lesson's can-dos (routed by skill) → upgrade-only status.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void applyGradingResult(Long studentId, Long assignmentId, Integer score) {
        if (studentId == null || assignmentId == null || score == null) return; // manual grade may have null score
        ClassAssignment assignment = assignmentRepository.findById(assignmentId).orElse(null);
        if (assignment == null || assignment.getLessonId() == null) return; // unlinked assignment → nothing to update
        List<CanDoStatement> canDos = canDoRepository.findByLessonIdOrderByOrderIndexAsc(assignment.getLessonId());
        if (canDos.isEmpty()) return;

        String assignmentSkill = normalizeAssignmentSkill(assignment.getSkill()); // null = non-skill-specific (GENERAL/blank)
        // Route by skill so a grade only touches can-dos it actually assessed:
        //   - a skill-specific assignment hits can-dos of THAT skill, plus untagged (lesson-wide) can-dos;
        //   - a GENERAL/non-skill assignment hits ONLY untagged can-dos — it must NOT fan a single score
        //     out across all four skills' can-dos (that would over-report mastery for untested skills).
        List<CanDoStatement> matched = canDos.stream()
                .filter(cd -> assignmentSkill == null
                        ? cd.getSkillTag() == null
                        : (cd.getSkillTag() == null || assignmentSkill.equals(cd.getSkillTag())))
                .toList();
        if (matched.isEmpty()) return;

        String newStatus = score >= MASTERED_THRESHOLD ? "MASTERED" : "IN_PROGRESS";
        int newRank = STATUS_RANK.get(newStatus);

        // Batch-load the student's existing rows for the matched can-dos (N+1-safe: one query).
        // Read-then-insert is best-effort (matches the codebase's ledger convention): a rare concurrent
        // insert of the same (student, can-do) loses this event's write to the UNIQUE constraint, but it
        // self-heals on the student's next grade for that lesson — no grade or data-loss impact.
        Map<Long, StudentCompetency> existing = competencyRepository
                .findByStudentIdAndCanDoStatementIdIn(studentId, matched.stream().map(CanDoStatement::getId).toList())
                .stream().collect(Collectors.toMap(StudentCompetency::getCanDoStatementId, r -> r));

        for (CanDoStatement cd : matched) {
            StudentCompetency row = existing.get(cd.getId());
            if (row == null) {
                competencyRepository.save(StudentCompetency.builder()
                        .studentId(studentId)
                        .canDoStatementId(cd.getId())
                        .status(newStatus)
                        .source(SOURCE_GRADING)
                        .build());
            } else if (SOURCE_GRADING.equals(row.getSource())) {
                // A prior GRADING row: the latest grade is self-authoritative, so overwrite it even
                // DOWNWARD (a teacher's corrected re-grade must take effect). Write only on a change.
                if (!newStatus.equals(row.getStatus())) {
                    row.setStatus(newStatus);
                    competencyRepository.save(row);
                }
            } else if (STATUS_RANK.getOrDefault(row.getStatus(), 0) < newRank) {
                // A SELF (student self-assessment) row: upgrade-only — a grade may PROMOTE but never
                // downgrade the student's own self-report; source flips to GRADING on a real upgrade.
                row.setStatus(newStatus);
                row.setSource(SOURCE_GRADING);
                competencyRepository.save(row);
            }
        }
    }

    // ── helpers ─────────────────────────────────────────────────────────────

    private void assertEnrolled(Long studentId, Long classId) {
        if (!classStudentRepository.existsByIdClassIdAndIdStudentId(classId, studentId)) {
            throw new NotFoundException("Không tìm thấy lớp học");
        }
    }

    /** All can-do ids belonging to lessons of the class (batch, N+1-safe). */
    private List<Long> classCanDoIds(Long classId) {
        List<Long> lessonIds = lessonRepository.findByClassIdOrderByOrderIndexAsc(classId).stream()
                .map(ClassLesson::getId).toList();
        if (lessonIds.isEmpty()) return List.of();
        return canDoRepository.findByLessonIdInOrderByLessonIdAscOrderIndexAsc(lessonIds).stream()
                .map(CanDoStatement::getId).toList();
    }

    /** Rejects a can-do that does not belong to a lesson of this class (cross-class guard). */
    private void assertCanDoInClass(Long canDoStatementId, Long classId) {
        CanDoStatement canDo = canDoRepository.findById(canDoStatementId)
                .orElseThrow(() -> new NotFoundException("Mục tiêu năng lực không tồn tại"));
        ClassLesson lesson = lessonRepository.findById(canDo.getLessonId())
                .orElseThrow(() -> new NotFoundException("Bài học không tồn tại"));
        if (!lesson.getClassId().equals(classId)) {
            throw new ForbiddenException("Mục tiêu năng lực không thuộc lớp này");
        }
    }

    /**
     * class_assignments.skill uses "HOREN" (no E) while can_do_statement.skill_tag uses "HOEREN"
     * (with E) — normalize that one mismatch. GENERAL/blank/null → null = wildcard (matches every
     * can-do of the lesson). LESEN/SCHREIBEN/SPRECHEN are identical on both sides.
     */
    private static String normalizeAssignmentSkill(String raw) {
        if (raw == null) return null;
        String v = raw.trim().toUpperCase();
        if (v.isEmpty() || "GENERAL".equals(v)) return null;
        return "HOREN".equals(v) ? "HOEREN" : v;
    }

    private String normalizeStatus(String raw) {
        if (raw == null || raw.isBlank()) {
            throw new BadRequestException("Trạng thái năng lực không được để trống");
        }
        String v = raw.trim().toUpperCase();
        if (!STATUSES.contains(v)) {
            throw new BadRequestException("Trạng thái năng lực không hợp lệ: " + raw);
        }
        return v;
    }
}
