package com.deutschflow.teacher.service;

import com.deutschflow.common.exception.ConflictException;
import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.speaking.entity.UserGrammarError;
import com.deutschflow.speaking.repository.UserGrammarErrorRepository;
import com.deutschflow.teacher.dto.*;
import com.deutschflow.teacher.entity.ClassAssignment;
import com.deutschflow.teacher.entity.ClassStudent;
import com.deutschflow.teacher.entity.ClassStudentId;
import com.deutschflow.teacher.entity.TeacherClass;
import com.deutschflow.teacher.repository.ClassAssignmentRepository;
import com.deutschflow.teacher.repository.ClassStudentRepository;
import com.deutschflow.teacher.repository.TeacherClassRepository;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.entity.UserLearningProfile;
import com.deutschflow.user.repository.UserLearningProfileRepository;
import com.deutschflow.user.repository.UserRepository;
import com.deutschflow.gamification.service.XpService;
import com.deutschflow.gamification.dto.XpSummaryDto;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class TeacherService {

    private final TeacherClassRepository classRepository;
    private final ClassStudentRepository classStudentRepository;
    private final ClassAssignmentRepository assignmentRepository;
    private final UserRepository userRepository;
    private final UserLearningProfileRepository profileRepository;
    private final UserGrammarErrorRepository grammarErrorRepository;
    private final XpService xpService;

    @Transactional
    public TeacherClassDto createClass(Long teacherId, String name) {
        String inviteCode = generateInviteCode();
        TeacherClass teacherClass = TeacherClass.builder()
                .teacherId(teacherId)
                .name(name)
                .inviteCode(inviteCode)
                .build();
        return toClassDto(classRepository.save(teacherClass));
    }

    @Transactional(readOnly = true)
    public List<TeacherClassDto> getClassesForTeacher(Long teacherId) {
        return classRepository.findByTeacherId(teacherId)
                .stream()
                .map(this::toClassDto)
                .collect(Collectors.toList());
    }

    @Transactional
    public void joinClass(Long studentId, String inviteCode) {
        TeacherClass teacherClass = classRepository.findByInviteCode(inviteCode)
                .orElseThrow(() -> new NotFoundException("Mã lớp học không hợp lệ"));

        if (classStudentRepository.existsByIdClassIdAndIdStudentId(teacherClass.getId(), studentId)) {
            throw new ConflictException("Bạn đã tham gia lớp học này rồi");
        }

        ClassStudent classStudent = ClassStudent.builder()
                .id(new ClassStudentId(teacherClass.getId(), studentId))
                .build();
        classStudentRepository.save(classStudent);
    }

    @Transactional(readOnly = true)
    public List<ClassStudentDto> getClassStudents(Long teacherId, Long classId) {
        TeacherClass teacherClass = classRepository.findById(classId)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy lớp học"));
        if (!teacherClass.getTeacherId().equals(teacherId)) {
            throw new ConflictException("Bạn không có quyền xem lớp này");
        }

        List<ClassStudent> students = classStudentRepository.findByIdClassId(classId);
        List<Long> studentIds = students.stream().map(s -> s.getId().getStudentId()).toList();

        if (studentIds.isEmpty()) return List.of();

        List<User> users = userRepository.findAllById(studentIds);
        List<UserLearningProfile> profiles = profileRepository.findByUserIdIn(studentIds);
        Map<Long, UserLearningProfile> profileMap = profiles.stream()
                .collect(Collectors.toMap(p -> p.getUser().getId(), p -> p));

        return users.stream().map(user -> {
            UserLearningProfile profile = profileMap.get(user.getId());
            XpSummaryDto xpSummary = xpService.getSummary(user.getId());
            return new ClassStudentDto(
                    user.getId(),
                    user.getDisplayName(),
                    user.getEmail(),
                    xpSummary.totalXp(),
                    xpSummary.level(), // Using streakDays field for level in DTO for now
                    profile != null && profile.getTargetLevel() != null ? profile.getTargetLevel().name() : "N/A"
            );
        }).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<ClassAnalyticsDto> getClassAnalytics(Long teacherId, Long classId) {
        // Kiểm tra quyền
        TeacherClass teacherClass = classRepository.findById(classId)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy lớp học"));
        if (!teacherClass.getTeacherId().equals(teacherId)) {
            throw new ConflictException("Bạn không có quyền xem lớp này");
        }

        List<ClassStudent> students = classStudentRepository.findByIdClassId(classId);
        List<Long> studentIds = students.stream().map(s -> s.getId().getStudentId()).toList();
        if (studentIds.isEmpty()) return List.of();

        // Lấy tất cả lỗi ngữ pháp của học sinh trong lớp (giới hạn 1000 lỗi gần nhất)
        List<UserGrammarError> errors = new ArrayList<>();
        for (Long studentId : studentIds) {
            errors.addAll(grammarErrorRepository.findTop20ByUserIdOrderByCreatedAtDesc(studentId));
        }

        // Gom nhóm theo mã lỗi ngữ pháp
        Map<String, Long> errorCounts = errors.stream()
                .filter(e -> e.getErrorCode() != null)
                .collect(Collectors.groupingBy(UserGrammarError::getErrorCode, Collectors.counting()));

        // Trả về top lỗi
        return errorCounts.entrySet().stream()
                .map(entry -> new ClassAnalyticsDto(entry.getKey(), entry.getValue()))
                .sorted((a, b) -> Long.compare(b.count(), a.count()))
                .limit(10)
                .collect(Collectors.toList());
    }

    @Transactional
    public ClassAssignmentDto createAssignment(Long teacherId, Long classId, String topic, String description) {
        TeacherClass teacherClass = classRepository.findById(classId)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy lớp học"));
        if (!teacherClass.getTeacherId().equals(teacherId)) {
            throw new ConflictException("Bạn không có quyền xem lớp này");
        }

        ClassAssignment assignment = ClassAssignment.builder()
                .classId(classId)
                .topic(topic)
                .description(description)
                .build();
        return toAssignmentDto(assignmentRepository.save(assignment));
    }

    @Transactional(readOnly = true)
    public List<ClassAssignmentDto> getClassAssignments(Long classId) {
        return assignmentRepository.findByClassIdOrderByCreatedAtDesc(classId)
                .stream()
                .map(this::toAssignmentDto)
                .collect(Collectors.toList());
    }

    private String generateInviteCode() {
        return UUID.randomUUID().toString().substring(0, 8).toUpperCase();
    }

    private TeacherClassDto toClassDto(TeacherClass c) {
        return new TeacherClassDto(c.getId(), c.getName(), c.getInviteCode(), c.getCreatedAt());
    }

    private ClassAssignmentDto toAssignmentDto(ClassAssignment a) {
        return new ClassAssignmentDto(a.getId(), a.getClassId(), a.getTopic(), a.getDescription(), a.getCreatedAt());
    }
}
