package com.deutschflow.teacher.service;

import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.common.exception.ForbiddenException;
import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.teacher.dto.CanDoStatementDto;
import com.deutschflow.teacher.dto.CanDoStatementInput;
import com.deutschflow.teacher.dto.ClassLessonDto;
import com.deutschflow.teacher.dto.CreateLessonRequest;
import com.deutschflow.teacher.dto.KnowledgePointDto;
import com.deutschflow.teacher.dto.KnowledgePointInput;
import com.deutschflow.teacher.dto.ReorderLessonsRequest;
import com.deutschflow.teacher.dto.UpdateLessonRequest;
import com.deutschflow.teacher.entity.CanDoStatement;
import com.deutschflow.teacher.entity.ClassLesson;
import com.deutschflow.teacher.entity.LessonKnowledgePoint;
import com.deutschflow.teacher.repository.CanDoStatementRepository;
import com.deutschflow.teacher.repository.ClassLessonRepository;
import com.deutschflow.teacher.repository.ClassStudentRepository;
import com.deutschflow.teacher.repository.ClassTeacherRepository;
import com.deutschflow.teacher.repository.CurriculumModuleRepository;
import com.deutschflow.teacher.repository.LessonKnowledgePointRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ClassLessonService {

    private static final Set<String> CEFR_LEVELS = Set.of("A1", "A2", "B1", "B2", "C1", "C2");
    private static final Set<String> SKILL_TAGS = Set.of("HOEREN", "LESEN", "SCHREIBEN", "SPRECHEN");
    private static final Set<String> CONTENT_TAGS =
            Set.of("WORTSCHATZ", "GRAMMATIK", "AUSSPRACHE", "LANDESKUNDE", "REDEMITTEL", "STRATEGIE");
    // Mirrors the frontend parseKnowledgePoints regex (/^\s*[-•·*]\s*/) for the legacy fallback.
    private static final Pattern BULLET = Pattern.compile("^\\s*[-•·*]\\s*");
    // Business bounds for a class schedule date — also keeps a bad value a clean 400
    // instead of letting an out-of-range year reach PostgreSQL's DATE limit as a 500.
    private static final LocalDate PLANNED_MIN = LocalDate.of(2000, 1, 1);
    private static final LocalDate PLANNED_MAX = LocalDate.of(2100, 12, 31);

    private final ClassLessonRepository lessonRepository;
    private final ClassTeacherRepository classTeacherRepository;
    private final ClassStudentRepository classStudentRepository;
    private final LessonKnowledgePointRepository knowledgePointRepository;
    private final CurriculumModuleRepository moduleRepository;
    private final CanDoStatementRepository canDoRepository;

    @Transactional(readOnly = true)
    public List<ClassLessonDto> listForTeacher(Long teacherId, Long classId) {
        assertTeacherOwns(teacherId, classId);
        return toDtos(lessonRepository.findByClassIdOrderByOrderIndexAsc(classId));
    }

    @Transactional(readOnly = true)
    public List<ClassLessonDto> listForStudent(Long studentId, Long classId) {
        assertStudentEnrolled(studentId, classId);
        return toDtos(lessonRepository.findByClassIdOrderByOrderIndexAsc(classId));
    }

    @Transactional
    public ClassLessonDto create(Long teacherId, Long classId, CreateLessonRequest req) {
        assertTeacherOwns(teacherId, classId);
        if (req == null || req.title() == null || req.title().isBlank()) {
            throw new BadRequestException("Tiêu đề buổi học không được để trống");
        }

        // Structured knowledgePoints (Phase 1b) is canonical; otherwise mirror the legacy
        // description into the sub-table. Either way description is kept in sync (dual-write).
        List<KnowledgePointInput> points;
        String description;
        if (req.knowledgePoints() != null) {
            points = req.knowledgePoints();
            description = joinTexts(points);
        } else {
            description = req.description();
            points = toInputs(parseDescriptionTexts(description));
        }

        int nextOrder = lessonRepository.findMaxOrderIndex(classId) + 1;

        ClassLesson lesson = ClassLesson.builder()
                .classId(classId)
                .orderIndex(nextOrder)
                .title(req.title().trim())
                .description(description)
                .cefrLevel(normalizeCefrLevel(req.cefrLevel()))
                .plannedDate(validatePlannedDate(req.plannedDate()))
                .estimatedUnits(validateEstimatedUnits(req.estimatedUnits()))
                .completed(false)
                .build();
        ClassLesson saved = lessonRepository.save(lesson);
        replacePoints(saved.getId(), points);
        replaceCanDos(saved.getId(), req.canDoStatements());
        return toDto(saved, resolveForLesson(saved), resolveCanDosForLesson(saved));
    }

    @Transactional
    public ClassLessonDto update(Long teacherId, Long classId, Long lessonId, UpdateLessonRequest req) {
        assertTeacherOwns(teacherId, classId);
        ClassLesson lesson = loadLessonInClass(classId, lessonId);

        if (req == null) {
            throw new BadRequestException("Request body trống");
        }
        if (req.title() != null && !req.title().isBlank()) {
            lesson.setTitle(req.title().trim());
        }
        // Knowledge points: structured list is canonical (also re-derives description);
        // else a raw description update re-syncs the sub-table from the parsed text.
        if (req.knowledgePoints() != null) {
            lesson.setDescription(joinTexts(req.knowledgePoints()));
            replacePoints(lesson.getId(), req.knowledgePoints());
        } else if (req.description() != null) {
            lesson.setDescription(req.description());
            replacePoints(lesson.getId(), toInputs(parseDescriptionTexts(req.description())));
        }
        // CEFR / pacing: a `clear*` flag sets null; otherwise a non-null (non-blank) value
        // applies and a null/blank value is a no-op (leave the stored value as-is).
        if (Boolean.TRUE.equals(req.clearCefrLevel())) {
            lesson.setCefrLevel(null);
        } else if (req.cefrLevel() != null && !req.cefrLevel().isBlank()) {
            lesson.setCefrLevel(normalizeCefrLevel(req.cefrLevel()));
        }
        if (Boolean.TRUE.equals(req.clearPlannedDate())) {
            lesson.setPlannedDate(null);
        } else if (req.plannedDate() != null) {
            lesson.setPlannedDate(validatePlannedDate(req.plannedDate()));
        }
        if (Boolean.TRUE.equals(req.clearEstimatedUnits())) {
            lesson.setEstimatedUnits(null);
        } else if (req.estimatedUnits() != null) {
            lesson.setEstimatedUnits(validateEstimatedUnits(req.estimatedUnits()));
        }
        if (req.completed() != null && req.completed() != lesson.isCompleted()) {
            lesson.setCompleted(req.completed());
            if (req.completed()) {
                lesson.setCompletedAt(LocalDateTime.now());
                lesson.setCompletedByTeacherId(teacherId);
            } else {
                lesson.setCompletedAt(null);
                lesson.setCompletedByTeacherId(null);
            }
        }
        // Can-do statements (Phase 1e): non-null REPLACES (empty list clears); null leaves as-is.
        if (req.canDoStatements() != null) {
            replaceCanDos(lesson.getId(), req.canDoStatements());
        }
        ClassLesson saved = lessonRepository.save(lesson);
        return toDto(saved, resolveForLesson(saved), resolveCanDosForLesson(saved));
    }

    @Transactional
    public void delete(Long teacherId, Long classId, Long lessonId) {
        assertTeacherOwns(teacherId, classId);
        ClassLesson lesson = loadLessonInClass(classId, lessonId);
        lessonRepository.delete(lesson); // FK ON DELETE CASCADE removes the sub-table points
    }

    /** Assign a lesson to a curriculum module (moduleId null → ungroup). Module must be same-class. */
    @Transactional
    public ClassLessonDto assignModule(Long teacherId, Long classId, Long lessonId, Long moduleId) {
        assertTeacherOwns(teacherId, classId);
        ClassLesson lesson = loadLessonInClass(classId, lessonId);
        if (moduleId != null && !moduleRepository.existsByIdAndClassId(moduleId, classId)) {
            throw new BadRequestException("Module không thuộc lớp này");
        }
        lesson.setModuleId(moduleId);
        ClassLesson saved = lessonRepository.save(lesson);
        return toDto(saved, resolveForLesson(saved), resolveCanDosForLesson(saved));
    }

    @Transactional
    public List<ClassLessonDto> reorder(Long teacherId, Long classId, ReorderLessonsRequest req) {
        assertTeacherOwns(teacherId, classId);
        if (req == null || req.orderedLessonIds() == null || req.orderedLessonIds().isEmpty()) {
            throw new BadRequestException("Danh sách thứ tự không được trống");
        }

        List<ClassLesson> existing = lessonRepository.findByClassIdOrderByOrderIndexAsc(classId);
        Map<Long, ClassLesson> byId = new HashMap<>();
        existing.forEach(l -> byId.put(l.getId(), l));

        List<Long> ordered = req.orderedLessonIds();
        // Must be a true permutation: reject duplicates/omissions (same length + all-known would
        // otherwise pass a list like [1,2,2], overwriting one lesson's orderIndex and leaving
        // another with a stale/duplicate index).
        if (ordered.size() != existing.size()
                || new HashSet<>(ordered).size() != ordered.size()
                || !byId.keySet().containsAll(ordered)) {
            throw new BadRequestException("Danh sách lesson IDs không khớp với lớp");
        }

        for (int i = 0; i < ordered.size(); i++) {
            ClassLesson l = byId.get(ordered.get(i));
            if (l.getOrderIndex() != i) {
                l.setOrderIndex(i);
                lessonRepository.save(l);
            }
        }
        return toDtos(lessonRepository.findByClassIdOrderByOrderIndexAsc(classId));
    }

    private void assertTeacherOwns(Long teacherId, Long classId) {
        if (!classTeacherRepository.existsByIdClassIdAndIdTeacherId(classId, teacherId)) {
            throw new ForbiddenException("Bạn không có quyền với lớp học này");
        }
    }

    private void assertStudentEnrolled(Long studentId, Long classId) {
        if (!classStudentRepository.existsByIdClassIdAndIdStudentId(classId, studentId)) {
            throw new NotFoundException("Không tìm thấy lớp học");
        }
    }

    private ClassLesson loadLessonInClass(Long classId, Long lessonId) {
        ClassLesson lesson = lessonRepository.findById(lessonId)
                .orElseThrow(() -> new NotFoundException("Buổi học không tồn tại"));
        if (!Objects.equals(lesson.getClassId(), classId)) {
            throw new BadRequestException("Buổi học không thuộc lớp này");
        }
        return lesson;
    }

    // ── Knowledge points ────────────────────────────────────────────────────

    /** Replace all sub-table points for a lesson with the given inputs (empty texts dropped). */
    private void replacePoints(Long lessonId, List<KnowledgePointInput> inputs) {
        knowledgePointRepository.deleteByLessonId(lessonId);
        List<LessonKnowledgePoint> rows = new ArrayList<>();
        int idx = 0;
        for (KnowledgePointInput in : inputs) {
            if (in == null) continue; // tolerate a null array element (malformed JSON) — no 500
            String text = in.text() == null ? "" : in.text().trim();
            if (text.isEmpty()) continue;
            rows.add(LessonKnowledgePoint.builder()
                    .lessonId(lessonId)
                    .orderIndex(idx++)
                    .text(text)
                    .skillTag(normalizeSkillTag(in.skillTag()))
                    .contentTag(normalizeContentTag(in.contentTag()))
                    .build());
        }
        if (!rows.isEmpty()) {
            knowledgePointRepository.saveAll(rows);
        }
    }

    /** Points for one lesson (create/update return): sub-table if present, else description fallback. */
    private List<KnowledgePointDto> resolveForLesson(ClassLesson lesson) {
        return resolvePointDtos(lesson, knowledgePointRepository.findByLessonIdOrderByOrderIndexAsc(lesson.getId()));
    }

    /** Batch DTO mapping with grouped point + can-do queries (avoids N+1 across a class's lessons). */
    private List<ClassLessonDto> toDtos(List<ClassLesson> lessons) {
        List<Long> ids = lessons.stream().map(ClassLesson::getId).toList();
        Map<Long, List<LessonKnowledgePoint>> byLesson = ids.isEmpty()
                ? Map.of()
                : knowledgePointRepository.findByLessonIdInOrderByLessonIdAscOrderIndexAsc(ids).stream()
                        .collect(Collectors.groupingBy(LessonKnowledgePoint::getLessonId));
        Map<Long, List<CanDoStatement>> canDosByLesson = ids.isEmpty()
                ? Map.of()
                : canDoRepository.findByLessonIdInOrderByLessonIdAscOrderIndexAsc(ids).stream()
                        .collect(Collectors.groupingBy(CanDoStatement::getLessonId));
        return lessons.stream()
                .map(l -> toDto(l,
                        resolvePointDtos(l, byLesson.getOrDefault(l.getId(), List.of())),
                        canDoDtos(canDosByLesson.getOrDefault(l.getId(), List.of()))))
                .toList();
    }

    private static List<KnowledgePointDto> resolvePointDtos(ClassLesson lesson, List<LessonKnowledgePoint> rows) {
        if (!rows.isEmpty()) {
            return rows.stream().map(ClassLessonService::pointDto).toList();
        }
        // Legacy fallback: a lesson not yet re-saved has its points only inside description.
        List<String> texts = parseDescriptionTexts(lesson.getDescription());
        List<KnowledgePointDto> out = new ArrayList<>(texts.size());
        for (int i = 0; i < texts.size(); i++) {
            out.add(new KnowledgePointDto(null, i, texts.get(i), null, null));
        }
        return out;
    }

    private static KnowledgePointDto pointDto(LessonKnowledgePoint p) {
        return new KnowledgePointDto(p.getId(), p.getOrderIndex(), p.getText(), p.getSkillTag(), p.getContentTag());
    }

    // ── Can-do statements (Phase 1e) ────────────────────────────────────────

    /** Replace all can-do statements for a lesson with the given inputs (empty texts dropped). */
    private void replaceCanDos(Long lessonId, List<CanDoStatementInput> inputs) {
        canDoRepository.deleteByLessonId(lessonId);
        if (inputs == null) return;
        List<CanDoStatement> rows = new ArrayList<>();
        int idx = 0;
        for (CanDoStatementInput in : inputs) {
            if (in == null) continue; // tolerate a null array element (malformed JSON) — no 500
            String text = in.text() == null ? "" : in.text().trim();
            if (text.isEmpty()) continue;
            rows.add(CanDoStatement.builder()
                    .lessonId(lessonId)
                    .orderIndex(idx++)
                    .text(text)
                    .cefrLevel(normalizeCefrLevel(in.cefrLevel()))
                    .skillTag(normalizeSkillTag(in.skillTag()))
                    .build());
        }
        if (!rows.isEmpty()) {
            canDoRepository.saveAll(rows);
        }
    }

    private List<CanDoStatementDto> resolveCanDosForLesson(ClassLesson lesson) {
        return canDoDtos(canDoRepository.findByLessonIdOrderByOrderIndexAsc(lesson.getId()));
    }

    private static List<CanDoStatementDto> canDoDtos(List<CanDoStatement> rows) {
        return rows.stream().map(ClassLessonService::canDoDto).toList();
    }

    private static CanDoStatementDto canDoDto(CanDoStatement c) {
        return new CanDoStatementDto(c.getId(), c.getOrderIndex(), c.getCefrLevel(), c.getSkillTag(), c.getText());
    }

    /** Newline-join the non-empty point texts — the description mirror (dual-write for mobile/legacy). */
    private static String joinTexts(List<KnowledgePointInput> inputs) {
        return inputs.stream()
                .filter(Objects::nonNull)
                .map(i -> i.text() == null ? "" : i.text().trim())
                .filter(t -> !t.isEmpty())
                .collect(Collectors.joining("\n"));
    }

    private static List<KnowledgePointInput> toInputs(List<String> texts) {
        return texts.stream().map(t -> new KnowledgePointInput(t, null, null)).toList();
    }

    /** Parse a legacy description into point texts (mirrors frontend parseKnowledgePoints). */
    private static List<String> parseDescriptionTexts(String description) {
        if (description == null || description.isBlank()) return List.of();
        List<String> out = new ArrayList<>();
        for (String line : description.split("\n")) {
            String t = BULLET.matcher(line).replaceFirst("").trim();
            if (!t.isEmpty()) out.add(t);
        }
        return out;
    }

    private static String normalizeSkillTag(String raw) {
        if (raw == null || raw.isBlank()) return null;
        String v = raw.trim().toUpperCase();
        if (!SKILL_TAGS.contains(v)) {
            throw new BadRequestException("Tag kỹ năng không hợp lệ: " + raw);
        }
        return v;
    }

    private static String normalizeContentTag(String raw) {
        if (raw == null || raw.isBlank()) return null;
        String v = raw.trim().toUpperCase();
        if (!CONTENT_TAGS.contains(v)) {
            throw new BadRequestException("Tag nội dung không hợp lệ: " + raw);
        }
        return v;
    }

    // ── CEFR / pacing validation ────────────────────────────────────────────

    /** Normalize + validate a CEFR level; null/blank → null, unknown → 400. */
    private static String normalizeCefrLevel(String raw) {
        if (raw == null || raw.isBlank()) return null;
        String v = raw.trim().toUpperCase();
        if (!CEFR_LEVELS.contains(v)) {
            throw new BadRequestException("Cấp CEFR không hợp lệ: " + raw);
        }
        return v;
    }

    /** Validate estimated teaching units; null → null, non-positive → 400. */
    private static Integer validateEstimatedUnits(Integer units) {
        if (units == null) return null;
        if (units <= 0) {
            throw new BadRequestException("Số tiết dự kiến phải là số dương");
        }
        return units;
    }

    /** Validate planned teaching date; null → null, out-of-range → 400 (avoids a DB-flush 500). */
    private static LocalDate validatePlannedDate(LocalDate date) {
        if (date == null) return null;
        if (date.isBefore(PLANNED_MIN) || date.isAfter(PLANNED_MAX)) {
            throw new BadRequestException("Ngày dự kiến không hợp lệ");
        }
        return date;
    }

    static ClassLessonDto toDto(ClassLesson l, List<KnowledgePointDto> knowledgePoints,
                                List<CanDoStatementDto> canDoStatements) {
        return new ClassLessonDto(
                l.getId(),
                l.getClassId(),
                l.getOrderIndex(),
                l.getModuleId(),
                l.getTitle(),
                l.getDescription(),
                l.getCefrLevel(),
                l.getPlannedDate(),
                l.getEstimatedUnits(),
                l.isCompleted(),
                l.getCompletedAt(),
                l.getCompletedByTeacherId(),
                l.getCreatedAt(),
                l.getUpdatedAt(),
                knowledgePoints,
                canDoStatements
        );
    }
}
