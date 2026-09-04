package com.deutschflow.teacher.service;

import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.common.exception.ForbiddenException;
import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.organization.entity.CurriculumLektion;
import com.deutschflow.organization.entity.CurriculumObjective;
import com.deutschflow.organization.repository.ClassCurriculumLinkRepository;
import com.deutschflow.organization.repository.CurriculumLektionRepository;
import com.deutschflow.organization.repository.CurriculumObjectiveRepository;
import com.deutschflow.organization.service.OrgSettingsService;
import com.deutschflow.teacher.dto.ObjectiveAssessRequest;
import com.deutschflow.teacher.dto.ObjectiveMatrixDto;
import com.deutschflow.teacher.entity.StudentObjectiveAssessment;
import com.deutschflow.teacher.entity.TeacherClass;
import com.deutschflow.teacher.repository.ClassStudentRepository;
import com.deutschflow.teacher.repository.ClassTeacherRepository;
import com.deutschflow.teacher.repository.StudentAssignmentRepository;
import com.deutschflow.teacher.repository.StudentObjectiveAssessmentRepository;
import com.deutschflow.teacher.repository.TeacherClassRepository;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Đánh giá học viên theo MỤC TIÊU giáo trình (V298, spec §7 — PR-9).
 *
 * <p>AC12: bài đã nộp CHƯA chấm hiển thị "chờ chấm" — một con số riêng, không bao giờ đổ vào
 * NEEDS_PRACTICE. Gợi ý hỗ trợ chỉ tính trên người ĐÃ được đánh giá và luôn kèm số chưa đánh giá
 * — là GỢI Ý hiển thị, hệ thống không tự dời giáo trình. AC15: đánh giá lớp không chạm roadmap
 * tự học (D11) — không ghi bảng nào ngoài {@code student_objective_assessments}.
 */
@Service
@RequiredArgsConstructor
public class ObjectiveAssessmentService {

    private final StudentObjectiveAssessmentRepository assessmentRepo;
    private final ClassCurriculumLinkRepository linkRepo;
    private final CurriculumLektionRepository lektionRepo;
    private final CurriculumObjectiveRepository objectiveRepo;
    private final ClassTeacherRepository classTeacherRepo;
    private final ClassStudentRepository classStudentRepo;
    private final TeacherClassRepository classRepo;
    private final StudentAssignmentRepository studentAssignmentRepo;
    private final UserRepository userRepository;
    private final OrgSettingsService orgSettingsService;

    /** Ma trận mục tiêu × học viên + cột "chờ chấm" (AC12) + gợi ý hỗ trợ theo ngưỡng org. */
    @Transactional(readOnly = true)
    public ObjectiveMatrixDto matrix(Long teacherId, Long classId) {
        assertClassTeacher(teacherId, classId);
        List<CurriculumObjective> objectives = objectivesOfClass(classId);

        List<Long> studentIds = classStudentRepo.findByIdClassId(classId).stream()
                .map(cs -> cs.getId().getStudentId())
                .toList();
        Map<Long, User> users = studentIds.isEmpty() ? Map.of()
                : userRepository.findAllById(studentIds).stream()
                        .collect(Collectors.toMap(User::getId, u -> u));

        Map<String, StudentObjectiveAssessment> current =
                assessmentRepo.findByClassIdAndSupersededFalse(classId).stream()
                        .collect(Collectors.toMap(
                                a -> a.getStudentId() + ":" + a.getObjectiveId(), a -> a, (x, y) -> x));

        // AC12: bài đã nộp chờ giáo viên chấm — đếm riêng, hiển thị trung tính.
        Map<Long, Long> pendingGrading = studentAssignmentRepo.countPendingGradingByStudent(classId).stream()
                .collect(Collectors.toMap(r -> (Long) r[0], r -> (Long) r[1]));

        List<ObjectiveMatrixDto.StudentRow> rows = studentIds.stream()
                .map(sid -> new ObjectiveMatrixDto.StudentRow(
                        sid,
                        users.containsKey(sid) ? users.get(sid).getDisplayName() : "Học viên #" + sid,
                        pendingGrading.getOrDefault(sid, 0L).intValue(),
                        objectives.stream().map(o -> {
                            StudentObjectiveAssessment a = current.get(sid + ":" + o.getId());
                            return new ObjectiveMatrixDto.Cell(
                                    o.getId(),
                                    a == null ? "NOT_ASSESSED" : a.getStatus().name(),
                                    a == null ? null : a.getEvidence());
                        }).toList()))
                .toList();

        return new ObjectiveMatrixDto(
                classId,
                objectives.stream().map(o -> new ObjectiveMatrixDto.ObjectiveCol(
                        o.getId(), o.getLektionId(), o.getText(), o.getSkillTag(), o.getCefrLevel())).toList(),
                rows,
                suggestions(classId, objectives, rows));
    }

