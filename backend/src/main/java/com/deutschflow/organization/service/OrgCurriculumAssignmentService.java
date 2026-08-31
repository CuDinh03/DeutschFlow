package com.deutschflow.organization.service;

import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.common.exception.ConflictException;
import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.organization.dto.AssignCurriculumRequest;
import com.deutschflow.organization.dto.ClassCurriculumLinkDto;
import com.deutschflow.organization.dto.CurriculumAssignmentImpactDto;
import com.deutschflow.organization.entity.ClassCurriculumLink;
import com.deutschflow.organization.entity.CurriculumItem;
import com.deutschflow.organization.entity.CurriculumLektion;
import com.deutschflow.organization.entity.CurriculumObjective;
import com.deutschflow.organization.entity.OrgCurriculum;
import com.deutschflow.organization.entity.OrgCurriculumVersion;
import com.deutschflow.organization.repository.ClassCurriculumLinkRepository;
import com.deutschflow.organization.repository.CurriculumItemRepository;
import com.deutschflow.organization.repository.CurriculumLektionRepository;
import com.deutschflow.organization.repository.CurriculumObjectiveRepository;
import com.deutschflow.organization.repository.OrgCurriculumRepository;
import com.deutschflow.organization.repository.OrgCurriculumVersionRepository;
import com.deutschflow.teacher.entity.CanDoStatement;
import com.deutschflow.teacher.entity.ClassLesson;
import com.deutschflow.teacher.entity.LessonKnowledgePoint;
import com.deutschflow.teacher.entity.TeacherClass;
import com.deutschflow.teacher.repository.CanDoStatementRepository;
import com.deutschflow.teacher.repository.ClassAssignmentRepository;
import com.deutschflow.teacher.repository.ClassLessonLogRepository;
import com.deutschflow.teacher.repository.ClassLessonRepository;
import com.deutschflow.teacher.repository.LessonKnowledgePointRepository;
import com.deutschflow.teacher.repository.StudentCompetencyRepository;
import com.deutschflow.teacher.repository.TeacherClassRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

/**
 * Gán lớp trung tâm ↔ phiên bản giáo trình (PR-1). Gán một phiên bản PUBLISHED sinh các
 * {@code class_lessons} mang {@code lektion_id} kèm knowledge point + can-do 1-1 từ nội dung
 * chuẩn — mọi luồng hiện có (nhật ký, chấm bài → competency, mobile) chạy tiếp không đổi hợp đồng.
 *
 * <p>Đổi/gỡ phiên bản là thao tác phá-cấu-trúc: PR-1 chỉ cho phép khi các bài sinh ra CHƯA có
 * dấu vết giảng dạy/học tập (xem {@link #impact}); có dấu vết → 409 kèm số liệu để org cân nhắc.
 */
@Service
@RequiredArgsConstructor
public class OrgCurriculumAssignmentService {

    private final TeacherClassRepository teacherClassRepo;
    private final ClassCurriculumLinkRepository linkRepo;
    private final OrgCurriculumRepository curriculumRepo;
    private final OrgCurriculumVersionRepository versionRepo;
    private final CurriculumLektionRepository lektionRepo;
    private final CurriculumItemRepository itemRepo;
    private final CurriculumObjectiveRepository objectiveRepo;
    private final ClassLessonRepository lessonRepo;
    private final LessonKnowledgePointRepository knowledgePointRepo;
    private final CanDoStatementRepository canDoRepo;
    private final ClassLessonLogRepository lessonLogRepo;
    private final ClassAssignmentRepository assignmentRepo;
    private final StudentCompetencyRepository competencyRepo;

    @Transactional(readOnly = true)
    public ClassCurriculumLinkDto getLink(Long orgId, Long classId) {
        loadClassInOrg(orgId, classId);
        return linkRepo.findByClassId(classId).map(l -> toDto(orgId, l)).orElse(null);
    }

    /** Tác động nếu gán/đổi sang targetVersionId (null = gỡ giáo trình) — dữ liệu cho ConfirmDialog. */
    @Transactional(readOnly = true)
    public CurriculumAssignmentImpactDto impact(Long orgId, Long classId, Long targetVersionId) {
        loadClassInOrg(orgId, classId);
        if (targetVersionId != null) {
            loadPublishableVersion(orgId, targetVersionId);
        }
        Long currentVersionId = linkRepo.findByClassId(classId)
                .map(ClassCurriculumLink::getVersionId).orElse(null);
        Traces t = traces(classId);
        return new CurriculumAssignmentImpactDto(currentVersionId, targetVersionId,
                t.generatedLessonCount(), t.logCount(), t.assignmentCount(),
                t.completedLessonCount(), t.competencyRecordCount(), t.clean());
    }

