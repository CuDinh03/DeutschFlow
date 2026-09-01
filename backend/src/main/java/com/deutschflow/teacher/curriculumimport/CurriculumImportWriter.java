package com.deutschflow.teacher.curriculumimport;

import com.deutschflow.common.exception.ConflictException;
import com.deutschflow.teacher.curriculumimport.dto.CurriculumImportCommitRequest;
import com.deutschflow.teacher.curriculumimport.dto.CurriculumImportCommitResult;
import com.deutschflow.teacher.curriculumimport.dto.DraftCanDoStatement;
import com.deutschflow.teacher.curriculumimport.dto.DraftKnowledgePoint;
import com.deutschflow.teacher.curriculumimport.dto.DraftLesson;
import com.deutschflow.teacher.curriculumimport.dto.DraftModule;
import com.deutschflow.teacher.entity.CanDoStatement;
import com.deutschflow.teacher.entity.ClassLesson;
import com.deutschflow.teacher.entity.CurriculumModule;
import com.deutschflow.teacher.entity.LessonKnowledgePoint;
import com.deutschflow.teacher.repository.CanDoStatementRepository;
import com.deutschflow.teacher.repository.ClassLessonRepository;
import com.deutschflow.teacher.repository.CurriculumModuleRepository;
import com.deutschflow.teacher.repository.LessonKnowledgePointRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * The transactional half of a curriculum import: writes the modules, their lessons, and each
 * lesson's knowledge points and can-do statements, plus the idempotency row — all in one
 * transaction, so forty lessons either all land or none do.
 *
 * <p>It is a separate bean from {@link CurriculumImportCommitService} because the boundary has to be
 * real. A unique-key collision marks the transaction rollback-only, and nothing useful can be read
 * inside it afterwards; the caller must therefore see the exception with this transaction already
 * finished before it re-reads the winner's result. Catching it in a method of this same bean would
 * leave both concerns inside one doomed transaction.
 */
@Component
@RequiredArgsConstructor
public class CurriculumImportWriter {

    private final CurriculumModuleRepository moduleRepository;
    private final ClassLessonRepository lessonRepository;
    private final LessonKnowledgePointRepository pointRepository;
    private final CanDoStatementRepository canDoRepository;
    private final CurriculumImportCommitRepository commitRepository;
    private final ObjectMapper objectMapper;

    /**
     * Writes the whole draft and records the idempotency key.
     *
     * @throws org.springframework.dao.DataIntegrityViolationException when another request already
     *         claimed this key — the caller replays that request's result instead.
     */
    @Transactional
    public CurriculumImportCommitResult write(Long classId, Long teacherId, String idempotencyKey,
                                              Long sourceMaterialId, List<DraftModule> modules,
                                              String onDuplicate) {
        Set<String> takenTitles = moduleRepository.findByClassIdOrderByOrderIndexAsc(classId).stream()
                .map(m -> normalizeTitle(m.getTitle()))
                .collect(Collectors.toCollection(LinkedHashSet::new));

        int moduleOrder = moduleRepository.findMaxOrderIndex(classId) + 1;
        int lessonOrder = lessonRepository.findMaxOrderIndex(classId) + 1;

        List<Long> createdModuleIds = new ArrayList<>();
        List<String> skipped = new ArrayList<>();
        int lessonsCreated = 0;

        for (DraftModule draft : modules) {
            String title = draft.title();
            String normalized = normalizeTitle(title);

            if (takenTitles.contains(normalized)) {
                if (CurriculumImportCommitRequest.ON_DUPLICATE_SKIP.equals(onDuplicate)) {
                    skipped.add(title);
                    continue;
                }
                title = uniqueTitle(title, takenTitles);
                normalized = normalizeTitle(title);
            }
            takenTitles.add(normalized);

            CurriculumModule module = moduleRepository.save(CurriculumModule.builder()
                    .classId(classId)
                    .orderIndex(moduleOrder++)
                    .title(title)
                    .build());
            createdModuleIds.add(module.getId());

            for (DraftLesson draftLesson : draft.lessons()) {
                writeLesson(classId, module.getId(), lessonOrder++, draftLesson);
                lessonsCreated++;
            }
        }

        CurriculumImportCommitResult result = new CurriculumImportCommitResult(
                createdModuleIds.size(), lessonsCreated, List.copyOf(createdModuleIds),
                List.copyOf(skipped), false);

        // Same transaction as the curriculum: the key exists exactly when the rows it describes do.
        commitRepository.save(CurriculumImportCommitRecord.builder()
                .classId(classId)
                .teacherId(teacherId)
                .idempotencyKey(idempotencyKey)
                .sourceMaterialId(sourceMaterialId)
                .modulesCreated(result.modulesCreated())
                .lessonsCreated(result.lessonsCreated())
                .resultPayload(writeJson(result))
                .build());

        return result;
    }

    private void writeLesson(Long classId, Long moduleId, int orderIndex, DraftLesson draft) {
        ClassLesson lesson = lessonRepository.save(ClassLesson.builder()
                .classId(classId)
                .moduleId(moduleId)
                .orderIndex(orderIndex)
                .title(draft.title())
                // description mirrors the structured points, matching how ClassLessonService keeps
                // the legacy field in sync for mobile and older clients.
                .description(draft.knowledgePoints().stream()
                        .map(DraftKnowledgePoint::text)
                        .collect(Collectors.joining("\n")))
                .cefrLevel(draft.cefrLevel())
                .plannedDate(draft.plannedDate())
                .estimatedUnits(draft.estimatedUnits())
                .completed(false)
                .build());

        List<LessonKnowledgePoint> points = new ArrayList<>();
        int idx = 0;
        for (DraftKnowledgePoint p : draft.knowledgePoints()) {
            points.add(LessonKnowledgePoint.builder()
                    .lessonId(lesson.getId())
                    .orderIndex(idx++)
                    .text(p.text())
                    .skillTag(p.skillTag())
                    .contentTag(p.contentTag())
                    .build());
        }
        pointRepository.saveAll(points);

        List<CanDoStatement> canDos = new ArrayList<>();
        idx = 0;
        for (DraftCanDoStatement c : draft.canDoStatements()) {
            canDos.add(CanDoStatement.builder()
                    .lessonId(lesson.getId())
                    .orderIndex(idx++)
                    .text(c.text())
                    .cefrLevel(c.cefrLevel())
                    .skillTag(c.skillTag())
                    .build());
        }
        canDoRepository.saveAll(canDos);
    }

    private String writeJson(CurriculumImportCommitResult result) {
        try {
            return objectMapper.writeValueAsString(result);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Cannot serialise curriculum import result", e);
        }
    }

    /** Titles are compared case- and space-insensitively — "K01 – A" and "k01 –  a" are one module. */
    static String normalizeTitle(String title) {
        return title == null ? "" : title.replaceAll("\\s+", " ").trim().toLowerCase(Locale.ROOT);
    }

    private static String uniqueTitle(String title, Set<String> taken) {
        for (int i = 2; i < 100; i++) {
            String candidate = title + " (" + i + ")";
            if (!taken.contains(normalizeTitle(candidate))) return candidate;
        }
        throw new ConflictException("Không tạo được tên module duy nhất cho \"" + title + "\".");
    }
}