    /** Đánh giá (hoặc đánh giá lại — supersede bản cũ, lịch sử giữ nguyên). PRIMARY teacher. */
    @Transactional
    public ObjectiveMatrixDto assess(Long teacherId, Long classId, ObjectiveAssessRequest req) {
        assertPrimaryTeacher(teacherId, classId);
        StudentObjectiveAssessment.Status status = parseStatus(req.status());
        if (req.studentId() == null || req.objectiveId() == null) {
            throw new BadRequestException("Thiếu học viên hoặc mục tiêu");
        }
        boolean enrolled = classStudentRepo.findByIdClassId(classId).stream()
                .anyMatch(cs -> cs.getId().getStudentId().equals(req.studentId()));
        if (!enrolled) throw new BadRequestException("Học viên không thuộc lớp này");
        Set<Long> validObjectiveIds = objectivesOfClass(classId).stream()
                .map(CurriculumObjective::getId).collect(Collectors.toSet());
        if (!validObjectiveIds.contains(req.objectiveId())) {
            throw new BadRequestException("Mục tiêu không thuộc giáo trình đã gán cho lớp");
        }

        StudentObjectiveAssessment previous = assessmentRepo
                .findByClassIdAndStudentIdAndObjectiveIdAndSupersededFalse(classId, req.studentId(), req.objectiveId())
                .orElse(null);
        if (previous != null) {
            previous.setSuperseded(true);
            // Ép UPDATE superseded xuống DB TRƯỚC INSERT bản mới — Hibernate có thể xếp INSERT
            // trước và vỡ partial unique uq_soa_current (cùng bài học flush như điểm danh V266).
            assignmentSupersedeFlush(previous);
        }
        assessmentRepo.save(StudentObjectiveAssessment.builder()
                .classId(classId)
                .studentId(req.studentId())
                .objectiveId(req.objectiveId())
                .status(status)
                .evidence(req.evidence())
                .assessedBy(teacherId)
                .supersedesId(previous == null ? null : previous.getId())
                .build());
        return matrix(teacherId, classId);
    }

    // ── Gợi ý hỗ trợ (spec §7) ──────────────────────────────────────────────

    /**
     * Mỗi mục tiêu: đếm NEEDS_PRACTICE trên người ĐÃ đánh giá → ≤ support_individual_max = kèm
     * riêng (kèm tên); ≥ review_group_min = cân nhắc ôn chung. Luôn kèm số CHƯA đánh giá — thiếu
     * dữ liệu phải nhìn thấy được, không được ngầm coi là ổn.
     */
    private List<ObjectiveMatrixDto.Suggestion> suggestions(Long classId, List<CurriculumObjective> objectives,
                                                            List<ObjectiveMatrixDto.StudentRow> rows) {
        Long orgId = classRepo.findById(classId).map(TeacherClass::getOrgId).orElse(null);
        int individualMax = orgSettingsService.getInt(orgId, OrgSettingsService.SUPPORT_INDIVIDUAL_MAX);
        int groupMin = orgSettingsService.getInt(orgId, OrgSettingsService.REVIEW_GROUP_MIN);

        List<ObjectiveMatrixDto.Suggestion> out = new ArrayList<>();
        for (int i = 0; i < objectives.size(); i++) {
            final int col = i;
            List<ObjectiveMatrixDto.StudentRow> needs = rows.stream()
                    .filter(r -> "NEEDS_PRACTICE".equals(r.cells().get(col).status()))
                    .toList();
            long unassessed = rows.stream()
                    .filter(r -> "NOT_ASSESSED".equals(r.cells().get(col).status()))
                    .count();
            if (needs.isEmpty()) continue;
            String kind = needs.size() >= groupMin ? "GROUP_REVIEW"
                    : needs.size() <= individualMax ? "INDIVIDUAL_SUPPORT" : "MIXED";
            out.add(new ObjectiveMatrixDto.Suggestion(
                    objectives.get(col).getId(),
                    kind,
                    needs.stream().map(ObjectiveMatrixDto.StudentRow::studentId).toList(),
                    needs.stream().map(ObjectiveMatrixDto.StudentRow::displayName).toList(),
                    (int) unassessed));
        }
        return out;
    }

    /** Mục tiêu của mọi Lektion trong phiên bản giáo trình ĐÃ GÁN cho lớp, theo thứ tự Lektion. */
    private List<CurriculumObjective> objectivesOfClass(Long classId) {
        Long versionId = linkRepo.findByClassId(classId)
                .map(l -> l.getVersionId())
                .orElseThrow(() -> new NotFoundException("Lớp chưa gắn giáo trình — chưa có mục tiêu để đánh giá"));
        List<Long> lektionIds = lektionRepo.findByVersionIdOrderByOrderIndexAsc(versionId).stream()
                .map(CurriculumLektion::getId)
                .toList();
        if (lektionIds.isEmpty()) return List.of();
        return objectiveRepo.findByLektionIdInOrderByLektionIdAscOrderIndexAsc(lektionIds);
    }

    private void assignmentSupersedeFlush(StudentObjectiveAssessment previous) {
        assessmentRepo.saveAndFlush(previous);
    }

    private static StudentObjectiveAssessment.Status parseStatus(String raw) {
        try {
            return StudentObjectiveAssessment.Status.valueOf(raw == null ? "" : raw.toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new BadRequestException("Trạng thái không hợp lệ (NOT_ASSESSED | NEEDS_PRACTICE | ACHIEVED)");
        }
    }

    private void assertClassTeacher(Long teacherId, Long classId) {
        if (!classTeacherRepo.existsByIdClassIdAndIdTeacherId(classId, teacherId)) {
            throw new ForbiddenException("Bạn không dạy lớp này");
        }
    }

    private void assertPrimaryTeacher(Long teacherId, Long classId) {
        if (!classTeacherRepo.existsByIdClassIdAndIdTeacherIdAndRole(classId, teacherId, "PRIMARY")) {
            throw new ForbiddenException("Chỉ giáo viên phụ trách lớp mới đánh giá mục tiêu");
        }
    }
}
