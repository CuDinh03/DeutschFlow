package com.deutschflow.teacher.service;

import com.deutschflow.common.exception.ConflictException;
import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.speaking.entity.UserGrammarError;
import com.deutschflow.speaking.repository.UserGrammarErrorRepository;
import com.deutschflow.teacher.dto.*;
import com.deutschflow.teacher.entity.ClassAssignment;
import com.deutschflow.teacher.entity.ClassStudent;
import com.deutschflow.teacher.entity.ClassStudentId;
import com.deutschflow.teacher.entity.TeacherClass;
import com.deutschflow.teacher.entity.ClassTeacher;
import com.deutschflow.teacher.entity.ClassTeacherId;
import com.deutschflow.teacher.repository.ClassAssignmentRepository;
import com.deutschflow.teacher.repository.ClassStudentRepository;
import com.deutschflow.teacher.repository.TeacherClassRepository;
import com.deutschflow.teacher.repository.ClassTeacherRepository;
import com.deutschflow.teacher.repository.StudentAssignmentRepository;
import com.deutschflow.teacher.entity.StudentAssignment;
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
    private final ClassTeacherRepository classTeacherRepository;
    private final ClassAssignmentRepository assignmentRepository;
    private final StudentAssignmentRepository studentAssignmentRepository;
    private final com.deutschflow.speaking.repository.AiSpeakingSessionRepository speakingSessionRepository;
    private final UserRepository userRepository;
    private final UserLearningProfileRepository profileRepository;
    private final UserGrammarErrorRepository grammarErrorRepository;
    private final com.deutschflow.teacher.repository.ClassroomJoinRequestRepository joinRequestRepository;
    private final XpService xpService;

    @Transactional
    public TeacherClassDto createClass(Long teacherId, String name) {
        String inviteCode = generateInviteCode();
        TeacherClass teacherClass = TeacherClass.builder()
                .teacherId(teacherId)
                .name(name)
                .inviteCode(inviteCode)
                .build();
        teacherClass = classRepository.save(teacherClass);

        ClassTeacher ct = ClassTeacher.builder()
                .id(new ClassTeacherId(teacherClass.getId(), teacherId))
                .role("PRIMARY")
                .build();
        classTeacherRepository.save(ct);

        return toClassDto(teacherClass);
    }

    @Transactional(readOnly = true)
    public List<TeacherClassDto> getClassesForTeacher(Long teacherId) {
        List<ClassTeacher> classTeachers = classTeacherRepository.findByIdTeacherId(teacherId);
        List<Long> classIds = classTeachers.stream().map(ct -> ct.getId().getClassId()).toList();
        if (classIds.isEmpty()) return List.of();
        
        return classRepository.findAllById(classIds)
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

        joinRequestRepository.findByClassroomIdAndStudentId(teacherClass.getId(), studentId)
                .ifPresent(req -> {
                    if ("PENDING".equals(req.getStatus())) {
                        throw new ConflictException("Bạn đã gửi yêu cầu tham gia lớp này rồi, vui lòng chờ giáo viên duyệt");
                    }
                });

        com.deutschflow.teacher.entity.ClassroomJoinRequest req = com.deutschflow.teacher.entity.ClassroomJoinRequest.builder()
                .classroomId(teacherClass.getId())
                .studentId(studentId)
                .status("PENDING")
                .build();
        joinRequestRepository.save(req);
    }

    @Transactional(readOnly = true)
    public List<JoinRequestDto> getPendingJoinRequests(Long teacherId, Long classId) {
        if (!classTeacherRepository.existsByIdClassIdAndIdTeacherId(classId, teacherId)) {
            throw new ConflictException("Bạn không có quyền xem lớp này");
        }

        return joinRequestRepository.findByClassroomIdAndStatusOrderByCreatedAtDesc(classId, "PENDING")
                .stream()
                .map(req -> {
                    User student = userRepository.findById(req.getStudentId()).orElse(null);
                    return new JoinRequestDto(
                            req.getId(),
                            req.getStudentId(),
                            student != null ? student.getDisplayName() : "Unknown",
                            student != null ? student.getEmail() : "Unknown",
                            req.getStatus(),
                            req.getCreatedAt()
                    );
                })
                .collect(Collectors.toList());
    }

    @Transactional
    public void approveJoinRequest(Long teacherId, Long classId, Long requestId) {
        if (!classTeacherRepository.existsByIdClassIdAndIdTeacherId(classId, teacherId)) {
            throw new ConflictException("Bạn không có quyền duyệt học viên lớp này");
        }

        com.deutschflow.teacher.entity.ClassroomJoinRequest req = joinRequestRepository.findById(requestId)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy yêu cầu"));

        if (!req.getClassroomId().equals(classId)) {
            throw new BadRequestException("Yêu cầu không thuộc lớp học này");
        }

        if (!"PENDING".equals(req.getStatus())) {
            throw new BadRequestException("Yêu cầu đã được xử lý");
        }

        req.setStatus("APPROVED");
        joinRequestRepository.save(req);

        if (!classStudentRepository.existsByIdClassIdAndIdStudentId(classId, req.getStudentId())) {
            ClassStudent classStudent = ClassStudent.builder()
                    .id(new ClassStudentId(classId, req.getStudentId()))
                    .build();
            classStudentRepository.save(classStudent);
        }
    }

    @Transactional
    public void rejectJoinRequest(Long teacherId, Long classId, Long requestId) {
        if (!classTeacherRepository.existsByIdClassIdAndIdTeacherId(classId, teacherId)) {
            throw new ConflictException("Bạn không có quyền duyệt học viên lớp này");
        }

        com.deutschflow.teacher.entity.ClassroomJoinRequest req = joinRequestRepository.findById(requestId)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy yêu cầu"));

        if (!req.getClassroomId().equals(classId)) {
            throw new BadRequestException("Yêu cầu không thuộc lớp học này");
        }

        if (!"PENDING".equals(req.getStatus())) {
            throw new BadRequestException("Yêu cầu đã được xử lý");
        }

        req.setStatus("REJECTED");
        joinRequestRepository.save(req);
    }

    @Transactional
    public void deleteClass(Long teacherId, Long classId) {
        if (!classTeacherRepository.existsByIdClassIdAndIdTeacherId(classId, teacherId)) {
            throw new ConflictException("Bạn không có quyền xóa lớp này");
        }
        
        // Remove dependencies
        classTeacherRepository.deleteByIdClassId(classId);
        classStudentRepository.deleteByIdClassId(classId);
        assignmentRepository.deleteByClassId(classId);
        
        // Remove class
        classRepository.deleteById(classId);
    }

    @Transactional
    public void addStudentToClassByEmail(Long teacherId, Long classId, String email) {
        if (!classTeacherRepository.existsByIdClassIdAndIdTeacherId(classId, teacherId)) {
            throw new ConflictException("Bạn không có quyền thêm học viên vào lớp này");
        }
        
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy người dùng với email: " + email));
                
        if (classStudentRepository.existsByIdClassIdAndIdStudentId(classId, user.getId())) {
            throw new ConflictException("Học viên đã tham gia lớp học này");
        }
        
        ClassStudent classStudent = ClassStudent.builder()
                .id(new ClassStudentId(classId, user.getId()))
                .build();
        classStudentRepository.save(classStudent);
    }

    @Transactional(readOnly = true)
    public List<ClassStudentDto> getClassStudents(Long teacherId, Long classId) {
        if (!classTeacherRepository.existsByIdClassIdAndIdTeacherId(classId, teacherId)) {
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
    public ClassAnalyticsOverviewDto getClassAnalytics(Long teacherId, Long classId) {
        // Kiểm tra quyền
        if (!classTeacherRepository.existsByIdClassIdAndIdTeacherId(classId, teacherId)) {
            throw new ConflictException("Bạn không có quyền xem lớp này");
        }

        List<ClassStudent> students = classStudentRepository.findByIdClassId(classId);
        List<Long> studentIds = students.stream().map(s -> s.getId().getStudentId()).toList();
        if (studentIds.isEmpty()) {
            return new ClassAnalyticsOverviewDto(0L, 0L, 0L, List.of());
        }

        // Calculate Total XP
        long totalXp = 0;
        for (Long studentId : studentIds) {
            totalXp += xpService.getSummary(studentId).totalXp();
        }

        // Lấy tất cả lỗi ngữ pháp của học sinh trong lớp
        List<UserGrammarError> errors = new ArrayList<>();
        for (Long studentId : studentIds) {
            errors.addAll(grammarErrorRepository.findTop20ByUserIdOrderByCreatedAtDesc(studentId));
        }

        Map<String, Long> errorCounts = errors.stream()
                .filter(e -> e.getErrorCode() != null)
                .collect(Collectors.groupingBy(UserGrammarError::getErrorCode, Collectors.counting()));

        List<ClassErrorAnalyticsDto> topErrors = errorCounts.entrySet().stream()
                .map(entry -> new ClassErrorAnalyticsDto(entry.getKey(), entry.getValue()))
                .sorted((a, b) -> Long.compare(b.count(), a.count()))
                .limit(10)
                .collect(Collectors.toList());

        // Dummy value for completed assignments for now until we query student_assignments
        long completedAssignments = 0L;

        return new ClassAnalyticsOverviewDto((long) studentIds.size(), totalXp, completedAssignments, topErrors);
    }

    @Transactional
    public ClassAssignmentDto createAssignment(Long teacherId, Long classId, CreateAssignmentRequest req) {
        if (!classTeacherRepository.existsByIdClassIdAndIdTeacherId(classId, teacherId)) {
            throw new ConflictException("Bạn không có quyền thao tác trên lớp này");
        }

        ClassAssignment assignment = ClassAssignment.builder()
                .classId(classId)
                .topic(req.topic())
                .description(req.description())
                .assignmentType(req.assignmentType())
                .referenceId(req.referenceId())
                .dueDate(req.dueDate())
                .build();
        ClassAssignment savedAssignment = assignmentRepository.save(assignment);

        List<ClassStudent> students = classStudentRepository.findByIdClassId(classId);
        List<StudentAssignment> studentAssignments = students.stream().map(student -> 
            StudentAssignment.builder()
                .assignmentId(savedAssignment.getId())
                .studentId(student.getId().getStudentId())
                .status("PENDING")
                .build()
        ).toList();
        
        studentAssignmentRepository.saveAll(studentAssignments);

        return toAssignmentDto(savedAssignment);
    }

    @Transactional(readOnly = true)
    public List<ClassAssignmentDto> getClassAssignments(Long classId) {
        return assignmentRepository.findByClassIdOrderByCreatedAtDesc(classId)
                .stream()
                .map(this::toAssignmentDto)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<StudentAssignmentDto> getStudentAssignments(Long teacherId, Long studentId) {
        boolean hasAccess = classTeacherRepository.findByIdTeacherId(teacherId).stream()
                .anyMatch(ct -> classStudentRepository.existsByIdClassIdAndIdStudentId(ct.getId().getClassId(), studentId));

        if (!hasAccess) {
            throw new ConflictException("Học viên không thuộc lớp của bạn");
        }

        return studentAssignmentRepository.findByStudentIdOrderByCreatedAtDesc(studentId)
                .stream()
                .map(this::toStudentAssignmentDto)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<TeacherSpeakingSessionDto> getStudentSpeakingSessions(Long teacherId, Long studentId) {
        // Teacher can only view if student is in one of their classes
        boolean hasAccess = classTeacherRepository.findByIdTeacherId(teacherId).stream()
                .anyMatch(ct -> classStudentRepository.existsByIdClassIdAndIdStudentId(ct.getId().getClassId(), studentId));

        if (!hasAccess) {
            throw new ConflictException("Học viên không thuộc lớp của bạn");
        }

        return speakingSessionRepository.findByUserIdOrderByStartedAtDesc(studentId)
                .stream()
                .map(this::toTeacherSpeakingSessionDto)
                .collect(Collectors.toList());
    }

    @Transactional
    public TeacherSpeakingSessionDto evaluateSpeakingSession(Long teacherId, Long sessionId, TeacherSessionEvaluationRequest req) {
        com.deutschflow.speaking.entity.AiSpeakingSession session = speakingSessionRepository.findById(sessionId)
                .orElseThrow(() -> new NotFoundException("Session không tồn tại"));

        boolean hasAccess = classTeacherRepository.findByIdTeacherId(teacherId).stream()
                .anyMatch(ct -> classStudentRepository.existsByIdClassIdAndIdStudentId(ct.getId().getClassId(), session.getUserId()));

        if (!hasAccess) {
            throw new ConflictException("Học viên không thuộc lớp của bạn");
        }

        session.setTeacherScore(req.teacherScore());
        session.setTeacherFeedback(req.teacherFeedback());
        session.setReviewedAt(java.time.LocalDateTime.now());
        
        return toTeacherSpeakingSessionDto(speakingSessionRepository.save(session));
    }

    @Transactional
    public StudentAssignmentDto evaluateAssignment(Long teacherId, Long assignmentId, TeacherSessionEvaluationRequest req) {
        StudentAssignment assignment = studentAssignmentRepository.findById(assignmentId)
                .orElseThrow(() -> new NotFoundException("Bài tập không tồn tại"));

        boolean hasAccess = classTeacherRepository.findByIdTeacherId(teacherId).stream()
                .anyMatch(ct -> classStudentRepository.existsByIdClassIdAndIdStudentId(ct.getId().getClassId(), assignment.getStudentId()));

        if (!hasAccess) {
            throw new ConflictException("Học viên không thuộc lớp của bạn");
        }

        assignment.setScore(req.teacherScore());
        assignment.setFeedback(req.teacherFeedback());
        assignment.setStatus("EVALUATED");
        assignment.setGradedAt(java.time.LocalDateTime.now());
        
        return toStudentAssignmentDto(studentAssignmentRepository.save(assignment));
    }

    private String generateInviteCode() {
        return UUID.randomUUID().toString().substring(0, 8).toUpperCase();
    }

    private TeacherClassDto toClassDto(TeacherClass c) {
        long studentCount = classStudentRepository.countByIdClassId(c.getId());
        long quizCount = assignmentRepository.countByClassId(c.getId());
        return new TeacherClassDto(c.getId(), c.getName(), c.getInviteCode(), studentCount, quizCount, c.getCreatedAt());
    }

    private ClassAssignmentDto toAssignmentDto(ClassAssignment a) {
        return new ClassAssignmentDto(a.getId(), a.getClassId(), a.getTopic(), a.getDescription(),
                a.getAssignmentType(), a.getReferenceId(), a.getDueDate(), a.getCreatedAt());
    }

    private TeacherSpeakingSessionDto toTeacherSpeakingSessionDto(com.deutschflow.speaking.entity.AiSpeakingSession s) {
        return new TeacherSpeakingSessionDto(
                s.getId(), s.getUserId(), s.getTopic(), s.getCefrLevel(), s.getStatus().name(),
                s.getMessageCount(), s.getAiScore(), s.getAiFeedback(),
                s.getTeacherScore(), s.getTeacherFeedback(),
                s.getStartedAt(), s.getEndedAt(), s.getReviewedAt()
        );
    }

    private StudentAssignmentDto toStudentAssignmentDto(StudentAssignment a) {
        ClassAssignment ca = assignmentRepository.findById(a.getAssignmentId()).orElse(null);
        return new StudentAssignmentDto(
                a.getId(), a.getAssignmentId(), a.getStudentId(), a.getStatus(),
                a.getScore(), a.getFeedback(), a.getSubmittedAt(), a.getCreatedAt(),
                ca != null ? ca.getTopic() : "",
                ca != null ? ca.getDescription() : "",
                ca != null ? ca.getAssignmentType() : "GENERAL",
                ca != null ? ca.getDueDate() : null,
                a.getSubmissionContent(),
                a.getSubmissionFileUrl()
        );
    }
}
