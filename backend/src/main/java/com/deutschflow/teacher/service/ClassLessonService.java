package com.deutschflow.teacher.service;

import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.common.exception.ConflictException;
import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.teacher.dto.ClassLessonDto;
import com.deutschflow.teacher.dto.CreateLessonRequest;
import com.deutschflow.teacher.dto.ReorderLessonsRequest;
import com.deutschflow.teacher.dto.UpdateLessonRequest;
import com.deutschflow.teacher.entity.ClassLesson;
import com.deutschflow.teacher.repository.ClassLessonRepository;
import com.deutschflow.teacher.repository.ClassStudentRepository;
import com.deutschflow.teacher.repository.ClassTeacherRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

@Service
@RequiredArgsConstructor
public class ClassLessonService {

    private final ClassLessonRepository lessonRepository;
    private final ClassTeacherRepository classTeacherRepository;
    private final ClassStudentRepository classStudentRepository;

    @Transactional(readOnly = true)
    public List<ClassLessonDto> listForTeacher(Long teacherId, Long classId) {
        assertTeacherOwns(teacherId, classId);
        return lessonRepository.findByClassIdOrderByOrderIndexAsc(classId)
                .stream()
                .map(ClassLessonService::toDto)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<ClassLessonDto> listForStudent(Long studentId, Long classId) {
        assertStudentEnrolled(studentId, classId);
        return lessonRepository.findByClassIdOrderByOrderIndexAsc(classId)
                .stream()
                .map(ClassLessonService::toDto)
                .toList();
    }

    @Transactional
    public ClassLessonDto create(Long teacherId, Long classId, CreateLessonRequest req) {
        assertTeacherOwns(teacherId, classId);
        if (req == null || req.title() == null || req.title().isBlank()) {
            throw new BadRequestException("Tiêu đề buổi học không được để trống");
        }

        int nextOrder = lessonRepository.findMaxOrderIndex(classId) + 1;

        ClassLesson lesson = ClassLesson.builder()
                .classId(classId)
                .orderIndex(nextOrder)
                .title(req.title().trim())
                .description(req.description())
                .completed(false)
                .build();
        return toDto(lessonRepository.save(lesson));
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
        if (req.description() != null) {
            lesson.setDescription(req.description());
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
        return toDto(lessonRepository.save(lesson));
    }

    @Transactional
    public void delete(Long teacherId, Long classId, Long lessonId) {
        assertTeacherOwns(teacherId, classId);
        ClassLesson lesson = loadLessonInClass(classId, lessonId);
        lessonRepository.delete(lesson);
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
        if (ordered.size() != existing.size()
                || !ordered.stream().allMatch(byId::containsKey)) {
            throw new BadRequestException("Danh sách lesson IDs không khớp với lớp");
        }

        for (int i = 0; i < ordered.size(); i++) {
            ClassLesson l = byId.get(ordered.get(i));
            if (l.getOrderIndex() != i) {
                l.setOrderIndex(i);
                lessonRepository.save(l);
            }
        }
        return lessonRepository.findByClassIdOrderByOrderIndexAsc(classId)
                .stream()
                .map(ClassLessonService::toDto)
                .toList();
    }

    private void assertTeacherOwns(Long teacherId, Long classId) {
        if (!classTeacherRepository.existsByIdClassIdAndIdTeacherId(classId, teacherId)) {
            throw new ConflictException("Bạn không có quyền với lớp học này");
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

    static ClassLessonDto toDto(ClassLesson l) {
        return new ClassLessonDto(
                l.getId(),
                l.getClassId(),
                l.getOrderIndex(),
                l.getTitle(),
                l.getDescription(),
                l.isCompleted(),
                l.getCompletedAt(),
                l.getCompletedByTeacherId(),
                l.getCreatedAt(),
                l.getUpdatedAt()
        );
    }
}
