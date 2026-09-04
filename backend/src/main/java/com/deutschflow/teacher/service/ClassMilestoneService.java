package com.deutschflow.teacher.service;

import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.common.exception.ConflictException;
import com.deutschflow.common.exception.ForbiddenException;
import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.organization.repository.ClassCurriculumLinkRepository;
import com.deutschflow.teacher.dto.ClassMilestoneDto;
import com.deutschflow.teacher.dto.ScheduleChangePayloads;
import com.deutschflow.teacher.dto.UpsertMilestoneRequest;
import com.deutschflow.teacher.entity.ClassMilestone;
import com.deutschflow.teacher.entity.ClassScheduleChangeRequest;
import com.deutschflow.teacher.entity.TeacherClass;
import com.deutschflow.teacher.repository.ClassMilestoneRepository;
import com.deutschflow.teacher.repository.ClassTeacherRepository;
import com.deutschflow.teacher.repository.TeacherClassRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * Mốc của lớp (V295, PR-6 — spec P05/AC09): giáo viên phụ trách tạo/sửa/xoá mốc thi chính thức và
 * ngày kết thúc khóa. Lớp trung tâm ĐÃ GẮN GIÁO TRÌNH: DỜI {@code plannedDate} không áp thẳng —
 * tạo đề xuất MOVE_MILESTONE (V294) chờ duyệt (mốc rơi T7/CN chỉ OWNER duyệt, D14); sửa
 * title/note và tạo/xoá là thao tác trực tiếp (P05 chỉ yêu cầu duyệt khi dời mốc chính thức).
 */
@Service
@RequiredArgsConstructor
public class ClassMilestoneService {

    private final ClassMilestoneRepository milestoneRepo;
    private final ClassTeacherRepository classTeacherRepo;
    private final TeacherClassRepository classRepo;
    private final ClassCurriculumLinkRepository classCurriculumLinkRepository;
    private final ScheduleChangeQueue changeQueue;

    @Transactional(readOnly = true)
    public List<ClassMilestoneDto> list(Long teacherId, Long classId) {
        assertClassTeacher(teacherId, classId);
        return milestoneRepo.findByClassIdOrderByPlannedDateAsc(classId).stream()
                .map(m -> toDto(m, null))
                .toList();
    }

    @Transactional
    public ClassMilestoneDto create(Long teacherId, Long classId, UpsertMilestoneRequest req) {
        assertPrimaryTeacher(teacherId, classId);
        ClassMilestone.Kind kind = parseKind(req.kind());
        if (req.title() == null || req.title().isBlank()) throw new BadRequestException("Thiếu tên mốc");
        if (req.plannedDate() == null) throw new BadRequestException("Thiếu ngày dự kiến của mốc");
        try {
            ClassMilestone saved = milestoneRepo.save(ClassMilestone.builder()
                    .classId(classId)
                    .kind(kind)
                    .title(req.title().trim())
                    .plannedDate(req.plannedDate())
                    .note(req.note())
                    .createdBy(teacherId)
                    .build());
            return toDto(saved, null);
        } catch (DataIntegrityViolationException e) {
            // uq_cm_course_end: một lớp chỉ một mốc kết thúc khóa.
            throw new ConflictException("Lớp đã có mốc kết thúc khóa — sửa mốc hiện có thay vì tạo mới");
        }
    }

    /**
     * PATCH: title/note áp thẳng. Đổi {@code plannedDate}: lớp đã gắn giáo trình → đề xuất
     * MOVE_MILESTONE (ngày CHƯA đổi, trả {@code pendingRequestId}); lớp thường → đổi thẳng.
     */
    @Transactional
    public ClassMilestoneDto update(Long teacherId, Long classId, Long milestoneId, UpsertMilestoneRequest req) {
        assertPrimaryTeacher(teacherId, classId);
        ClassMilestone m = milestoneRepo.findByIdAndClassId(milestoneId, classId)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy mốc của lớp"));

        if (req.title() != null && !req.title().isBlank()) m.setTitle(req.title().trim());
        if (req.note() != null) m.setNote(req.note());

        Long pendingId = null;
        if (req.plannedDate() != null && !req.plannedDate().equals(m.getPlannedDate())) {
            if (requiresApproval(classId)) {
                pendingId = changeQueue.queue(teacherId, classId,
                        ClassScheduleChangeRequest.Type.MOVE_MILESTONE,
                        new ScheduleChangePayloads.MilestoneMove(m.getId(), req.plannedDate()),
                        ScheduleChangeQueue.ImpactSeed.of(List.of(), List.of(
                                "Mốc \"" + m.getTitle() + "\" dời " + m.getPlannedDate() + " → " + req.plannedDate())),
                        req.plannedDate().atStartOfDay(), false, null);
            } else {
                m.setPlannedDate(req.plannedDate());
            }
        }
        return toDto(milestoneRepo.save(m), pendingId);
    }

    /** Xoá trực tiếp (P05 — duyệt chỉ áp cho DỜI); FE bắt buộc ConfirmDialog nêu hệ quả (§2.11). */
    @Transactional
    public void delete(Long teacherId, Long classId, Long milestoneId) {
        assertPrimaryTeacher(teacherId, classId);
        ClassMilestone m = milestoneRepo.findByIdAndClassId(milestoneId, classId)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy mốc của lớp"));
        milestoneRepo.delete(m);
    }

    private ClassMilestoneDto toDto(ClassMilestone m, Long pendingRequestId) {
        return new ClassMilestoneDto(m.getId(), m.getClassId(), m.getKind().name(), m.getTitle(),
                m.getPlannedDate(), m.getNote(), pendingRequestId);
    }

    private static ClassMilestone.Kind parseKind(String raw) {
        try {
            return ClassMilestone.Kind.valueOf(raw == null ? "" : raw.toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new BadRequestException("Loại mốc không hợp lệ (EXAM | COURSE_END)");
        }
    }

    private void assertClassTeacher(Long teacherId, Long classId) {
        if (!classTeacherRepo.existsByIdClassIdAndIdTeacherId(classId, teacherId)) {
            throw new ForbiddenException("Bạn không dạy lớp này");
        }
    }

    private void assertPrimaryTeacher(Long teacherId, Long classId) {
        if (!classTeacherRepo.existsByIdClassIdAndIdTeacherIdAndRole(classId, teacherId, "PRIMARY")) {
            throw new ForbiddenException("Chỉ giáo viên phụ trách lớp mới được thao tác mốc");
        }
    }

    /** Cùng gate với ClassScheduleService (PR-5): lớp thuộc org VÀ đã gắn giáo trình. */
    private boolean requiresApproval(Long classId) {
        return classRepo.findById(classId).map(TeacherClass::getOrgId).orElse(null) != null
                && classCurriculumLinkRepository.existsByClassId(classId);
    }
}
