package com.deutschflow.teacher.service;

import com.deutschflow.common.audit.AuditActor;
import com.deutschflow.common.audit.AuditLogService;
import com.deutschflow.common.exception.ConflictException;
import com.deutschflow.common.exception.ForbiddenException;
import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.speaking.repository.UserGrammarErrorRepository;
import com.deutschflow.teacher.dto.*;
import com.deutschflow.teacher.entity.AssignmentStatus;
import com.deutschflow.teacher.entity.ClassAssignment;
import com.deutschflow.teacher.entity.ClassStudent;
import com.deutschflow.teacher.entity.ClassStudentId;
import com.deutschflow.teacher.entity.TeacherClass;
import com.deutschflow.teacher.entity.ClassTeacher;
import com.deutschflow.teacher.entity.ClassTeacherId;
import com.deutschflow.teacher.entity.ClassLesson;
import com.deutschflow.teacher.repository.ClassAssignmentRepository;
import com.deutschflow.teacher.repository.ClassLessonRepository;
import com.deutschflow.teacher.repository.ClassStudentRepository;
import com.deutschflow.teacher.repository.TeacherClassRepository;
import com.deutschflow.teacher.repository.ClassTeacherRepository;
import com.deutschflow.teacher.repository.StudentAssignmentRepository;
import com.deutschflow.teacher.entity.StudentAssignment;
import com.deutschflow.teacher.entity.AssignmentScenario;
import com.deutschflow.teacher.repository.AssignmentScenarioRepository;
import com.deutschflow.speaking.service.SpeakingAiHelpersService;
import com.deutschflow.speaking.service.SpeakingAiHelpersService.PracticeScenario;
import com.deutschflow.notification.NotificationType;
import com.deutschflow.notification.service.UserNotificationService;
import com.deutschflow.notification.service.NotificationAutoAckService;
import com.deutschflow.common.transaction.RunAfterCommitService;
import com.deutschflow.media.service.S3StorageService;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.entity.UserLearningProfile;
import com.deutschflow.user.repository.UserLearningProfileRepository;
import com.deutschflow.user.repository.UserRepository;
import com.deutschflow.gamification.service.XpService;
import org.springframework.data.domain.PageRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
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
    private final AssignmentBackfillService assignmentBackfillService;
    private final com.deutschflow.teacher.repository.ClassAssignmentRecipientRepository assignmentRecipientRepository;
    private final com.deutschflow.organization.repository.ClassCurriculumLinkRepository classCurriculumLinkRepositoryPr8;
    private final com.deutschflow.organization.repository.CurriculumLektionRepository curriculumLektionRepositoryPr8;
    private final com.deutschflow.organization.repository.CurriculumItemRepository curriculumItemRepositoryPr8;
    private final com.deutschflow.teacher.repository.ClassSessionRepository classSessionRepositoryPr8;
    private final JdbcTemplate jdbcTemplate;
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
    private final ClassLessonRepository lessonRepository;
    private final StudentCompetencyService studentCompetencyService;
    private final com.deutschflow.material.service.MaterialService materialService;
    private final NotificationAutoAckService notificationAutoAckService;
    private final RunAfterCommitService runAfterCommitService;
    private final ClassDeletionGuard classDeletionGuard;
    private final AuditLogService auditLogService;
    private final com.deutschflow.organization.service.OrgMembershipService orgMembershipService;
    /** Ký lại link file bài nộp — bucket private nên URL trần đã lưu không mở được. */
    private final SubmissionFileUrlResolver submissionFileUrlResolver;

    /** Tên lớp: bắt buộc, tối đa {@value #MAX_CLASS_NAME_LENGTH} ký tự (cột DB là varchar(255)). */
    private static final int MAX_CLASS_NAME_LENGTH = 255;

    @Transactional
    public TeacherClassDto createClass(Long teacherId, String name) {
        // Trước đây không kiểm tra gì: `{"name":""}` tạo được lớp không tên, và lớp thì chỉ xoá được
        // khi chưa có dữ liệu dạy học — nghĩa là rác đọng lại trong danh sách của giáo viên (QA 03/08).
        String cleanName = name == null ? "" : name.trim();
        if (cleanName.isEmpty()) {
            throw new BadRequestException("Tên lớp không được để trống.");
        }
        if (cleanName.length() > MAX_CLASS_NAME_LENGTH) {
            throw new BadRequestException("Tên lớp tối đa " + MAX_CLASS_NAME_LENGTH + " ký tự.");
        }
        String inviteCode = generateInviteCode();
        // Stamp the creating teacher's org (B2B): an org teacher's classes belong to that org,
        // so they show in /org/classes and are valid roster-import targets. null for B2C teachers.
        Long orgId = userRepository.findById(teacherId).map(u -> u.getOrgId()).orElse(null);
        TeacherClass teacherClass = TeacherClass.builder()
                .teacherId(teacherId)
                .orgId(orgId)
                .name(cleanName)
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
        return buildClassDtos(classIds);
    }

    /**
     * M-17 (G-3): các lớp của {@code teacherId} THUỘC org caller — lớp org khác lặng lẽ vắng mặt
     * (không lộ tồn tại); giáo viên không thuộc org → danh sách rỗng tự nhiên.
     */
    public List<TeacherClassDto> getClassesForTeacherInOrg(Long orgId, Long teacherId) {
        List<ClassTeacher> links = classTeacherRepository.findByIdTeacherId(teacherId);
        List<Long> classIds = links.stream().map(ct -> ct.getId().getClassId()).toList();
        if (classIds.isEmpty()) return List.of();
        List<Long> inOrg = classRepository.findAllById(classIds).stream()
                .filter(c -> orgId.equals(c.getOrgId()))
                .map(TeacherClass::getId)
                .toList();
        if (inOrg.isEmpty()) return List.of();
        return buildClassDtos(inOrg);
    }

    private List<TeacherClassDto> buildClassDtos(List<Long> classIds) {
        // Batch-load student and assignment counts — avoids N+1 (2 queries per class).
        String placeholders = classIds.stream().map(ignored -> "?").collect(Collectors.joining(","));
        Object[] args = classIds.toArray();

        Map<Long, Long> studentCounts = new HashMap<>();
        jdbcTemplate.queryForList(
                "SELECT class_id, COUNT(*) AS cnt FROM class_students WHERE class_id IN (" + placeholders + ") GROUP BY class_id",
                args).forEach(r -> studentCounts.put(toLong(r.get("class_id")), toLong(r.get("cnt"))));

        Map<Long, Long> assignmentCounts = new HashMap<>();
        jdbcTemplate.queryForList(
                "SELECT class_id, COUNT(*) AS cnt FROM class_assignments WHERE class_id IN (" + placeholders + ") GROUP BY class_id",
                args).forEach(r -> assignmentCounts.put(toLong(r.get("class_id")), toLong(r.get("cnt"))));

        // Bài chờ chấm theo lớp — trạng thái khớp AssignmentStatus.AWAITING_TEACHER (F05: FE đọc
        // pendingReviewCount trên thẻ lớp từ lâu nhưng DTO chưa từng trả).
        Map<Long, Long> pendingCounts = new HashMap<>();
        jdbcTemplate.queryForList(
                "SELECT ca.class_id AS class_id, COUNT(*) AS cnt FROM student_assignments sa"
                        + " JOIN class_assignments ca ON ca.id = sa.assignment_id"
                        + " WHERE ca.class_id IN (" + placeholders + ")"
                        + " AND sa.status IN ('SUBMITTED','AI_GRADED','GRADING_FAILED')"
                        + " AND COALESCE(sa.is_deleted, false) = false"
                        + " GROUP BY ca.class_id",
                args).forEach(r -> pendingCounts.put(toLong(r.get("class_id")), toLong(r.get("cnt"))));

        return classRepository.findAllById(classIds)
                .stream()
                .map(c -> {
                    long studentCount = studentCounts.getOrDefault(c.getId(), 0L);
                    long quizCount = assignmentCounts.getOrDefault(c.getId(), 0L);
                    long pendingCount = pendingCounts.getOrDefault(c.getId(), 0L);
                    return new TeacherClassDto(c.getId(), c.getName(), c.getInviteCode(), studentCount, quizCount, pendingCount, c.getCreatedAt());
                })
                .collect(Collectors.toList());
    }

    private static long toLong(Object v) {
        return v instanceof Number n ? n.longValue() : 0L;
    }

    @Transactional
    public void joinClass(Long studentId, String inviteCode) {
        TeacherClass teacherClass = classRepository.findByInviteCode(inviteCode)
                .orElseThrow(() -> new NotFoundException("Mã lớp học không hợp lệ"));

        // Org isolation — cùng quy tắc với addStudentToClassByEmail: lớp của trung tâm không nhận
        // người đang thuộc trung tâm khác. Chặn ngay lúc gửi yêu cầu để học viên biết liền, thay vì
        // để giáo viên bấm duyệt rồi mới vỡ ở ensureStudentSeat. Học viên chưa thuộc trung tâm nào
        // vẫn được gửi yêu cầu — ghế org_members sẽ được cấp lúc giáo viên duyệt.
        if (teacherClass.getOrgId() != null) {
            Long studentOrgId = userRepository.findById(studentId).map(User::getOrgId).orElse(null);
            if (studentOrgId != null && !studentOrgId.equals(teacherClass.getOrgId())) {
                throw new BadRequestException("Lớp này thuộc một trung tâm khác với trung tâm của bạn.");
            }
        }

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

        // Tell the teachers NOW, while the request is actually pending. The only calls to
        // onTeacherJoinRequestCreated used to sit inside approveJoinRequest/rejectJoinRequest — so a
        // teacher was told "X asked to join" only AFTER they had already approved or rejected X, and was
        // never told when the request arrived. A student could sit unapproved for days.
        try {
            User student = userRepository.findById(studentId).orElse(null);
            for (ClassTeacher ct : classTeacherRepository.findByIdClassId(teacherClass.getId())) {
                userNotificationService.onTeacherJoinRequestCreated(
                        ct.getId().getTeacherId(),
                        teacherClass.getId(),
                        teacherClass.getName(),
                        studentId,
                        student != null ? student.getDisplayName() : "",
                        student != null ? student.getEmail() : "");
            }
        } catch (Exception e) {
            log.warn("[notifications] Could not notify teachers of join request for class {}: {}",
                    teacherClass.getId(), e.toString());
        }
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
        // PR B trợ giảng: duyệt HV vào lớp là quản-lý-lớp — chỉ GV phụ trách (ma trận owner 06/08).
        assertPrimaryTeacher(teacherId, classId);

        com.deutschflow.teacher.entity.ClassroomJoinRequest req = joinRequestRepository.findById(requestId)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy yêu cầu"));

        if (!req.getClassroomId().equals(classId)) {
            throw new BadRequestException("Yêu cầu không thuộc lớp học này");
        }

        if (!"PENDING".equals(req.getStatus())) {
            throw new BadRequestException("Yêu cầu đã được xử lý");
        }

        TeacherClass teacherClass = classRepository.findById(classId)
                .orElseThrow(() -> new NotFoundException("Lớp học không tồn tại"));

        // Lớp của trung tâm thì duyệt vào lớp = nhận vào trung tâm: học viên phải có ghế STUDENT
        // ACTIVE trong org_members. Trước đây bước này bị bỏ qua nên trung tâm có lớp đầy học viên
        // mà roster/seat của org vẫn 0. Ném lỗi (khác org, hết ghế) → rollback cả lượt duyệt.
        if (teacherClass.getOrgId() != null) {
            orgMembershipService.ensureStudentSeat(teacherClass.getOrgId(), req.getStudentId());
        }

        req.setStatus("APPROVED");
        joinRequestRepository.save(req);

        if (!classStudentRepository.existsByIdClassIdAndIdStudentId(classId, req.getStudentId())) {
            ClassStudent classStudent = ClassStudent.builder()
                    .id(new ClassStudentId(classId, req.getStudentId()))
                    .build();
            classStudentRepository.save(classStudent);
        }

        // Give the newcomer the assignments the class already handed out before they joined — otherwise
        // they'd be counted as "chờ nộp" for work they can't see or submit (idempotent).
        assignmentBackfillService.ensureAssignmentsForStudent(classId, req.getStudentId());

        // Notify the student. The teacher is NOT notified here: they are the one who just clicked
        // approve. (There used to be an onTeacherJoinRequestCreated call right here, telling the teacher
        // "X yêu cầu tham gia lớp" immediately after they had approved X. The notification now fires in
        // joinClass, when the request actually arrives.)
        User teacher = userRepository.findById(teacherId).orElse(null);
        userNotificationService.onJoinRequestApproved(
            req.getStudentId(),
            classId,
            teacherClass.getName(),
            teacher != null ? teacher.getDisplayName() : ""
        );

        // Yêu cầu đã xử lý → "Yêu cầu tham gia lớp" (CLASS_JOIN_REQUEST_CREATED) không còn cần chú ý với
        // bất kỳ giáo viên nào của lớp; tự đánh dấu đã đọc sau commit.
        ackForAllClassTeachersAfterCommit(
                classId,
                NotificationType.CLASS_JOIN_REQUEST_CREATED,
                Map.<String, Object>of("classId", classId, "studentId", req.getStudentId()));
    }

    @Transactional
    public void rejectJoinRequest(Long teacherId, Long classId, Long requestId) {
        // PR B trợ giảng: từ chối HV cũng là quản-lý-lớp — chỉ GV phụ trách.
        assertPrimaryTeacher(teacherId, classId);

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

        // Notify the student. As in approveJoinRequest, the teacher is not told anything: they just
        // clicked reject.
        TeacherClass teacherClass = classRepository.findById(classId).orElse(null);
        User teacher = userRepository.findById(teacherId).orElse(null);
        userNotificationService.onJoinRequestRejected(
            req.getStudentId(),
            classId,
            teacherClass != null ? teacherClass.getName() : "",
            teacher != null ? teacher.getDisplayName() : ""
        );

        // Yêu cầu đã xử lý → tự đánh dấu đã đọc "Yêu cầu tham gia lớp" cho mọi giáo viên của lớp.
        ackForAllClassTeachersAfterCommit(
                classId,
                NotificationType.CLASS_JOIN_REQUEST_CREATED,
                Map.<String, Object>of("classId", classId, "studentId", req.getStudentId()));
    }

    /**
     * Xoá cứng một lớp — chỉ khi lớp thật sự trống.
     *
     * <p>Lệnh {@code deleteById} bên dưới trông như xoá một dòng, thực tế kéo theo ~9 bảng qua
     * {@code ON DELETE CASCADE} (điểm danh, nhật ký, lịch, tin nhắn, giáo án…). Vì vậy
     * {@link ClassDeletionGuard} chặn trước: còn dấu vết dạy học thì ném 409, không xoá gì cả.
     * Lớp trống vẫn xoá được, nhưng luôn để lại vết trong {@code audit_logs} kèm kiểm kê những
     * thứ đã biến mất — đây là thao tác không hoàn tác được, đọc log sáu tháng sau phải biết ai
     * xoá cái gì.
     *
     * <p><b>Giới hạn còn lại, nói thẳng:</b> đếm rồi mới xoá, nên dưới READ COMMITTED vẫn còn khe
     * đua cỡ mili-giây — một buổi học được tạo SAU lúc đếm và commit TRƯỚC lúc xoá thì vẫn bị
     * cascade cuốn theo. Không bịt bằng khoá vì phía ghi (tạo buổi, ghi nhật ký) không hề khoá
     * dòng lớp, nên {@code FOR UPDATE} ở đây chẳng chặn được ai. Lưu trữ mềm ở Đợt C xoá hẳn khe
     * này vì khi đó không còn lệnh xoá nào để mà đua.
     *
     * <p>Đây là hàng rào tạm cho tới khi có cơ chế lưu trữ ({@code archived_at}, Đợt C); khi có,
     * đường này nên chuyển hẳn sang archive.
     */
    @Transactional
    public void deleteClass(AuditActor actor, Long classId) {
        Long teacherId = actor.id();
        // Chỉ giáo viên chính được xóa lớp (trợ giảng không có quyền hủy cả lớp)
        assertPrimaryTeacher(teacherId, classId);

        ClassDeletionGuard.ClassContent content = classDeletionGuard.assertDeletable(classId);

        // Chụp trước khi xoá: sau delete không còn gì để mô tả lớp vừa biến mất.
        TeacherClass snapshot = classRepository.findById(classId).orElse(null);

        // Remove dependencies
        classTeacherRepository.deleteByIdClassId(classId);
        classStudentRepository.deleteByIdClassId(classId);
        assignmentRepository.deleteByClassId(classId);
        // class_materials là FK NO ACTION: phải gỡ liên kết bằng tay, nếu không DELETE lớp sẽ vỡ.
        // Chỉ bỏ liên kết — tài liệu vẫn nằm nguyên trong thư viện của giáo viên/trung tâm.
        materialService.detachAllFromClass(classId);

        // Remove class
        classRepository.deleteById(classId);

        Map<String, Object> meta = new LinkedHashMap<>(content.toAuditMetadata());
        meta.put("className", snapshot != null ? snapshot.getName() : null);
        meta.put("orgId", snapshot != null ? snapshot.getOrgId() : null);
        auditLogService.log("teacher_class_deleted", actor, "CLASS", String.valueOf(classId), meta);
    }

    // ─── Co-teaching: quản lý giáo viên trong lớp ────────────────────────────────

    /** Trả về ClassTeacher của caller nếu là PRIMARY; ném ForbiddenException nếu không. */
    /**
     * Guard PRIMARY-only dùng chung cho service khác (PR B trợ giảng) — ví dụ cấp/thu hồi
     * chứng nhận ({@code OrgCertificateService}). Trợ giảng (ASSISTANT) bị 403.
     */
    @Transactional(readOnly = true)
    public void assertPrimaryTeacherOfClass(Long teacherId, Long classId) {
        assertPrimaryTeacher(teacherId, classId);
    }

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

        // Case-insensitive: emails are stored canonical lowercase, but a teacher may type the
        // co-teacher's address with any case. findByEmailIgnoreCase mirrors the login lookup.
        String normalizedEmail = email == null ? "" : email.trim();
        if (normalizedEmail.isBlank()) {
            throw new BadRequestException("Email không được để trống");
        }
        User target = userRepository.findByEmailIgnoreCase(normalizedEmail)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy người dùng với email: " + normalizedEmail));
        if (target.getRole() != User.Role.TEACHER && target.getRole() != User.Role.ADMIN) {
            throw new BadRequestException("Người dùng này không có vai trò giáo viên");
        }
        // Org isolation: chỉ giáo viên trong cùng tổ chức mới được thêm vào lớp thuộc org đó
        TeacherClass teacherClass = classRepository.findById(classId)
                .orElseThrow(() -> new NotFoundException("Lớp không tồn tại"));
        if (teacherClass.getOrgId() != null && !teacherClass.getOrgId().equals(target.getOrgId())) {
            throw new BadRequestException("Giáo viên không thuộc tổ chức của lớp này.");
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
        // PR B trợ giảng: thêm HV là quản-lý-lớp — chỉ GV phụ trách.
        assertPrimaryTeacher(teacherId, classId);

        // Case-insensitive lookup — the teacher may type the student's email in any case.
        String normalizedEmail = email == null ? "" : email.trim();
        if (normalizedEmail.isBlank()) {
            throw new BadRequestException("Email không được để trống");
        }
        User user = userRepository.findByEmailIgnoreCase(normalizedEmail)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy người dùng với email: " + normalizedEmail));

        // Org isolation — cùng quy tắc đã áp cho co-teacher ở addTeacherToClassByEmail: lớp thuộc
        // một tổ chức thì chỉ nhận người của chính tổ chức đó.
        //
        // Thiếu chốt này thì roster trở thành biên tin cậy do chính giáo viên ghi được: họ thêm một
        // tài khoản bất kỳ (biết email) vào lớp mình, và mọi kiểm tra dựa trên roster — điểm danh,
        // đánh giá, chứng chỉ — đều coi người đó là hợp lệ.
        TeacherClass targetClass = classRepository.findById(classId)
                .orElseThrow(() -> new NotFoundException("Lớp không tồn tại"));
        if (targetClass.getOrgId() != null && !targetClass.getOrgId().equals(user.getOrgId())) {
            throw new BadRequestException("Học viên không thuộc tổ chức của lớp này.");
        }

        if (classStudentRepository.existsByIdClassIdAndIdStudentId(classId, user.getId())) {
            throw new ConflictException("Học viên đã tham gia lớp học này");
        }

        ClassStudent classStudent = ClassStudent.builder()
                .id(new ClassStudentId(classId, user.getId()))
                .build();
        classStudentRepository.save(classStudent);

        // Backfill the assignments handed out before this student was added (idempotent) — see
        // approveJoinRequest for the same guard on the self-join path.
        assignmentBackfillService.ensureAssignmentsForStudent(classId, user.getId());

        // Notify student
        TeacherClass teacherClass = targetClass;
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
        return readRoster(classId);
    }

    /** M-17 (G-3): roster cho org-admin — verify lớp thuộc org caller; lớp org khác → NotFound. */
    public List<ClassStudentDto> getClassStudentsForOrg(Long orgId, Long classId) {
        assertClassInOrg(orgId, classId);
        return readRoster(classId);
    }

    /** Cross-org trả NotFound (không phải Forbidden) để không lộ lớp của tenant khác tồn tại. */
    private void assertClassInOrg(Long orgId, Long classId) {
        TeacherClass tc = classRepository.findById(classId)
                .orElseThrow(() -> new NotFoundException("Lớp học không tồn tại"));
        if (!orgId.equals(tc.getOrgId())) {
            throw new NotFoundException("Lớp học không tồn tại");
        }
    }

    private List<ClassStudentDto> readRoster(Long classId) {
        List<ClassStudent> students = classStudentRepository.findByIdClassId(classId);
        List<Long> studentIds = students.stream().map(s -> s.getId().getStudentId()).toList();

        if (studentIds.isEmpty()) return List.of();

        List<User> users = userRepository.findAllById(studentIds);
        List<UserLearningProfile> profiles = profileRepository.findByUserIdIn(studentIds);
        Map<Long, UserLearningProfile> profileMap = profiles.stream()
                .collect(Collectors.toMap(p -> p.getUser().getId(), p -> p));
        Map<Long, ClassStudent> evalMap = students.stream()
                .collect(Collectors.toMap(s -> s.getId().getStudentId(), s -> s, (a, b) -> a));

        // S-10: one batched XP query for the whole class instead of getSummary() (4 queries) per student.
        Map<Long, Integer> xpByUser = xpService.totalXpByUserId(studentIds);

        return users.stream().map(user -> {
            UserLearningProfile profile = profileMap.get(user.getId());
            int totalXp = xpByUser.getOrDefault(user.getId(), 0);
            ClassStudent cs = evalMap.get(user.getId());
            // Current level (real ability, default A0) is the roster's CEFR; target is context only.
            String currentLevel = profile != null && profile.getCurrentLevel() != null
                    ? profile.getCurrentLevel().name() : "A0";
            String levelSource = profile != null && profile.getLevelSource() != null
                    ? profile.getLevelSource() : "SELF";
            String targetLevel = profile != null && profile.getTargetLevel() != null
                    ? profile.getTargetLevel().name() : null;
            return new ClassStudentDto(
                    user.getId(),
                    user.getDisplayName(),
                    user.getEmail(),
                    totalXp,
                    XpService.computeLevel(totalXp), // Using streakDays field for level in DTO for now
                    currentLevel,
                    levelSource,
                    targetLevel,
                    cs != null ? cs.getSkillHoren() : null,
                    cs != null ? cs.getSkillLesen() : null,
                    cs != null ? cs.getSkillSchreiben() : null,
                    cs != null ? cs.getSkillSprechen() : null,
                    cs != null ? cs.getEvaluatedAt() : null
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
            return new ClassAnalyticsOverviewDto(0L, 0L, 0L, null, null, null, List.of(), List.of());
        }

        // S-10: one batched SUM for the whole class instead of getSummary() (4 queries) per student.
        long totalXp = xpService.totalXpForUsers(studentIds);

        // S-10: class-wide top error codes in ONE aggregated query instead of a per-student top-20 fetch
        // (previously N queries → groupBy in memory). Now counts all error codes across the class.
        List<ClassErrorAnalyticsDto> topErrors = grammarErrorRepository
                .aggregateErrorCodesForUsers(studentIds, PageRequest.of(0, 10))
                .stream()
                .map(row -> new ClassErrorAnalyticsDto((String) row[0], ((Number) row[1]).longValue()))
                .collect(Collectors.toList());

        // completedAssignments: REAL count of this class's submissions that carry a confirmed grade.
        // It used to be hardcoded 0, which contradicted the Gradebook on the same screen (badge "N bài
        // chờ chấm" next to "hoàn thành 0 bài"). Same source as the gradebook, so the two now agree.
        List<Long> classAssignmentIds = assignmentRepository.findByClassIdOrderByCreatedAtDesc(classId).stream()
                .map(ClassAssignment::getId)
                .toList();
        long completedAssignments = classAssignmentIds.isEmpty() ? 0L
                : studentAssignmentRepository.findByAssignmentIds(classAssignmentIds).stream()
                        .filter(sa -> AssignmentStatus.isFinal(sa.getStatus()))
                        .count();

        // The speaking / review-coverage cards have no honest class-scoped source (AiSpeakingSession is
        // not tied to a class, and there is no review-coverage aggregate). Returning 0 read as "the class
        // did nothing"; null lets the UI hide the card instead of showing a fabricated zero.
        Long activeSpeakingSessions = null;
        Double avgSpeakingScore = null;
        Double reviewCoveragePct = null;

        // actionItems are a static tip, not analysis — keep them but stop dressing them as computed
        // insight, and drop the v1 href (/teacher/classes/{id}) that the v2 UI never used anyway.
        List<ClassAnalyticsOverviewDto.ActionItemDto> actionItems = topErrors.isEmpty()
                ? List.of(new ClassAnalyticsOverviewDto.ActionItemDto(
                    "Theo dõi tiến độ",
                    "Chưa có lỗi nổi bật, tiếp tục quan sát nhịp học của lớp.",
                    "LOW",
                    null))
                : List.of(
                    new ClassAnalyticsOverviewDto.ActionItemDto(
                        "Ôn lỗi lặp lại nhiều nhất",
                        "Chọn 3 lỗi xuất hiện nhiều nhất và giao luyện tập ngắn cho lớp.",
                        "HIGH",
                        null)
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
        PracticeScenario generated = speakingAiHelpersService.generateScenario(
                studentId, ca.getTopic(), scenarioLevelFor(ca.getLessonId()));
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

    /** CEFR default for the whole "generate a speaking scenario" family. */
    private static final String DEFAULT_SCENARIO_LEVEL = "A2";

    /**
     * The CEFR level to generate a speaking scenario at. Uses the linked lesson's CEFR when the
     * assignment is tied to one, so a B1/B2 class no longer gets a hardcoded A2 scenario; falls back to
     * {@value #DEFAULT_SCENARIO_LEVEL} when the assignment has no lesson or the lesson has no level set.
     */
    private String scenarioLevelFor(Long lessonId) {
        if (lessonId == null) return DEFAULT_SCENARIO_LEVEL;
        return lessonRepository.findById(lessonId)
                .map(ClassLesson::getCefrLevel)
                .filter(l -> l != null && !l.isBlank())
                .orElse(DEFAULT_SCENARIO_LEVEL);
    }

    @Transactional
    public ClassAssignmentDto createAssignment(Long teacherId, Long classId, CreateAssignmentRequest req) {
        // PR B trợ giảng: tạo & giao bài là quản-lý-lớp — chỉ GV phụ trách (trợ giảng vẫn CHẤM bài).
        assertPrimaryTeacher(teacherId, classId);
        // If linking to a lesson (Phase 1d-D1), it must belong to this class (reject cross-class).
        if (req.lessonId() != null) {
            ClassLesson lesson = lessonRepository.findById(req.lessonId())
                    .orElseThrow(() -> new NotFoundException("Bài học không tồn tại"));
            if (!lesson.getClassId().equals(classId)) {
                throw new ForbiddenException("Bài học không thuộc lớp này");
            }
        }

        // PR-8: trạng thái + neo buổi/nội dung + người nhận — validate TRƯỚC khi ghi gì.
        String status = req.status() == null || req.status().isBlank()
                ? "PUBLISHED" : req.status().toUpperCase();
        if (!"DRAFT".equals(status) && !"PUBLISHED".equals(status)) {
            throw new BadRequestException("Trạng thái bài tập không hợp lệ (DRAFT | PUBLISHED)");
        }
        validateAssignmentAnchors(classId, req.sessionId(), req.lektionId(), req.curriculumItemId());
        List<Long> recipients = validateRecipients(classId, req.recipientStudentIds());

        ClassAssignment assignment = ClassAssignment.builder()
                .classId(classId)
                .lessonId(req.lessonId())
                .topic(req.topic())
                .description(req.description())
                .assignmentType(req.assignmentType())
                .skill(normalizeSkill(req.skill()))
                .referenceId(req.referenceId())
                .dueDate(req.dueDate())
                .attachmentUrl(req.attachmentUrl())
                .status(status)
                .publishedAt("PUBLISHED".equals(status) ? java.time.LocalDateTime.now() : null)
                .sessionId(req.sessionId())
                .lektionId(req.lektionId())
                .curriculumItemId(req.curriculumItemId())
                .build();
        ClassAssignment savedAssignment = assignmentRepository.save(assignment);
        saveRecipients(savedAssignment.getId(), recipients);

        // Khởi tạo kịch bản AI nếu là SPEAKING_SCENARIO
        if ("SPEAKING_SCENARIO".equals(req.assignmentType())) {
            try {
                PracticeScenario scenario = speakingAiHelpersService.generateScenario(
                        teacherId, req.topic(), scenarioLevelFor(savedAssignment.getLessonId()));
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

        // P06: bài NHÁP chưa tới tay ai — không StudentAssignment; publish mới fan-out (AC14 theo
        // đúng người nhận, không recipients = cả lớp).
        if ("PUBLISHED".equals(status)) {
            fanOutStudentAssignments(savedAssignment.getId(), classId, recipients);
        }

        User teacher = userRepository.findById(teacherId).orElse(null);

        // Attach any library materials the teacher picked (in pick order). attachToAssignment re-checks
        // that the teacher can access each material AND owns the assignment's class, so a bad/inaccessible
        // id rolls back the whole create (fail fast — the teacher only ever sends ids from their own list).
        if (req.materialIds() != null && !req.materialIds().isEmpty() && teacher != null) {
            for (Long materialId : req.materialIds()) {
                if (materialId != null) {
                    materialService.attachToAssignment(teacher, materialId, savedAssignment.getId());
                }
            }
        }

        // P06/AC14: chỉ bài CÔNG BỐ mới réo học viên — và chỉ réo đúng người nhận.
        if ("PUBLISHED".equals(status)) {
            notifyAssignmentAudience(savedAssignment, teacher, recipients);
        }

        return toAssignmentDto(savedAssignment);
    }

    /**
     * P06: công bố một bài NHÁP — fan-out StudentAssignment theo đúng người nhận (AC14) +
     * notification; từ đây bài xuất hiện với học viên và luật sửa/xoá của bài đã công bố áp dụng.
     */
    @Transactional
    public ClassAssignmentDto publishAssignment(Long teacherId, Long classId, Long assignmentId) {
        assertPrimaryTeacher(teacherId, classId);
        ClassAssignment assignment = assignmentRepository.findById(assignmentId)
                .orElseThrow(() -> new NotFoundException("Bài tập không tồn tại"));
        if (!assignment.getClassId().equals(classId)) {
            throw new ForbiddenException("Bài tập không thuộc lớp này");
        }
        if ("PUBLISHED".equals(assignment.getStatus())) {
            throw new ConflictException("Bài đã được công bố trước đó");
        }
        assignment.setStatus("PUBLISHED");
        assignment.setPublishedAt(java.time.LocalDateTime.now());
        ClassAssignment saved = assignmentRepository.save(assignment);

        List<Long> recipients = assignmentRecipientRepository.findByIdAssignmentId(assignmentId).stream()
                .map(r -> r.getId().getStudentId())
                .toList();
        fanOutStudentAssignments(assignmentId, classId, recipients);
        notifyAssignmentAudience(saved, userRepository.findById(teacherId).orElse(null), recipients);
        return toAssignmentDto(saved);
    }

    /** Fan-out StudentAssignment PENDING cho đúng đối tượng (rỗng = cả lớp) — idempotent theo khoá. */
    private void fanOutStudentAssignments(Long assignmentId, Long classId, List<Long> recipients) {
        List<Long> targets = recipients.isEmpty()
                ? classStudentRepository.findByIdClassId(classId).stream()
                        .map(cs -> cs.getId().getStudentId())
                        .toList()
                : recipients;
        List<StudentAssignment> rows = targets.stream().map(studentId ->
                StudentAssignment.builder()
                        .assignmentId(assignmentId)
                        .studentId(studentId)
                        .status("PENDING")
                        .build())
                .toList();
        studentAssignmentRepository.saveAll(rows);
    }

    private void notifyAssignmentAudience(ClassAssignment assignment, User teacher, List<Long> recipients) {
        TeacherClass teacherClass = classRepository.findById(assignment.getClassId()).orElse(null);
        String className = teacherClass != null ? teacherClass.getName() : "";
        String teacherName = teacher != null ? teacher.getDisplayName() : "";
        if (recipients.isEmpty()) {
            userNotificationService.onNewClassAssignment(assignment.getClassId(), className, teacherName,
                    assignment.getId(), assignment.getTopic());
        } else {
            userNotificationService.onNewClassAssignmentFor(recipients, assignment.getClassId(), className,
                    teacherName, assignment.getId(), assignment.getTopic());
        }
    }

    /** PR-8: buổi phải thuộc lớp; Lektion thuộc phiên bản giáo trình ĐÃ GÁN cho lớp; mục thuộc Lektion. */
    private void validateAssignmentAnchors(Long classId, Long sessionId, Long lektionId, Long curriculumItemId) {
        if (sessionId != null) {
            var session = classSessionRepositoryPr8.findById(sessionId)
                    .orElseThrow(() -> new NotFoundException("Buổi học không tồn tại"));
            if (!session.getClassId().equals(classId)) {
                throw new ForbiddenException("Buổi học không thuộc lớp này");
            }
        }
        if (curriculumItemId != null && lektionId == null) {
            throw new BadRequestException("Mục giáo trình phải đi kèm Lektion của nó");
        }
        if (lektionId != null) {
            Long versionId = classCurriculumLinkRepositoryPr8.findByClassId(classId)
                    .map(l -> l.getVersionId())
                    .orElseThrow(() -> new BadRequestException("Lớp chưa gắn giáo trình — không neo bài vào Lektion được"));
            var lektion = curriculumLektionRepositoryPr8.findById(lektionId)
                    .orElseThrow(() -> new NotFoundException("Lektion không tồn tại"));
            if (!lektion.getVersionId().equals(versionId)) {
                throw new ForbiddenException("Lektion không thuộc giáo trình đã gán cho lớp");
            }
            if (curriculumItemId != null) {
                var item = curriculumItemRepositoryPr8.findById(curriculumItemId)
                        .orElseThrow(() -> new NotFoundException("Mục giáo trình không tồn tại"));
                if (!item.getLektionId().equals(lektionId)) {
                    throw new BadRequestException("Mục không thuộc Lektion đã chọn");
                }
            }
        }
    }

    /** AC14: danh sách người nhận (nếu gửi) phải nằm trọn trong roster lớp; trả list đã chuẩn hoá. */
    private List<Long> validateRecipients(Long classId, List<Long> recipientStudentIds) {
        if (recipientStudentIds == null || recipientStudentIds.isEmpty()) return List.of();
        Set<Long> roster = classStudentRepository.findByIdClassId(classId).stream()
                .map(cs -> cs.getId().getStudentId())
                .collect(Collectors.toSet());
        List<Long> cleaned = recipientStudentIds.stream().filter(java.util.Objects::nonNull).distinct().toList();
        for (Long id : cleaned) {
            if (!roster.contains(id)) {
                throw new BadRequestException("Học viên #" + id + " không thuộc lớp này");
            }
        }
        return cleaned;
    }

    private void saveRecipients(Long assignmentId, List<Long> recipients) {
        if (recipients.isEmpty()) return;
        assignmentRecipientRepository.saveAll(recipients.stream()
                .map(studentId -> com.deutschflow.teacher.entity.ClassAssignmentRecipient.builder()
                        .id(new com.deutschflow.teacher.entity.ClassAssignmentRecipient.Id(assignmentId, studentId))
                        .build())
                .toList());
    }

    /**
     * Bộ kỹ năng hợp lệ của một bài tập lớp. Cố ý viết {@code HOREN} KHÔNG có E: đây là quy ước của
     * cột {@code class_assignments.skill} — khác {@code can_do_statements.skill_tag} vốn dùng
     * {@code HOEREN} (xem {@code StudentCompetencyService#toCanDoSkillTag}). Bảng điểm 4 kỹ năng ở cả
     * hai phía tra đúng chuỗi này, nên ghi sai một chữ là điểm rơi thẳng vào ô "không kỹ năng".
     */
    private static final Set<String> ASSIGNMENT_SKILLS =
            Set.of("GENERAL", "HOREN", "LESEN", "SCHREIBEN", "SPRECHEN");

    /**
     * Chuẩn hoá kỹ năng do client gửi lên; rác thì từ chối thay vì ghi vào DB.
     *
     * <p>Trước đây giá trị được {@code toUpperCase()} rồi ghi thẳng, không kiểm gì — mà cột này là
     * đầu vào của bảng điểm 4 kỹ năng và của bộ lọc sổ điểm, nên một chuỗi lạ sẽ âm thầm tạo ra một
     * "kỹ năng" mà không màn hình nào biết cách hiển thị.
     */
    private static String normalizeSkill(String raw) {
        if (raw == null || raw.isBlank()) return "GENERAL";
        String v = raw.trim().toUpperCase();
        // Nhận cả cách viết có E của can-do statement để client nào lỡ gửi HOEREN vẫn về đúng ô Nghe.
        if ("HOEREN".equals(v)) v = "HOREN";
        if (!ASSIGNMENT_SKILLS.contains(v)) {
            throw new BadRequestException("Kỹ năng không hợp lệ: " + raw);
        }
        return v;
    }

    /**
     * Sửa một bài tập đã giao. Chỉ giáo viên chính, và bài phải thuộc đúng lớp trong đường dẫn.
     *
     * <p>Cho sửa kể cả khi đã có người nộp: đề bài gõ nhầm, hạn đặt sai hay gắn nhầm bài học là
     * chuyện thường, và trước đây KHÔNG có đường nào sửa — không PATCH, không DELETE — nên một bài
     * giao nhầm nằm lại vĩnh viễn trên màn hình của cả lớp. Điểm và bài nộp không bị đụng tới.
     *
     * <p>Không bắn thông báo: đây là sửa chính tả/metadata, còn mọi học viên trong lớp đều đã nhận
     * "📋 Bài tập mới" lúc giao. Nếu sau này {@code dueDate} thực sự được dùng (nhắc hạn, chặn nộp
     * muộn) thì lúc đó đổi hạn mới đáng một thông báo riêng.
     */
    @Transactional
    public ClassAssignmentDto updateAssignment(Long teacherId, Long classId, Long assignmentId,
                                               UpdateAssignmentRequest req) {
        assertPrimaryTeacher(teacherId, classId);
        ClassAssignment assignment = assignmentRepository.findById(assignmentId)
                .orElseThrow(() -> new NotFoundException("Bài tập không tồn tại"));
        if (!assignment.getClassId().equals(classId)) {
            throw new ForbiddenException("Bài tập không thuộc lớp này");
        }

        if (req.topic() != null) {
            String topic = req.topic().trim();
            if (topic.isEmpty()) {
                throw new BadRequestException("Tiêu đề bài tập không được để trống");
            }
            assignment.setTopic(topic);
        }
        if (req.description() != null) assignment.setDescription(req.description().trim());
        if (req.skill() != null) assignment.setSkill(normalizeSkill(req.skill()));

        if (Boolean.TRUE.equals(req.clearDueDate())) assignment.setDueDate(null);
        else if (req.dueDate() != null) assignment.setDueDate(req.dueDate());

        if (Boolean.TRUE.equals(req.clearAttachmentUrl())) assignment.setAttachmentUrl(null);
        else if (req.attachmentUrl() != null) assignment.setAttachmentUrl(req.attachmentUrl().trim());

        if (Boolean.TRUE.equals(req.clearLessonId())) {
            assignment.setLessonId(null);
        } else if (req.lessonId() != null) {
            // Cùng chốt như lúc tạo: bài học phải thuộc chính lớp này (chặn gắn chéo lớp).
            ClassLesson lesson = lessonRepository.findById(req.lessonId())
                    .orElseThrow(() -> new NotFoundException("Bài học không tồn tại"));
            if (!lesson.getClassId().equals(classId)) {
                throw new ForbiddenException("Bài học không thuộc lớp này");
            }
            assignment.setLessonId(req.lessonId());
        }

        return toAssignmentDto(assignmentRepository.save(assignment));
    }

    /**
     * Xoá một bài tập đã giao — CHỈ khi chưa học viên nào nộp.
     *
     * <p>Ranh giới này lấy đúng từ {@link ClassDeletionGuard}: bài tập chưa ai nộp là cấu hình do
     * chính giáo viên chính tạo và dựng lại được, còn một bài nộp là công của người khác. Ba bảng con
     * ({@code student_assignments}, {@code class_assignment_scenarios}, tài liệu đính kèm) đều
     * {@code ON DELETE CASCADE}, nên xoá một bài đã có người nộp sẽ kéo theo bài làm, điểm và nhận
     * xét — âm thầm và không hoàn tác được. Đã có người nộp thì sửa đề (updateAssignment) hoặc để
     * nguyên, đừng xoá.
     */
    @Transactional
    public void deleteAssignment(Long teacherId, Long classId, Long assignmentId) {
        assertPrimaryTeacher(teacherId, classId);
        ClassAssignment assignment = assignmentRepository.findById(assignmentId)
                .orElseThrow(() -> new NotFoundException("Bài tập không tồn tại"));
        if (!assignment.getClassId().equals(classId)) {
            throw new ForbiddenException("Bài tập không thuộc lớp này");
        }

        long submitted = studentAssignmentRepository.findByAssignmentId(assignmentId).stream()
                .filter(sa -> AssignmentStatus.isSubmitted(sa.getStatus()))
                .count();
        if (submitted > 0) {
            throw new ConflictException(
                    "Đã có " + submitted + " học viên nộp bài này — xoá sẽ mất bài nộp và điểm. "
                    + "Hãy sửa lại đề bài thay vì xoá.");
        }

        // Chỉ còn các dòng PENDING (bài chưa ai đụng tới) — cascade dọn nốt chúng cùng kịch bản AI
        // và liên kết tài liệu.
        assignmentRepository.delete(assignment);
        log.info("[assignments] teacher={} deleted assignment={} of class={} (no submissions)",
                teacherId, assignmentId, classId);
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

    /**
     * Tell every teacher of the class that a student has handed work in.
     *
     * <p>Nobody used to be told. The submit endpoint called {@code insertForUser(user, ...)} where
     * {@code user} was the {@code @AuthenticationPrincipal} — i.e. the STUDENT — so the student received
     * a notification written for a teacher ("📥 Bài cần xem — Có bài cần xem từ [their own name]") and the
     * teacher received nothing at all. A teacher had to keep opening the grading screen to find out that
     * work had arrived.
     *
     * <p>Best-effort: a notification failure must never fail the student's submission.
     */
    @Transactional
    public void notifyTeachersOfSubmission(Long classAssignmentId, Long studentId, String studentName) {
        try {
            ClassAssignment ca = assignmentRepository.findById(classAssignmentId).orElse(null);
            if (ca == null) return;

            TeacherClass cls = classRepository.findById(ca.getClassId()).orElse(null);
            // The real class name — this used to be populated with ca.getTopic(), i.e. the title of the
            // assignment, so the notification named the homework where it claimed to name the class.
            String className = cls != null ? cls.getName() : "";

            for (ClassTeacher ct : classTeacherRepository.findByIdClassId(ca.getClassId())) {
                userNotificationService.onTeacherGradingEvent(
                        ct.getId().getTeacherId(),
                        ca.getClassId(),
                        className,
                        ca.getId(),
                        studentId,
                        studentName,
                        "SUBMISSION_RECEIVED",
                        null);
            }
        } catch (Exception e) {
            log.warn("[notifications] Could not notify teachers of submission for assignment {}: {}",
                    classAssignmentId, e.toString());
        }
    }

    /**
     * The classes this teacher and this student actually share. Empty means the teacher has no business
     * reading anything about the student.
     *
     * <p>This is deliberately a LIST, not a boolean. The old code only asked "do we share <em>any</em>
     * class?" and then read the student's records by {@code studentId} alone — so a teacher who shared
     * one class with a student also read that student's work from every <em>other</em> class, including
     * classes run by other teachers at other centres (a student enrolled at two schools is common).
     * Callers must scope their query to these class ids, not just gate on them.
     */
    private List<Long> sharedClassIds(Long teacherId, Long studentId) {
        return classTeacherRepository.findByIdTeacherId(teacherId).stream()
                .map(ct -> ct.getId().getClassId())
                .filter(classId -> classStudentRepository.existsByIdClassIdAndIdStudentId(classId, studentId))
                .collect(Collectors.toList());
    }

    /** Ids of every assignment issued in the classes this teacher shares with this student. */
    private List<Long> sharedAssignmentIds(Long teacherId, Long studentId) {
        List<Long> classIds = sharedClassIds(teacherId, studentId);
        if (classIds.isEmpty()) {
            throw new ConflictException("Học viên không thuộc lớp của bạn");
        }
        return assignmentRepository.findByClassIdIn(classIds).stream()
                .map(ClassAssignment::getId)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<StudentAssignmentDto> getStudentAssignments(Long teacherId, Long studentId) {
        List<Long> assignmentIds = sharedAssignmentIds(teacherId, studentId);
        if (assignmentIds.isEmpty()) return List.of();

        // Scoped by assignment, not by student: the DTO carries score, feedback and the submission
        // itself, none of which another centre's teacher may see.
        return studentAssignmentRepository
                .findByStudentIdAndAssignmentIdInAndDeletedFalseOrderByCreatedAtDesc(studentId, assignmentIds)
                .stream()
                .map(this::toStudentAssignmentDto)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<TeacherSpeakingSessionDto> getStudentSpeakingSessions(Long teacherId, Long studentId) {
        Set<Long> assignmentIds = new HashSet<>(sharedAssignmentIds(teacherId, studentId));

        // AiSpeakingSession has no classId, so scope by the assignment it was created from. Free-practice
        // sessions (assignmentId == null) are the student's own work and stay visible to their teacher;
        // a session tied to ANOTHER class's assignment is not — it carries that teacher's score and
        // feedback.
        return speakingSessionRepository.findByUserIdOrderByStartedAtDesc(studentId)
                .stream()
                .filter(s -> s.getAssignmentId() == null || assignmentIds.contains(s.getAssignmentId()))
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

        // F-QA-01: reviewedAt được đặt ở mọi lần giáo viên lưu đánh giá — còn null nghĩa là lần
        // chấm ĐẦU TIÊN; đã có giá trị nghĩa là chấm lại (sửa điểm/nhận xét).
        boolean regrade = session.getReviewedAt() != null;

        session.setTeacherScore(req.teacherScore());
        session.setTeacherFeedback(req.teacherFeedback());
        session.setReviewedAt(java.time.LocalDateTime.now());
        TeacherSpeakingSessionDto result = toTeacherSpeakingSessionDto(speakingSessionRepository.save(session));

        // Notify the student that their speaking session has been graded.
        //
        // The teacher is deliberately NOT notified. This used to fire onTeacherGradingEvent at the
        // teacher who had just done the grading — rendered as "📥 Bài cần xem — Có bài cần xem từ X",
        // i.e. the teacher was told there was work to review about the very session they had just
        // finished reviewing. It was, in fact, the only place that helper was ever called: teachers got
        // no notification when work actually arrived, and one bogus one after they finished.
        //
        // F-QA-01: chấm LẠI không phát thêm "✅ Bài đã chấm" — cập nhật tại chỗ thông báo cũ thành
        // "🔄 Điểm đã được cập nhật" (một dòng duy nhất, điểm mới nhất).
        if (regrade) {
            userNotificationService.onAssignmentRegraded(
                session.getUserId(), "SPEAKING", sessionId, req.teacherScore(), req.teacherFeedback()
            );
        } else {
            userNotificationService.onAssignmentGraded(
                session.getUserId(), "SPEAKING", sessionId, req.teacherScore(), req.teacherFeedback()
            );
        }

        return result;
    }

    @Transactional
    public StudentAssignmentDto evaluateAssignment(Long teacherId, Long assignmentId, TeacherSessionEvaluationRequest req) {
        StudentAssignment assignment = studentAssignmentRepository.findById(assignmentId)
                .orElseThrow(() -> new NotFoundException("Bài tập không tồn tại"));

        // Authorize on the assignment's OWNING class, not merely on sharing the student (IDOR): only a
        // teacher of the class that owns this assignment may finalize its grade.
        ClassAssignment classAssignment = assignmentRepository.findById(assignment.getAssignmentId()).orElse(null);
        boolean hasAccess = classAssignment != null
                && classTeacherRepository.existsByIdClassIdAndIdTeacherId(classAssignment.getClassId(), teacherId);

        if (!hasAccess) {
            throw new ConflictException("Bài tập không thuộc lớp của bạn");
        }

        // F12: only handed-in work can be finalized. A PENDING row exists BEFORE the student ever
        // submits (rows are pre-created/backfilled), so without this guard one valid call turned
        // "not submitted" into EVALUATED — and notified the student of a grade for work they never
        // handed in. Re-grading a final row stays allowed: it is the only correction path until a
        // grade-revision history exists.
        if (AssignmentStatus.PENDING.equals(assignment.getStatus())) {
            throw new ConflictException("Bài chưa được nộp, không thể chốt điểm");
        }

        // Scores are graded on a 0-100 scale; reject out-of-range manual entry so it can't pollute
        // the class/teacher report averages (root cause of the "234.4 average" report bug). A null
        // score is rejected too (F12): EVALUATED is the announce-the-final-grade transition, and a
        // final grade with no grade both notifies the student of nothing and reads as "not graded"
        // in every average. Feedback-without-a-grade would be its own state, not a null EVALUATED.
        if (req.teacherScore() == null) {
            throw new BadRequestException("Thiếu điểm khi chốt bài (0–100)");
        }
        if (req.teacherScore() < 0 || req.teacherScore() > 100) {
            throw new BadRequestException("Điểm phải trong khoảng 0–100");
        }

        // F-QA-01: xác định chấm-lại TRƯỚC khi ghi đè trạng thái — bài đã final (EVALUATED, hoặc
        // GRADED legacy) tức là học viên ĐÃ được announce điểm một lần rồi.
        boolean regrade = AssignmentStatus.isFinal(assignment.getStatus());

        assignment.setScore(req.teacherScore());
        assignment.setFeedback(req.teacherFeedback());
        assignment.setStatus("EVALUATED");
        assignment.setGradedAt(java.time.LocalDateTime.now());
        StudentAssignmentDto result = toStudentAssignmentDto(studentAssignmentRepository.save(assignment));

        // Notify student. F-QA-01: chấm LẠI không phát thêm "✅ Bài đã chấm" lần nữa —
        // AssignmentStatus hứa announce đúng MỘT lần; đường regrade cập nhật tại chỗ thông báo cũ
        // thành "🔄 Điểm đã được cập nhật" mang điểm mới nhất (không lộ lịch sử dao động điểm).
        if (regrade) {
            userNotificationService.onAssignmentRegraded(
                assignment.getStudentId(), "ASSIGNMENT", assignment.getAssignmentId(),
                req.teacherScore(), req.teacherFeedback()
            );
        } else {
            userNotificationService.onAssignmentGraded(
                assignment.getStudentId(), "ASSIGNMENT", assignment.getAssignmentId(),
                req.teacherScore(), req.teacherFeedback()
            );
        }

        // Tự đánh dấu ĐÃ ĐỌC "📥 Bài cần xem" (QUIZ_SUBMISSION_RECEIVED) cho MỌI giáo viên của lớp: bài
        // vừa chấm nên không còn "cần xem" với ai trong nhóm co-teaching, kể cả người vào Trung tâm Chấm
        // bài qua sidebar mà không bao giờ bấm chuông. Sau commit, best-effort — không ảnh hưởng điểm.
        ackForAllClassTeachersAfterCommit(
                classAssignment.getClassId(),
                NotificationType.QUIZ_SUBMISSION_RECEIVED,
                Map.<String, Object>of(
                        "assignmentId", assignment.getAssignmentId(),
                        "studentId", assignment.getStudentId()));

        // Auto-update the competency ledger from the grade (Phase 2b) — fire only AFTER this grade tx
        // commits, so a failed commit (e.g. the @Version optimistic-lock conflict this guards against)
        // never leaves an orphan GRADING competency row. Best-effort: a ledger error never affects the grade.
        final Long gradedStudentId = assignment.getStudentId();
        final Long gradedAssignmentId = assignment.getAssignmentId();
        final Integer gradedScore = req.teacherScore();
        if (org.springframework.transaction.support.TransactionSynchronizationManager.isSynchronizationActive()) {
            org.springframework.transaction.support.TransactionSynchronizationManager.registerSynchronization(
                    new org.springframework.transaction.support.TransactionSynchronization() {
                        @Override
                        public void afterCommit() {
                            applyCompetencyBestEffort(gradedStudentId, gradedAssignmentId, gradedScore);
                        }
                    });
        } else {
            applyCompetencyBestEffort(gradedStudentId, gradedAssignmentId, gradedScore);
        }

        return result;
    }

    /**
     * Sau khi tx nghiệp vụ commit, đánh dấu ĐÃ ĐỌC một loại thông báo cho MỌI giáo viên của lớp. Dùng khi
     * hành động của bất kỳ giáo viên nào trong lớp "tiêu thụ" thông báo đó cho cả nhóm co-teaching (chấm
     * bài, duyệt/từ chối yêu cầu vào lớp). Best-effort — chạy off tx nghiệp vụ, lỗi không ảnh hưởng hành động.
     */
    private void ackForAllClassTeachersAfterCommit(Long classId, NotificationType type, Map<String, Object> match) {
        runAfterCommitService.run(() -> {
            for (ClassTeacher ct : classTeacherRepository.findByIdClassId(classId)) {
                notificationAutoAckService.ackByContext(ct.getId().getTeacherId(), Set.of(type), match);
            }
        });
    }

    /** Best-effort competency-ledger update from a grade (Phase 2b): a ledger error never affects the grade. */
    private void applyCompetencyBestEffort(Long studentId, Long assignmentId, Integer score) {
        try {
            studentCompetencyService.applyGradingResult(studentId, assignmentId, score);
        } catch (Exception e) {
            log.warn("[Competency] applyGradingResult failed for assignment {}: {}", assignmentId, e.toString());
        }
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
        // Chỉ dùng cho lớp VỪA TẠO (createClass) — chưa thể có bài nộp nên pendingReviewCount = 0.
        return new TeacherClassDto(c.getId(), c.getName(), c.getInviteCode(), studentCount, quizCount, 0L, c.getCreatedAt());
    }

    private ClassAssignmentDto toAssignmentDto(ClassAssignment a) {
        int recipientCount = assignmentRecipientRepository.findByIdAssignmentId(a.getId()).size();
        return new ClassAssignmentDto(a.getId(), a.getClassId(), a.getTopic(), a.getDescription(),
                a.getAssignmentType(), a.getSkill(), a.getReferenceId(), a.getDueDate(), a.getCreatedAt(),
                a.getAttachmentUrl(), a.getLessonId(),
                a.getStatus(), a.getPublishedAt(), a.getSessionId(), a.getLektionId(),
                a.getCurriculumItemId(), recipientCount);
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
                submissionFileUrlResolver.resolve(a.getSubmissionFileUrl()),
                ca != null ? ca.getAttachmentUrl() : null,
                ca != null ? ca.getReferenceId() : null
        );
    }
}
