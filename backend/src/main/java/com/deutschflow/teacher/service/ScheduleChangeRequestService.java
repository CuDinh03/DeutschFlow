package com.deutschflow.teacher.service;

import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.common.exception.ConflictException;
import com.deutschflow.common.exception.ForbiddenException;
import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.notification.entity.NotificationOutbox;
import com.deutschflow.notification.repository.NotificationOutboxRepository;
import com.deutschflow.organization.service.OrgGuard;
import com.deutschflow.teacher.dto.CreateSessionRequest;
import com.deutschflow.teacher.dto.ScheduleChangePayloads;
import com.deutschflow.teacher.dto.ScheduleChangeRequestDto;
import com.deutschflow.teacher.dto.UpsertPatternRequest;
import com.deutschflow.teacher.entity.ClassSchedulePattern;
import com.deutschflow.teacher.entity.ClassScheduleChangeRequest;
import com.deutschflow.teacher.entity.ClassSession;
import com.deutschflow.teacher.entity.TeacherClass;
import com.deutschflow.teacher.repository.ClassSchedulePatternRepository;
import com.deutschflow.teacher.repository.ClassScheduleChangeRequestRepository;
import com.deutschflow.teacher.repository.ClassSessionRepository;
import com.deutschflow.teacher.repository.ClassTeacherRepository;
import com.deutschflow.teacher.repository.TeacherClassRepository;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Chiều DUYỆT của luồng đề xuất thay đổi lịch (PR-5, AC03/AC04/AC10/AC18–AC23).
 *
 * <p>Nguyên tử (AC10): chuyển trạng thái bằng UPDATE {@code WHERE status='PENDING'} — hai người
 * duyệt cùng lúc thì một người thắng; so {@code base_version} với {@code schedule_version} của lớp
 * bằng compare-and-bump trong CÙNG giao dịch áp lịch — lệch là duyệt trên nền lỗi thời, toàn bộ
 * rollback (đề xuất trở về PENDING nguyên vẹn). Thông báo học viên KHÔNG bắn trực tiếp: ghi
 * {@code notification_outbox} trong giao dịch (rollback thì không tồn tại), worker gửi sau (G2).
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ScheduleChangeRequestService {

    private final ClassScheduleChangeRequestRepository requestRepo;
    private final TeacherClassRepository classRepo;
    private final ClassTeacherRepository classTeacherRepo;
    private final ClassSessionRepository sessionRepo;
    private final ClassSchedulePatternRepository patternRepo;
    private final ClassScheduleService scheduleService;
    private final NotificationOutboxRepository outboxRepo;
    private final OrgGuard orgGuard;
    private final UserRepository userRepository;
    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;

    // ── Phía giáo viên ──────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<ScheduleChangeRequestDto> listForTeacher(Long teacherId, Long classId) {
        if (!classTeacherRepo.existsByIdClassIdAndIdTeacherId(classId, teacherId)) {
            throw new ForbiddenException("Bạn không dạy lớp này");
        }
        return requestRepo.findByClassIdOrderByRequestedAtDesc(classId).stream().map(this::toDto).toList();
    }

    /** Giáo viên rút đề xuất của CHÍNH MÌNH khi còn PENDING. */
    @Transactional
    public void cancel(Long teacherId, Long requestId) {
        ClassScheduleChangeRequest r = requestRepo.findById(requestId)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy đề xuất"));
        int won = requestRepo.cancelOwnPending(requestId, teacherId, LocalDateTime.now());
        if (won == 0) {
            if (!r.getRequestedBy().equals(teacherId)) {
                throw new ForbiddenException("Chỉ người tạo đề xuất mới rút được");
            }
            throw new ConflictException("Đề xuất đã được xử lý — không rút được nữa");
        }
    }

    // ── Phía trung tâm (duyệt) ──────────────────────────────────────────────

    /**
     * Hàng chờ duyệt của trung tâm, LỌC theo quyền của người xem: OWNER thấy tất; giáo viên trưởng
     * scope CLASS chỉ thấy lớp mình phụ trách; người không có quyền duyệt lớp nào thấy rỗng
     * (MANAGER không mặc định có quyền học vụ — P01).
     */
    @Transactional(readOnly = true)
    public List<ScheduleChangeRequestDto> listPendingForOrg(Long viewerId, Long orgId) {
        return requestRepo.findPendingByOrg(orgId).stream()
                .filter(r -> orgGuard.isAcademicApprover(viewerId, orgId, r.getClassId()))
                .map(this::toDto)
                .toList();
    }

    /**
     * Duyệt + ÁP thay đổi trong một giao dịch. Thắng cuộc đua PENDING → so-và-tăng phiên bản lịch
     * (AC10) → áp payload (mọi guard cứng của đường ghi cũ chạy lại ở đây: trùng giờ giáo viên,
     * ràng buộc phút…) → ghi outbox cho học viên. Bất kỳ bước nào ném lỗi ⇒ rollback toàn bộ,
     * đề xuất vẫn PENDING.
     */
    @Transactional
    public ScheduleChangeRequestDto approve(Long reviewerId, Long orgId, Long requestId) {
        ClassScheduleChangeRequest r = loadForReview(orgId, requestId);
        orgGuard.assertAcademicApprover(reviewerId, orgId, r.getClassId());
        // AC19/AC20/AC23: đề xuất chạm T7/CN chỉ giám đốc trung tâm duyệt được.
        if (r.isHasWeekend()) {
            orgGuard.assertOrgOwner(reviewerId, orgId);
        }

        LocalDateTime now = LocalDateTime.now();
        if (requestRepo.transitionFromPending(requestId,
                ClassScheduleChangeRequest.Status.APPROVED, reviewerId, null, now) == 0) {
            throw new ConflictException("Đề xuất đã được xử lý — tải lại hàng chờ");
        }
        // AC10: nền lịch phải còn đúng như lúc đề xuất; lệch = có thay đổi khác đã áp vào giữa chừng.
        if (classRepo.bumpScheduleVersion(r.getClassId(), r.getBaseVersion()) == 0) {
            throw new ConflictException(
                    "Lịch lớp đã thay đổi từ lúc đề xuất — giáo viên cần tạo lại đề xuất trên lịch mới");
        }

        ClassScheduleService.SessionChangeNote note = applyPayload(r);

        // transitionFromPending là bulk update — đồng bộ lại entity trong context rồi ghi applied_at.
        r.setStatus(ClassScheduleChangeRequest.Status.APPROVED);
        r.setReviewedBy(reviewerId);
        r.setReviewedAt(now);
        r.setAppliedAt(now);
        requestRepo.save(r);

        if (note != null) {
            enqueueOutbox(r, note);
        }
        return toDto(r);
    }

    /** Từ chối: lịch hiệu lực đứng yên, lý do bắt buộc (AC22). Không cần OWNER — từ chối không đổi lịch. */
    @Transactional
    public ScheduleChangeRequestDto reject(Long reviewerId, Long orgId, Long requestId, String reason) {
        if (reason == null || reason.isBlank()) {
            throw new BadRequestException("Từ chối phải kèm lý do");
        }
        ClassScheduleChangeRequest r = loadForReview(orgId, requestId);
        orgGuard.assertAcademicApprover(reviewerId, orgId, r.getClassId());

        LocalDateTime now = LocalDateTime.now();
        if (requestRepo.transitionFromPending(requestId,
                ClassScheduleChangeRequest.Status.REJECTED, reviewerId, reason.trim(), now) == 0) {
            throw new ConflictException("Đề xuất đã được xử lý — tải lại hàng chờ");
        }
        r.setStatus(ClassScheduleChangeRequest.Status.REJECTED);
        r.setReviewedBy(reviewerId);
        r.setReviewedAt(now);
        r.setRejectReason(reason.trim());
        return toDto(r);
    }

    // ── Áp payload theo loại ────────────────────────────────────────────────

    private ClassScheduleService.SessionChangeNote applyPayload(ClassScheduleChangeRequest r) {
        return switch (r.getRequestType()) {
            case MOVE_SESSION, CANCEL_SESSION -> {
                ScheduleChangePayloads.SessionChange sc =
                        objectMapper.convertValue(r.getPayload(), ScheduleChangePayloads.SessionChange.class);
                ClassSession s = sessionRepo.findById(sc.sessionId())
                        .orElseThrow(() -> new ConflictException("Buổi trong đề xuất không còn tồn tại"));
                if (!s.getClassId().equals(r.getClassId())) {
                    throw new ConflictException("Buổi trong đề xuất không thuộc lớp của đề xuất");
                }
                yield scheduleService.applyUpdateSession(r.getRequestedBy(), s, sc.request());
            }
            case ADD_MAKEUP -> {
                CreateSessionRequest req = objectMapper.convertValue(r.getPayload(), CreateSessionRequest.class);
                yield scheduleService.applyCreateSession(r.getRequestedBy(), r.getClassId(), req).note();
            }
            case UPDATE_PATTERN -> {
                if ("DELETE".equals(r.getPayload().get("action"))) {
                    ScheduleChangePayloads.PatternDelete del =
                            objectMapper.convertValue(r.getPayload(), ScheduleChangePayloads.PatternDelete.class);
                    ClassSchedulePattern p = patternRepo.findById(del.patternId())
                            .orElseThrow(() -> new ConflictException("Lịch cố định trong đề xuất không còn tồn tại"));
                    if (!p.getClassId().equals(r.getClassId())) {
                        throw new ConflictException("Lịch cố định trong đề xuất không thuộc lớp của đề xuất");
                    }
                    yield scheduleService.applyDeletePattern(r.getRequestedBy(), p).note();
                }
                UpsertPatternRequest req = objectMapper.convertValue(r.getPayload(), UpsertPatternRequest.class);
                yield scheduleService.applyUpsertPattern(r.getRequestedBy(), r.getClassId(), req).note();
            }
            // Khai đủ enum từ đầu; mốc thi vào ở PR-6 — tới đó nhánh này mới có payload thật.
            case MOVE_MILESTONE -> throw new BadRequestException("Loại đề xuất chưa hỗ trợ áp dụng: MOVE_MILESTONE");
        };
    }

    /**
     * Ghi thông báo học viên vào OUTBOX trong CÙNG giao dịch áp lịch (G2): rollback thì không có
     * dòng nào; dedup_key (đề xuất, phiên bản-sau-áp, người nhận) chặn gửi trùng ở worker.
     */
    private void enqueueOutbox(ClassScheduleChangeRequest r, ClassScheduleService.SessionChangeNote note) {
        List<Long> studentIds = jdbcTemplate.queryForList(
                "SELECT student_id FROM class_students WHERE class_id = ?", Long.class, r.getClassId());
        if (studentIds.isEmpty()) return;

        String className = classRepo.findById(r.getClassId()).map(TeacherClass::getName)
                .orElse("Lớp #" + r.getClassId());
        String teacherName = userRepository.findById(r.getRequestedBy())
                .map(User::getDisplayName).orElse("");
        long appliedVersion = r.getBaseVersion() + 1;

        for (Long studentId : studentIds) {
            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("classId", r.getClassId());
            payload.put("className", className);
            payload.put("teacherId", r.getRequestedBy());
            payload.put("teacherName", teacherName);
            payload.put("message", note.message());
            outboxRepo.save(NotificationOutbox.builder()
                    .dedupKey("request:" + r.getId() + ":v" + appliedVersion + ":u" + studentId)
                    .notificationType(note.type())
                    .classId(r.getClassId())
                    .recipientId(studentId)
                    .payload(payload)
                    .build());
        }
        log.info("[schedule-approve] request {} applied — {} outbox rows queued for class {}",
                r.getId(), studentIds.size(), r.getClassId());
    }

    private ClassScheduleChangeRequest loadForReview(Long orgId, Long requestId) {
        ClassScheduleChangeRequest r = requestRepo.findById(requestId)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy đề xuất"));
        // Chốt tenant TRƯỚC mọi guard: đề xuất phải thuộc một lớp của đúng trung tâm này.
        if (!classRepo.existsByIdAndOrgId(r.getClassId(), orgId)) {
            throw new NotFoundException("Không tìm thấy đề xuất trong trung tâm");
        }
        return r;
    }

    private ScheduleChangeRequestDto toDto(ClassScheduleChangeRequest r) {
        return new ScheduleChangeRequestDto(
                r.getId(),
                r.getClassId(),
                classRepo.findById(r.getClassId()).map(TeacherClass::getName).orElse("Lớp #" + r.getClassId()),
                r.getRequestType().name(),
                r.getPayload(),
                r.getImpactSnapshot(),
                r.getReason(),
                r.isHasWeekend(),
                r.getStatus().name(),
                r.getRequestedBy(),
                userRepository.findById(r.getRequestedBy()).map(User::getDisplayName).orElse(""),
                r.getRequestedAt(),
                r.getReviewedBy(),
                r.getReviewedAt(),
                r.getRejectReason(),
                r.getAppliedAt());
    }
}
