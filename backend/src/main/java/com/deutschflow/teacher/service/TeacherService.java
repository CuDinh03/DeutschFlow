package com.deutschflow.teacher.service;

import com.deutschflow.common.exception.ConflictException;
import com.deutschflow.common.exception.ForbiddenException;
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
import com.deutschflow.teacher.entity.AssignmentScenario;
import com.deutschflow.teacher.repository.AssignmentScenarioRepository;
import com.deutschflow.speaking.service.SpeakingAiHelpersService;
import com.deutschflow.speaking.service.SpeakingAiHelpersService.PracticeScenario;
import com.deutschflow.notification.service.UserNotificationService;
import com.deutschflow.media.service.S3StorageService;
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
    private final UserNotificationService userNotificationService;
    private final SpeakingAiHelpersService speakingAiHelpersService;
    private final AssignmentScenarioRepository assignmentScenarioRepository;
    private final S3StorageService s3StorageService;

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
            throw new ForbiddenException("Bạn không có quyền xem lớp này");
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
            throw new ForbiddenException("Bạn không có quyền duyệt học viên lớp này");
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

        User student = userRepository.findById(req.getStudentId()).orElse(null);
        // Notify student
        TeacherClass teacherClass = classRepository.findById(classId).orElse(null);
        User teacher = userRepository.findById(teacherId).orElse(null);
        userNotificationService.onJoinRequestApproved(
            req.getStudentId(),
            classId,
            teacherClass != null ? teacherClass.getName() : "",
            teacher != null ? teacher.getDisplayName() : ""
        );

        if (teacher != null) {
            userNotificationService.onTeacherJoinRequestCreated(
                teacherId,
                classId,
                teacherClass != null ? teacherClass.getName() : "",
                req.getStudentId(),
                student != null ? student.getDisplayName() : "",
                student != null ? student.getEmail() : ""
            );
        }
    }

    @Transactional
    public void rejectJoinRequest(Long teacherId, Long classId, Long requestId) {
        if (!classTeacherRepository.existsByIdClassIdAndIdTeacherId(classId, teacherId)) {
            throw new ForbiddenException("Bạn không có quyền duyệt học viên lớp này");
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

        // Notify student
        TeacherClass teacherClass = classRepository.findById(classId).orElse(null);
        User teacher = userRepository.findById(teacherId).orElse(null);
        User student = userRepository.findById(req.getStudentId()).orElse(null);
        userNotificationService.onJoinRequestRejected(
            req.getStudentId(),
            classId,
            teacherClass != null ? teacherClass.getName() : "",
            teacher != null ? teacher.getDisplayName() : ""
        );

        if (teacher != null) {
            userNotificationService.onTeacherJoinRequestCreated(
                teacherId,
                classId,
                teacherClass != null ? teacherClass.getName() : "",
                req.getStudentId(),
                student != null ? student.getDisplayName() : "",
                student != null ? student.getEmail() : ""
            );
        }
    }

    @Transactional
    public void deleteClass(Long teacherId, Long classId) {
        // Chỉ giáo viên chính được xóa lớp (trợ giảng không có quyền hủy cả lớp)
        assertPrimaryTeacher(teacherId, classId);

        // Remove dependencies
        classTeacherRepository.deleteByIdClassId(classId);
        classStudentRepository.deleteByIdClassId(classId);
        assignmentRepository.deleteByClassId(classId);

        // Remove class
        classRepository.deleteById(classId);
    }

    // ─── Co-teaching: quản lý giáo viên trong lớp ────────────────────────────────

    /** Trả về ClassTeacher của caller nếu là PRIMARY; ném ForbiddenException nếu không. */
    private ClassTeacher assertPrimaryTeacher(Long teacherId, Long classId) {
        ClassTeacher membership = classTeacherRepository.findById(new ClassTeacherId(classId, teacherId))
                .orElseThrow(() -> new ForbiddenException("Bạn không có quyền với lớp học này"));
        if (!"PRIMARY".equals(membership.getRole())) {
            throw new ForbiddenException("Chỉ giáo viên chính mới được thực hiện thao tác này");
        }
        return membership;
    }

    @Transactional(readOnly = true)
    public List<ClassTeacherDto> getClassTeachers(Long teacherId, Long classId) {
        assertTeacherOwnsClass(teacherId, classId);

        List<ClassTeacher> classTeachers = classTeacherRepository.findByIdClassId(classId);
        List<Long> teacherIds = classTeachers.stream().map(ct -> ct.getId().getTeacherId()).toList();
        Map<Long, User> usersById = userRepository.findAllById(teacherIds).stream()
                .collect(Collectors.toMap(User::getId, u -> u));

        return classTeachers.stream()
                .sorted(Comparator.comparing(ct -> !"PRIMARY".equals(ct.getRole()))) // PRIMARY trước
                .map(ct -> {
                    User u = usersById.get(ct.getId().getTeacherId());
                    return new ClassTeacherDto(
                            ct.getId().getTeacherId(),
                            u != null ? u.getDisplayName() : "Giáo viên #" + ct.getId().getTeacherId(),
                            u != null ? u.getEmail() : "",
                            ct.getRole(),
                            ct.getJoinedAt());
                })
                .toList();
    }

    @Transactional
    public void addCoTeacher(Long teacherId, Long classId, String email) {
        assertPrimaryTeacher(teacherId, classId);

        User target = userRepository.findByEmail(email)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy người dùng với email: " + email));
        if (target.getRole() != User.Role.TEACHER && target.getRole() != User.Role.ADMIN) {
            throw new BadRequestException("Người dùng này không có vai trò giáo viên");
        }
        if (classTeacherRepository.existsByIdClassIdAndIdTeacherId(classId, target.getId())) {
            throw new ConflictException("Giáo viên này đã tham gia lớp");
        }

        classTeacherRepository.save(ClassTeacher.builder()
                .id(new ClassTeacherId(classId, target.getId()))
                .role("ASSISTANT")
                .build());
    }

    @Transactional
    public void removeCoTeacher(Long teacherId, Long classId, Long coTeacherId) {
        assertPrimaryTeacher(teacherId, classId);

        ClassTeacher target = classTeacherRepository.findById(new ClassTeacherId(classId, coTeacherId))
                .orElseThrow(() -> new NotFoundException("Giáo viên không thuộc lớp này"));
        if ("PRIMARY".equals(target.getRole())) {
            throw new BadRequestException("Không thể xóa giáo viên chính của lớp");
        }
        classTeacherRepository.delete(target);
    }

    @Transactional
    public void addStudentToClassByEmail(Long teacherId, Long classId, String email) {
        if (!classTeacherRepository.existsByIdClassIdAndIdTeacherId(classId, teacherId)) {
            throw new ForbiddenException("Bạn không có quyền thêm học viên vào lớp này");
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

        // Notify student
        TeacherClass teacherClass = classRepository.findById(classId).orElse(null);
        User teacher = userRepository.findById(teacherId).orElse(null);
        userNotificationService.onAddedToClass(
            user.getId(),
            classId,
            teacherClass != null ? teacherClass.getName() : "",
            teacher != null ? teacher.getDisplayName() : ""
        );
    }

    @Transactional(readOnly = true)
    public List<ClassStudentDto> getClassStudents(Long teacherId, Long classId) {
        if (!classTeacherRepository.existsByIdClassIdAndIdTeacherId(classId, teacherId)) {
            throw new ForbiddenException("Bạn không có quyền xem lớp này");
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
            throw new ForbiddenException("Bạn không có quyền xem lớp này");
        }

        List<ClassStudent> students = classStudentRepository.findByIdClassId(classId);
        List<Long> studentIds = students.stream().map(s -> s.getId().getStudentId()).toList();
        if (studentIds.isEmpty()) {
            return new ClassAnalyticsOverviewDto(0L, 0L, 0L, 0L, 0d, 0d, List.of(), List.of());
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

        long completedAssignments = 0L;
        long activeSpeakingSessions = 0L;
        double avgSpeakingScore = 0d;
        double reviewCoveragePct = 0d;
        List<ClassAnalyticsOverviewDto.ActionItemDto> actionItems = topErrors.isEmpty()
                ? List.of(new ClassAnalyticsOverviewDto.ActionItemDto(
                    "Theo dõi tiến độ",
                    "Chưa có lỗi nổi bật, tiếp tục quan sát nhịp học của lớp.",
                    "LOW",
                    "/teacher/classes/" + classId))
                : List.of(
                    new ClassAnalyticsOverviewDto.ActionItemDto(
                        "Ôn lỗi lặp lại nhiều nhất",
                        "Chọn 3 lỗi xuất hiện nhiều nhất và giao luyện tập ngắn cho lớp.",
                        "HIGH",
                        "/teacher/classes/" + classId)
                );

        return new ClassAnalyticsOverviewDto(
                (long) studentIds.size(),
                totalXp,
                completedAssignments,
                activeSpeakingSessions,
                avgSpeakingScore,
                reviewCoveragePct,
                topErrors,
                actionItems);
    }

    /**
     * Returns the AI speaking scenario for an assignment, generating it on demand if missing.
     *
     * <p>Scenarios are normally generated when the teacher creates a SPEAKING_SCENARIO assignment,
     * but that LLM call is best-effort — if it failed (model down, quota, transient error) the
     * assignment was left with no scenario and {@code referenceId == null}, permanently blocking the
     * student ("Không tìm thấy kịch bản bài tập"). This recovers by generating + persisting the
     * scenario the first time a student opens it, and back-fills {@code referenceId} on the assignment.
     *
     * @throws NotFoundException if the student is not assigned this assignment, the assignment does
     *                           not exist, or it is not a SPEAKING_SCENARIO type.
     */
    @Transactional
    public AssignmentScenario getOrCreateScenarioForStudent(Long assignmentId, Long studentId) {
        // IDOR guard: only a student actually assigned this assignment may read/generate its scenario.
        if (studentAssignmentRepository.findByStudentIdAndAssignmentId(studentId, assignmentId).isEmpty()) {
            throw new NotFoundException("Bài tập không tồn tại");
        }

        Optional<AssignmentScenario> existing =
                assignmentScenarioRepository.findFirstByAssignmentIdOrderByIdAsc(assignmentId);
        if (existing.isPresent()) {
            return existing.get();
        }

        ClassAssignment ca = assignmentRepository.findById(assignmentId)
                .orElseThrow(() -> new NotFoundException("Bài tập không tồn tại"));
        if (!"SPEAKING_SCENARIO".equals(ca.getAssignmentType())) {
            throw new NotFoundException("Bài tập này không có kịch bản luyện nói");
        }

        log.info("[Scenario] Lazily generating missing scenario for assignment {} (topic='{}')",
                assignmentId, ca.getTopic());
        PracticeScenario generated = speakingAiHelpersService.generateScenario(ca.getTopic(), "A2");
        AssignmentScenario scenario = assignmentScenarioRepository.save(AssignmentScenario.builder()
                .assignmentId(ca.getId())
                .topic(generated.getTopic())
                .level(generated.getLevel())
                .scenarioDescription(generated.getScenarioDescription())
                .followUpQuestions(generated.getFollowUpQuestions())
                .build());
        ca.setReferenceId(scenario.getId());
        assignmentRepository.save(ca);
        return scenario;
    }

    @Transactional
    public ClassAssignmentDto createAssignment(Long teacherId, Long classId, CreateAssignmentRequest req) {
        if (!classTeacherRepository.existsByIdClassIdAndIdTeacherId(classId, teacherId)) {
            throw new ForbiddenException("Bạn không có quyền thao tác trên lớp này");
        }

        ClassAssignment assignment = ClassAssignment.builder()
                .classId(classId)
                .topic(req.topic())
                .description(req.description())
                .assignmentType(req.assignmentType())
                .referenceId(req.referenceId())
                .dueDate(req.dueDate())
                .attachmentUrl(req.attachmentUrl())
                .build();
        ClassAssignment savedAssignment = assignmentRepository.save(assignment);

        // Khởi tạo kịch bản AI nếu là SPEAKING_SCENARIO
        if ("SPEAKING_SCENARIO".equals(req.assignmentType())) {
            try {
                PracticeScenario scenario = speakingAiHelpersService.generateScenario(req.topic(), "A2");
                AssignmentScenario assignmentScenario = AssignmentScenario.builder()
                        .assignmentId(savedAssignment.getId())
                        .topic(scenario.getTopic())
                        .level(scenario.getLevel())
                        .scenarioDescription(scenario.getScenarioDescription())
                        .followUpQuestions(scenario.getFollowUpQuestions())
                        .build();
                AssignmentScenario savedScenario = assignmentScenarioRepository.save(assignmentScenario);
                savedAssignment.setReferenceId(savedScenario.getId());
                assignmentRepository.save(savedAssignment);
            } catch (Exception e) {
                log.error("Failed to generate AI scenario for assignment {}: {}", savedAssignment.getId(), e.getMessage());
            }
        }

        List<ClassStudent> students = classStudentRepository.findByIdClassId(classId);
        List<StudentAssignment> studentAssignments = students.stream().map(student ->
            StudentAssignment.builder()
                .assignmentId(savedAssignment.getId())
                .studentId(student.getId().getStudentId())
                .status("PENDING")
                .build()
        ).toList();

        studentAssignmentRepository.saveAll(studentAssignments);

        // Notify all students in class (async batch)
        TeacherClass teacherClass = classRepository.findById(classId).orElse(null);
        User teacher = userRepository.findById(teacherId).orElse(null);
        userNotificationService.onNewClassAssignment(
            classId,
            teacherClass != null ? teacherClass.getName() : "",
            teacher != null ? teacher.getDisplayName() : "",
            savedAssignment.getId(),
            savedAssignment.getTopic()
        );

        return toAssignmentDto(savedAssignment);
    }

    /**
     * IDOR guard dùng chung: chặn teacher truy cập lớp không thuộc về mình.
     * Dùng cho các endpoint nhận {classId} mà service đích không tự kiểm tra quyền.
     */
    @Transactional(readOnly = true)
    public void assertTeacherOwnsClass(Long teacherId, Long classId) {
        if (!classTeacherRepository.existsByIdClassIdAndIdTeacherId(classId, teacherId)) {
            throw new ForbiddenException("Bạn không có quyền xem lớp này");
        }
    }

    @Transactional(readOnly = true)
    public List<ClassAssignmentDto> getClassAssignments(Long teacherId, Long classId) {
        assertTeacherOwnsClass(teacherId, classId);
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
        TeacherSpeakingSessionDto result = toTeacherSpeakingSessionDto(speakingSessionRepository.save(session));

        // Notify student
        userNotificationService.onAssignmentGraded(
            session.getUserId(), "SPEAKING", sessionId, req.teacherScore(), req.teacherFeedback()
        );

        User student = userRepository.findById(session.getUserId()).orElse(null);
        TeacherClass teacherClass = classRepository.findById(classTeacherRepository.findByIdTeacherId(teacherId).stream()
                .findFirst()
                .map(ct -> ct.getId().getClassId())
                .orElse(null)).orElse(null);
        if (teacherClass != null) {
            userNotificationService.onTeacherGradingEvent(
                teacherId,
                teacherClass.getId(),
                teacherClass.getName(),
                sessionId,
                session.getUserId(),
                student != null ? student.getDisplayName() : "",
                "SPEAKING_GRADED",
                req.teacherScore()
            );
        }

        return result;
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
        StudentAssignmentDto result = toStudentAssignmentDto(studentAssignmentRepository.save(assignment));

        // Notify student
        userNotificationService.onAssignmentGraded(
            assignment.getStudentId(), "ASSIGNMENT", assignment.getAssignmentId(),
            req.teacherScore(), req.teacherFeedback()
        );

        return result;
    }

    private String generateInviteCode() {
        return UUID.randomUUID().toString().substring(0, 8).toUpperCase();
    }

    public String generatePresignedUrl(String objectKey, String contentType) {
        return s3StorageService.generatePresignedUrl(objectKey, contentType);
    }

    private TeacherClassDto toClassDto(TeacherClass c) {
        long studentCount = classStudentRepository.countByIdClassId(c.getId());
        long quizCount = assignmentRepository.countByClassId(c.getId());
        return new TeacherClassDto(c.getId(), c.getName(), c.getInviteCode(), studentCount, quizCount, c.getCreatedAt());
    }

    private ClassAssignmentDto toAssignmentDto(ClassAssignment a) {
        return new ClassAssignmentDto(a.getId(), a.getClassId(), a.getTopic(), a.getDescription(),
                a.getAssignmentType(), a.getReferenceId(), a.getDueDate(), a.getCreatedAt(), a.getAttachmentUrl());
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
                a.getSubmissionFileUrl(),
                ca != null ? ca.getAttachmentUrl() : null,
                ca != null ? ca.getReferenceId() : null
        );
    }
}