    /** Gán (lần đầu) hoặc đổi phiên bản giáo trình cho lớp. Chỉ nhận phiên bản PUBLISHED. */
    @Transactional
    public ClassCurriculumLinkDto assign(Long userId, Long orgId, Long classId, AssignCurriculumRequest req) {
        if (req == null || req.versionId() == null) {
            throw new BadRequestException("Thiếu versionId");
        }
        loadClassInOrg(orgId, classId);
        OrgCurriculumVersion version = loadPublishableVersion(orgId, req.versionId());
        OrgCurriculum curriculum = curriculumRepo.findByIdAndOrgId(version.getCurriculumId(), orgId)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy bộ giáo trình"));

        ClassCurriculumLink existing = linkRepo.findByClassId(classId).orElse(null);
        if (existing != null) {
            if (Objects.equals(existing.getVersionId(), version.getId())) {
                return toDto(orgId, existing); // idempotent: lớp đã dùng đúng phiên bản này
            }
            assertNoTraces(classId, "đổi phiên bản giáo trình");
            removeGeneratedLessons(classId);
            existing.setPreviousVersionId(existing.getVersionId());
            existing.setVersionId(version.getId());
            existing.setAssignedBy(userId);
            linkRepo.save(existing);
            generateLessons(classId, curriculum, version.getId());
            return toDto(orgId, existing);
        }

        ClassCurriculumLink link = linkRepo.save(ClassCurriculumLink.builder()
                .classId(classId)
                .versionId(version.getId())
                .assignedBy(userId)
                .build());
        generateLessons(classId, curriculum, version.getId());
        return toDto(orgId, link);
    }

    /** Gỡ giáo trình khỏi lớp — xoá các bài sinh ra (chỉ khi chưa có dấu vết) + xoá link. */
    @Transactional
    public void unassign(Long orgId, Long classId) {
        loadClassInOrg(orgId, classId);
        ClassCurriculumLink link = linkRepo.findByClassId(classId)
                .orElseThrow(() -> new NotFoundException("Lớp chưa gắn giáo trình"));
        assertNoTraces(classId, "gỡ giáo trình khỏi lớp");
        removeGeneratedLessons(classId);
        linkRepo.delete(link);
    }

    // ── Sinh bài từ Lektion ──────────────────────────────────────────────────

    private void generateLessons(Long classId, OrgCurriculum curriculum, Long versionId) {
        List<CurriculumLektion> lektionen = lektionRepo.findByVersionIdOrderByOrderIndexAsc(versionId);
        if (lektionen.isEmpty()) return; // publish đã chặn giáo trình rỗng — phòng hờ
        List<Long> lektionIds = lektionen.stream().map(CurriculumLektion::getId).toList();
        Map<Long, List<CurriculumItem>> itemsByLektion =
                itemRepo.findByLektionIdInOrderByLektionIdAscOrderIndexAsc(lektionIds).stream()
                        .collect(Collectors.groupingBy(CurriculumItem::getLektionId));
        Map<Long, List<CurriculumObjective>> objectivesByLektion =
                objectiveRepo.findByLektionIdInOrderByLektionIdAscOrderIndexAsc(lektionIds).stream()
                        .collect(Collectors.groupingBy(CurriculumObjective::getLektionId));

        int order = lessonRepo.findMaxOrderIndex(classId) + 1;
        for (CurriculumLektion lektion : lektionen) {
            List<CurriculumItem> items = itemsByLektion.getOrDefault(lektion.getId(), List.of());
            // description = mirror các mục nội dung (dual-write như ClassLessonService) cho legacy/mobile
            String description = items.stream().map(CurriculumItem::getText)
                    .collect(Collectors.joining("\n"));
            ClassLesson lesson = lessonRepo.save(ClassLesson.builder()
                    .classId(classId)
                    .orderIndex(order++)
                    .title(lektion.getTitle())
                    .description(description.isEmpty() ? lektion.getDescription() : description)
                    .cefrLevel(curriculum.getCefrLevel())
                    .lektionId(lektion.getId())
                    .supplementary(false)
                    .completed(false)
                    .build());

            List<LessonKnowledgePoint> points = new ArrayList<>();
            int pIdx = 0;
            for (CurriculumItem item : items) {
                points.add(LessonKnowledgePoint.builder()
                        .lessonId(lesson.getId())
                        .orderIndex(pIdx++)
                        .text(item.getText())
                        .skillTag(item.getSkillTag())
                        .contentTag(item.getContentTag())
                        .build());
            }
            if (!points.isEmpty()) knowledgePointRepo.saveAll(points);

            List<CanDoStatement> canDos = new ArrayList<>();
            int cIdx = 0;
            for (CurriculumObjective objective : objectivesByLektion.getOrDefault(lektion.getId(), List.of())) {
                canDos.add(CanDoStatement.builder()
                        .lessonId(lesson.getId())
                        .orderIndex(cIdx++)
                        .text(objective.getText())
                        .cefrLevel(objective.getCefrLevel())
                        .skillTag(objective.getSkillTag())
                        .build());
            }
            if (!canDos.isEmpty()) canDoRepo.saveAll(canDos);
        }
    }

