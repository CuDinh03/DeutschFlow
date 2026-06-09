package com.deutschflow.teacher.service;

import com.deutschflow.common.exception.ForbiddenException;
import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.teacher.dto.GradebookDto;
import com.deutschflow.teacher.entity.ClassAssignment;
import com.deutschflow.teacher.entity.ClassStudent;
import com.deutschflow.teacher.entity.StudentAssignment;
import com.deutschflow.teacher.entity.TeacherClass;
import com.deutschflow.teacher.repository.ClassAssignmentRepository;
import com.deutschflow.teacher.repository.ClassStudentRepository;
import com.deutschflow.teacher.repository.ClassTeacherRepository;
import com.deutschflow.teacher.repository.StudentAssignmentRepository;
import com.deutschflow.teacher.repository.TeacherClassRepository;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

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
    private final UserRepository userRepository;

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

    /**
     * Sổ điểm lớp: ma trận học viên × bài tập. Hàng sắp theo tên học viên,
     * cột theo thứ tự giao bài cũ → mới. avgScore mỗi học viên = trung bình
     * các ô đã có điểm (null nếu chưa bài nào được chấm).
     */
    @Transactional(readOnly = true)
    public GradebookDto gradebook(Long teacherId, Long classId) {
        if (!classTeacherRepository.existsByIdClassIdAndIdTeacherId(classId, teacherId)) {
            throw new ForbiddenException("Bạn không có quyền xem báo cáo của lớp này");
        }
        TeacherClass teacherClass = classRepository.findById(classId)
                .orElseThrow(() -> new NotFoundException("Lớp học không tồn tại"));

        List<ClassAssignment> assignments = new ArrayList<>(
                assignmentRepository.findByClassIdOrderByCreatedAtDesc(classId));
        Collections.reverse(assignments); // cũ → mới cho chiều đọc sổ điểm

        List<GradebookDto.AssignmentColumn> columns = assignments.stream()
                .map(a -> new GradebookDto.AssignmentColumn(a.getId(), a.getTopic(), a.getAssignmentType(), a.getDueDate()))
                .toList();

        // studentId → assignmentId → bài nộp
        Map<Long, Map<Long, StudentAssignment>> submissionsByStudent = new HashMap<>();
        if (!assignments.isEmpty()) {
            List<Long> assignmentIds = assignments.stream().map(ClassAssignment::getId).toList();
            for (StudentAssignment sa : studentAssignmentRepository.findByAssignmentIds(assignmentIds)) {
                submissionsByStudent
                        .computeIfAbsent(sa.getStudentId(), k -> new HashMap<>())
                        .put(sa.getAssignmentId(), sa);
            }
        }

        List<Long> studentIds = classStudentRepository.findByIdClassId(classId).stream()
                .map(cs -> cs.getId().getStudentId())
                .toList();
        Map<Long, User> usersById = studentIds.isEmpty() ? Map.of()
                : userRepository.findAllById(studentIds).stream()
                        .collect(Collectors.toMap(User::getId, u -> u));

        List<GradebookDto.StudentRow> rows = new ArrayList<>();
        for (Long studentId : studentIds) {
            User user = usersById.get(studentId);
            Map<Long, StudentAssignment> byAssignment = submissionsByStudent.getOrDefault(studentId, Map.of());

            Map<Long, GradebookDto.Cell> cells = new LinkedHashMap<>();
            List<Integer> scores = new ArrayList<>();
            for (ClassAssignment a : assignments) {
                StudentAssignment sa = byAssignment.get(a.getId());
                if (sa == null) continue; // chưa từng được giao → ô trống
                cells.put(a.getId(), new GradebookDto.Cell(sa.getStatus(), sa.getScore(), sa.getSubmittedAt()));
                if (sa.getScore() != null) scores.add(sa.getScore());
            }

            Double avgScore = scores.isEmpty() ? null
                    : scores.stream().mapToInt(Integer::intValue).average().orElse(0.0);
            rows.add(new GradebookDto.StudentRow(
                    studentId,
                    user != null ? user.getDisplayName() : "Học viên #" + studentId,
                    user != null ? user.getEmail() : "",
                    avgScore,
                    cells));
        }
        rows.sort(Comparator.comparing(r -> r.name() == null ? "" : r.name(), String.CASE_INSENSITIVE_ORDER));

        return new GradebookDto(classId, teacherClass.getName(), columns, rows);
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
