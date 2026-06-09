package com.deutschflow.teacher.service;

import com.deutschflow.common.exception.ForbiddenException;
import com.deutschflow.teacher.entity.ClassAssignment;
import com.deutschflow.teacher.entity.ClassStudent;
import com.deutschflow.teacher.entity.StudentAssignment;
import com.deutschflow.teacher.entity.TeacherClass;
import com.deutschflow.teacher.repository.ClassAssignmentRepository;
import com.deutschflow.teacher.repository.ClassStudentRepository;
import com.deutschflow.teacher.repository.ClassTeacherRepository;
import com.deutschflow.teacher.repository.StudentAssignmentRepository;
import com.deutschflow.teacher.repository.TeacherClassRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

/**
 * Teacher reporting over the live classroom schema (teacher_classes / class_students /
 * class_assignments / student_assignments). Replaces the retired quiz-based report service,
 * which read a disconnected legacy schema.
 */
@Service
@RequiredArgsConstructor
public class TeacherReportService {

    private final TeacherClassRepository classRepository;
    private final ClassTeacherRepository classTeacherRepository;
    private final ClassStudentRepository classStudentRepository;
    private final ClassAssignmentRepository assignmentRepository;
    private final StudentAssignmentRepository studentAssignmentRepository;

    @Transactional(readOnly = true)
    public Map<String, Object> overview(Long teacherId) {
        List<TeacherClass> classes = classRepository.findByTeacherId(teacherId);
        List<Long> classIds = classes.stream().map(TeacherClass::getId).toList();

        Set<Long> studentIds = new HashSet<>();
        for (TeacherClass c : classes) {
            classStudentRepository.findByIdClassId(c.getId())
                    .forEach(cs -> studentIds.add(cs.getId().getStudentId()));
        }

        List<ClassAssignment> assignments = classIds.isEmpty()
                ? List.of()
                : assignmentRepository.findByClassIdIn(classIds);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("classCount", classes.size());
        result.put("assignmentCount", assignments.size());
        result.put("studentCount", studentIds.size());
        result.put("avgScore", averageScore(assignments));
        return result;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> classReport(Long teacherId, Long classId) {
        if (!classTeacherRepository.existsByIdClassIdAndIdTeacherId(classId, teacherId)) {
            throw new ForbiddenException("Bạn không có quyền xem báo cáo của lớp này");
        }

        long studentCount = classStudentRepository.countByIdClassId(classId);
        List<ClassAssignment> assignments = assignmentRepository.findByClassIdOrderByCreatedAtDesc(classId);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("classId", classId);
        result.put("studentCount", studentCount);
        result.put("assignmentCount", assignments.size());
        result.put("avgScore", averageScore(assignments));
        return result;
    }

    /** Average of graded student-submission scores across the given assignments (0 when none). */
    private double averageScore(List<ClassAssignment> assignments) {
        if (assignments.isEmpty()) return 0.0;
        List<Long> assignmentIds = assignments.stream().map(ClassAssignment::getId).toList();
        List<StudentAssignment> submissions = studentAssignmentRepository.findByAssignmentIds(assignmentIds);
        return submissions.stream()
                .map(StudentAssignment::getScore)
                .filter(Objects::nonNull)
                .mapToInt(Integer::intValue)
                .average()
                .orElse(0.0);
    }
}