    private void removeGeneratedLessons(Long classId) {
        List<ClassLesson> generated = lessonRepo.findByClassIdAndLektionIdIsNotNullOrderByOrderIndexAsc(classId);
        if (!generated.isEmpty()) {
            lessonRepo.deleteAll(generated); // FK CASCADE ở DB dọn knowledge point + can-do
        }
    }

    // ── Dấu vết giảng dạy/học tập ────────────────────────────────────────────

    private record Traces(long generatedLessonCount, long logCount, long assignmentCount,
                          long completedLessonCount, long competencyRecordCount) {
        boolean clean() {
            return logCount == 0 && assignmentCount == 0 && completedLessonCount == 0
                    && competencyRecordCount == 0;
        }
    }

    private Traces traces(Long classId) {
        List<ClassLesson> generated = lessonRepo.findByClassIdAndLektionIdIsNotNullOrderByOrderIndexAsc(classId);
        if (generated.isEmpty()) {
            return new Traces(0, 0, 0, 0, 0);
        }
        List<Long> lessonIds = generated.stream().map(ClassLesson::getId).toList();
        long completed = generated.stream().filter(ClassLesson::isCompleted).count();
        List<Long> canDoIds = canDoRepo.findByLessonIdInOrderByLessonIdAscOrderIndexAsc(lessonIds).stream()
                .map(CanDoStatement::getId)
                .toList();
        long competency = canDoIds.isEmpty() ? 0 : competencyRepo.countByCanDoStatementIdIn(canDoIds);
        return new Traces(generated.size(),
                lessonLogRepo.countByLessonIdIn(lessonIds),
                assignmentRepo.countByLessonIdIn(lessonIds),
                completed, competency);
    }

    private void assertNoTraces(Long classId, String action) {
        Traces t = traces(classId);
        if (!t.clean()) {
            throw new ConflictException(String.format(
                    "Không thể %s: bài sinh từ giáo trình đã có dấu vết (%d nhật ký, %d bài tập, %d bài hoàn thành, %d bản ghi năng lực). Giữ nguyên để không mất lịch sử.",
                    action, t.logCount(), t.assignmentCount(), t.completedLessonCount(), t.competencyRecordCount()));
        }
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private TeacherClass loadClassInOrg(Long orgId, Long classId) {
        TeacherClass klass = teacherClassRepo.findById(classId)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy lớp"));
        if (!Objects.equals(klass.getOrgId(), orgId)) {
            throw new NotFoundException("Không tìm thấy lớp trong trung tâm");
        }
        return klass;
    }

    /** Phiên bản phải thuộc org và ở trạng thái PUBLISHED (DRAFT chưa duyệt, ARCHIVED ngừng gán mới). */
    private OrgCurriculumVersion loadPublishableVersion(Long orgId, Long versionId) {
        OrgCurriculumVersion version = versionRepo.findById(versionId)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy phiên bản giáo trình"));
        curriculumRepo.findByIdAndOrgId(version.getCurriculumId(), orgId)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy phiên bản giáo trình"));
        if (OrgCurriculumVersion.STATUS_DRAFT.equals(version.getStatus())) {
            throw new ConflictException("Phiên bản còn ở bản nháp — trung tâm phải công bố trước khi gán cho lớp (P03)");
        }
        if (OrgCurriculumVersion.STATUS_ARCHIVED.equals(version.getStatus())) {
            throw new ConflictException("Phiên bản đã lưu trữ — không gán mới");
        }
        return version;
    }

    private ClassCurriculumLinkDto toDto(Long orgId, ClassCurriculumLink link) {
        OrgCurriculumVersion version = versionRepo.findById(link.getVersionId())
                .orElseThrow(() -> new NotFoundException("Không tìm thấy phiên bản giáo trình"));
        OrgCurriculum curriculum = curriculumRepo.findByIdAndOrgId(version.getCurriculumId(), orgId)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy bộ giáo trình"));
        return new ClassCurriculumLinkDto(link.getClassId(), curriculum.getId(), curriculum.getName(),
                version.getId(), version.getVersionNo(), version.getStatus(), link.getAssignedAt());
    }
}
