package com.deutschflow.teacher.service;

import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.teacher.dto.ClassroomDetailDto;
import com.deutschflow.teacher.dto.MyClassroomDto;
import com.deutschflow.teacher.dto.StudentAssignmentDto;
import com.deutschflow.teacher.dto.TeacherSummaryDto;
import com.deutschflow.teacher.entity.ClassAssignment;
import com.deutschflow.teacher.entity.ClassLesson;
import com.deutschflow.teacher.entity.ClassStudent;
import com.deutschflow.teacher.entity.ClassTeacher;
import com.deutschflow.teacher.entity.StudentAssignment;
import com.deutschflow.teacher.entity.TeacherClass;
import com.deutschflow.teacher.repository.ClassAssignmentRepository;
import com.deutschflow.teacher.repository.ClassLessonRepository;
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
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class StudentClassroomService {

    private final TeacherClassRepository classRepository;
    private final ClassStudentRepository classStudentRepository;
    private final ClassTeacherRepository classTeacherRepository;
    private final ClassAssignmentRepository assignmentRepository;
    private final ClassLessonRepository lessonRepository;
    private final StudentAssignmentRepository studentAssignmentRepository;
    private final UserRepository userRepository;

    @Transactional(readOnly = true)
    public List<MyClassroomDto> listMyClasses(Long studentId) {
        List<ClassStudent> memberships = classStudentRepository.findByIdStudentId(studentId);
        if (memberships.isEmpty()) return List.of();

        List<Long> classIds = memberships.stream().map(m -> m.getId().getClassId()).toList();
        Map<Long, java.time.LocalDateTime> joinedAt = new HashMap<>();
        memberships.forEach(m -> joinedAt.put(m.getId().getClassId(), m.getJoinedAt()));

        Map<Long, TeacherClass> classesById = classRepository.findAllById(classIds).stream()
                .collect(Collectors.toMap(TeacherClass::getId, c -> c));

        Map<Long, List<TeacherSummaryDto>> teachersByClass = teachersForClasses(classIds);
        Map<Long, List<ClassAssignment>> assignmentsByClass = assignmentRepository.findByClassIdIn(classIds).stream()
                .collect(Collectors.groupingBy(ClassAssignment::getClassId));
        List<Long> allAssignmentIds = assignmentsByClass.values().stream()
                .flatMap(List::stream).map(ClassAssignment::getId).toList();
        Map<Long, StudentAssignment> myByAssignmentId = allAssignmentIds.isEmpty()
                ? Map.of()
                : studentAssignmentRepository.findByAssignmentIds(allAssignmentIds).stream()
                        .filter(sa -> sa.getStudentId().equals(studentId))
                        .collect(Collectors.toMap(StudentAssignment::getAssignmentId, sa -> sa, (a, b) -> a));

        List<MyClassroomDto> out = new ArrayList<>(classIds.size());
        for (Long classId : classIds) {
            TeacherClass cls = classesById.get(classId);
            if (cls == null) continue;

            List<ClassAssignment> classAssignments = assignmentsByClass.getOrDefault(classId, List.of());
            Stats stats = aggregateStats(classAssignments, myByAssignmentId);

            ClassAssignment latest = classAssignments.stream()
                    .max(Comparator.comparing(ClassAssignment::getCreatedAt))
                    .orElse(null);

            long lessonTotal = lessonRepository.countByClassId(classId);
            long lessonDone = lessonRepository.countByClassIdAndCompletedTrue(classId);

            out.add(new MyClassroomDto(
                    cls.getId(),
                    cls.getName(),
                    teachersByClass.getOrDefault(classId, List.of()),
                    stats.total(),
                    stats.pending(),
                    stats.submitted(),
                    stats.graded(),
                    stats.avgScore(),
                    latest != null ? latest.getTopic() : null,
                    latest != null ? latest.getDueDate() : null,
                    lessonTotal,
                    lessonDone,
                    joinedAt.get(classId)
            ));
        }
        out.sort(Comparator.comparing(MyClassroomDto::joinedAt, Comparator.nullsLast(Comparator.reverseOrder())));
        return out;
    }

    @Transactional(readOnly = true)
    public ClassroomDetailDto getClassDetail(Long studentId, Long classId) {
        ClassStudent membership = classStudentRepository.findByIdStudentId(studentId).stream()
                .filter(m -> m.getId().getClassId().equals(classId))
                .findFirst()
                .orElseThrow(() -> new NotFoundException("Không tìm thấy lớp học"));

        TeacherClass cls = classRepository.findById(classId)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy lớp học"));

        List<TeacherSummaryDto> teachers = teachersForClasses(List.of(classId)).getOrDefault(classId, List.of());
        List<ClassAssignment> classAssignments = assignmentRepository.findByClassIdOrderByCreatedAtDesc(classId);
        Map<Long, StudentAssignment> myByAssignmentId = classAssignments.isEmpty()
                ? Map.of()
                : studentAssignmentRepository.findByAssignmentIds(
                        classAssignments.stream().map(ClassAssignment::getId).toList()).stream()
                        .filter(sa -> sa.getStudentId().equals(studentId))
                        .collect(Collectors.toMap(StudentAssignment::getAssignmentId, sa -> sa, (a, b) -> a));

        Stats stats = aggregateStats(classAssignments, myByAssignmentId);

        long lessonTotal = lessonRepository.countByClassId(classId);
        long lessonDone = lessonRepository.countByClassIdAndCompletedTrue(classId);
        String currentLessonTitle = lessonRepository.findByClassIdOrderByOrderIndexAsc(classId).stream()
                .filter(l -> !l.isCompleted())
                .map(ClassLesson::getTitle)
                .findFirst()
                .orElse(null);

        long studentCount = classStudentRepository.countByIdClassId(classId);

        return new ClassroomDetailDto(
                cls.getId(),
                cls.getName(),
                cls.getInviteCode(),
                teachers,
                studentCount,
                stats.total(),
                stats.pending(),
                stats.submitted(),
                stats.graded(),
                stats.avgScore(),
                lessonTotal,
                lessonDone,
                currentLessonTitle,
                membership.getJoinedAt(),
                cls.getCreatedAt()
        );
    }

    @Transactional(readOnly = true)
    public List<StudentAssignmentDto> listAssignments(Long studentId, Long classId) {
        assertEnrolled(studentId, classId);
        List<ClassAssignment> classAssignments = assignmentRepository.findByClassIdOrderByCreatedAtDesc(classId);
        if (classAssignments.isEmpty()) return List.of();

        Map<Long, ClassAssignment> assignmentById = classAssignments.stream()
                .collect(Collectors.toMap(ClassAssignment::getId, a -> a));

        return studentAssignmentRepository.findByAssignmentIds(new ArrayList<>(assignmentById.keySet())).stream()
                .filter(sa -> sa.getStudentId().equals(studentId))
                .sorted(Comparator.comparing(StudentAssignment::getCreatedAt).reversed())
                .map(sa -> toDto(sa, assignmentById.get(sa.getAssignmentId())))
                .toList();
    }

    private void assertEnrolled(Long studentId, Long classId) {
        if (!classStudentRepository.existsByIdClassIdAndIdStudentId(classId, studentId)) {
            throw new NotFoundException("Không tìm thấy lớp học");
        }
    }

    private Map<Long, List<TeacherSummaryDto>> teachersForClasses(List<Long> classIds) {
        if (classIds.isEmpty()) return Map.of();

        List<ClassTeacher> classTeachers = classTeacherRepository.findByIdClassIdIn(classIds);
        Set<Long> teacherIds = classTeachers.stream()
                .map(ct -> ct.getId().getTeacherId())
                .collect(Collectors.toSet());
        Map<Long, User> usersById = userRepository.findAllById(teacherIds).stream()
                .collect(Collectors.toMap(User::getId, u -> u));

        Map<Long, List<TeacherSummaryDto>> out = new HashMap<>();
        for (ClassTeacher ct : classTeachers) {
            Long classId = ct.getId().getClassId();
            Long teacherId = ct.getId().getTeacherId();
            User u = usersById.get(teacherId);
            if (u == null) continue;
            out.computeIfAbsent(classId, k -> new ArrayList<>()).add(new TeacherSummaryDto(
                    u.getId(),
                    u.getDisplayName(),
                    u.getEmail(),
                    ct.getRole()
            ));
        }
        out.values().forEach(list -> list.sort(Comparator.comparing(
                t -> "PRIMARY".equals(t.role()) ? 0 : 1)));
        return out;
    }

    private Stats aggregateStats(List<ClassAssignment> classAssignments,
                                  Map<Long, StudentAssignment> myByAssignmentId) {
        long total = classAssignments.size();
        long pending = 0;
        long submitted = 0;
        long graded = 0;
        long scoreSum = 0;
        long scoreCount = 0;

        for (ClassAssignment ca : classAssignments) {
            StudentAssignment sa = myByAssignmentId.get(ca.getId());
            if (sa == null) {
                pending++;
                continue;
            }
            String status = sa.getStatus();
            if ("PENDING".equals(status)) pending++;
            else if ("SUBMITTED".equals(status)) submitted++;
            else if ("GRADED".equals(status) || "EVALUATED".equals(status)) {
                graded++;
                if (sa.getScore() != null) {
                    scoreSum += sa.getScore();
                    scoreCount++;
                }
            } else {
                pending++;
            }
        }

        Double avg = scoreCount > 0 ? (double) scoreSum / scoreCount : null;
        return new Stats(total, pending, submitted, graded, avg);
    }

    private StudentAssignmentDto toDto(StudentAssignment a, ClassAssignment ca) {
        return new StudentAssignmentDto(
                a.getId(), a.getAssignmentId(), a.getStudentId(), a.getStatus(),
                a.getScore(), a.getFeedback(), a.getSubmittedAt(), a.getCreatedAt(),
                ca != null ? ca.getTopic() : "",
                ca != null ? ca.getDescription() : "",
                ca != null ? ca.getAssignmentType() : "GENERAL",
                ca != null ? ca.getDueDate() : null,
                a.getSubmissionContent(),
                a.getSubmissionFileUrl(),
                ca != null ? ca.getAttachmentUrl() : null,
                ca != null ? ca.getReferenceId() : null
        );
    }

    private record Stats(long total, long pending, long submitted, long graded, Double avgScore) {}
}
