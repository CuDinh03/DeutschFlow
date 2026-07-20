package com.deutschflow.teacher.service;

import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.common.exception.ConflictException;
import com.deutschflow.common.exception.ForbiddenException;
import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.common.quota.QuotaVnCalendar;
import com.deutschflow.teacher.dto.TimesheetDtos.RecordTeachingRequest;
import com.deutschflow.teacher.dto.TimesheetDtos.SessionRecordDto;
import com.deutschflow.teacher.dto.TimesheetDtos.SuggestionDto;
import com.deutschflow.teacher.dto.TimesheetDtos.TimesheetSummaryDto;
import com.deutschflow.teacher.entity.ClassSession;
import com.deutschflow.teacher.entity.TeacherClass;
import com.deutschflow.teacher.entity.TeacherSessionRecord;
import com.deutschflow.teacher.repository.ClassSessionRepository;
import com.deutschflow.teacher.repository.ClassTeacherRepository;
import com.deutschflow.teacher.repository.TeacherClassRepository;
import com.deutschflow.teacher.repository.TeacherSessionRecordRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Bảng công giáo viên: ghi nhận buổi đã dạy và tổng hợp theo kỳ.
 *
 * <p>Nguyên tắc xuyên suốt service này là <b>số công phải tự đứng vững</b>. Mọi giá trị dùng để
 * tính công ({@code startedAt}, {@code durationMinutes}, {@code orgId}, tên lớp) được chốt vào dòng
 * công ngay lúc ghi nhận, không đọc lại từ {@code class_sessions} khi hiển thị. Lý do rất cụ thể:
 * {@link ClassScheduleService#rollForwardActivePatterns()} xoá thật các buổi tương lai chưa chỉnh
 * tay và sinh lại chúng, còn xoá lớp thì cascade xuống buổi — nếu số công join live thì nó sẽ đổi
 * hoặc biến mất sau lưng người đã duyệt.
 *
 * <p>Hệ <b>không tự sinh</b> bản ghi công từ lịch. Lịch chỉ nói "lớp này có buổi lúc đó", không nói
 * ai đứng lớp: {@code class_sessions} không có teacher_id, một lớp có 1 PRIMARY + N ASSISTANT, và
 * còn có dạy thay. Vì vậy hệ chỉ <i>đề xuất</i> ({@link #suggestions}) để giáo viên xác nhận.
 */
@Service
@RequiredArgsConstructor
public class TeacherTimesheetService {

    private final TeacherSessionRecordRepository recordRepository;
    private final ClassSessionRepository sessionRepository;
    private final ClassTeacherRepository classTeacherRepository;
    private final TeacherClassRepository classRepository;
    private final TimesheetPeriodService periodService;

    /** Bảng công của giáo viên trong kỳ [from, to), kèm các buổi đã qua mà chưa ghi công. */
    @Transactional(readOnly = true)
    public TimesheetSummaryDto mySheet(Long teacherId, LocalDateTime from, LocalDateTime to) {
        assertValidRange(from, to);
        List<TeacherSessionRecord> records = recordRepository
                .findByTeacherIdAndStartedAtGreaterThanEqualAndStartedAtLessThanOrderByStartedAt(
                        teacherId, from, to);

        int totalMinutes = records.stream().mapToInt(TeacherSessionRecord::getDurationMinutes).sum();

        return new TimesheetSummaryDto(
                from, to,
                records.size(),
                totalMinutes,
                records.stream().map(TeacherTimesheetService::toDto).toList(),
                suggestions(teacherId, from, to));
    }

    /**
     * Buổi ĐÃ LÊN LỊCH, ĐÃ TRÔI QUA, thuộc lớp giáo viên dạy, và CHƯA được ghi công.
     *
     * <p>Loại bỏ buổi {@code CANCELLED} — {@code findForClassesInRange} không lọc theo trạng thái,
     * và lớp đã nghỉ thì không có công. Không loại {@code MOVED}: trên thực tế không có mã nào set
     * trạng thái đó (buổi dời được biểu diễn bằng {@code startAt} mới + {@code overridden}), nên
     * lọc theo nó sẽ không có tác dụng gì ngoài gây hiểu nhầm.
     */
    @Transactional(readOnly = true)
    public List<SuggestionDto> suggestions(Long teacherId, LocalDateTime from, LocalDateTime to) {
        assertValidRange(from, to);
        List<Long> classIds = teacherClassIds(teacherId);
        if (classIds.isEmpty()) return List.of();

        // Chỉ đề xuất buổi đã diễn ra: đề xuất buổi tương lai là mời giáo viên ghi công trước khi dạy.
        LocalDateTime now = LocalDateTime.now(QuotaVnCalendar.ZONE);
        LocalDateTime upperBound = to.isBefore(now) ? to : now;
        if (!upperBound.isAfter(from)) return List.of();

        List<ClassSession> sessions = sessionRepository.findForClassesInRange(classIds, from, upperBound).stream()
                .filter(s -> s.getStatus() != ClassSession.Status.CANCELLED)
                .toList();
        if (sessions.isEmpty()) return List.of();

        Set<Long> alreadyRecorded = recordRepository
                .findByTeacherIdAndSessionIdIn(teacherId, sessions.stream().map(ClassSession::getId).toList())
                .stream().map(TeacherSessionRecord::getSessionId).collect(Collectors.toSet());

        // Cũng loại các buổi đã có dòng công cùng mốc bắt đầu nhưng khai tay (session_id null),
        // nếu không giáo viên sẽ thấy đề xuất trùng với chính bản ghi mình vừa tạo.
        Set<LocalDateTime> recordedStarts = recordRepository
                .findByTeacherIdAndStartedAtGreaterThanEqualAndStartedAtLessThanOrderByStartedAt(
                        teacherId, from, upperBound)
                .stream().map(TeacherSessionRecord::getStartedAt).collect(Collectors.toSet());

        Map<Long, String> classNames = classNames(classIds);
        return sessions.stream()
                .filter(s -> !alreadyRecorded.contains(s.getId()))
                .filter(s -> !recordedStarts.contains(s.getStartAt()))
                .sorted(Comparator.comparing(ClassSession::getStartAt))
                .map(s -> new SuggestionDto(
                        s.getId(), s.getClassId(), classNames.get(s.getClassId()),
                        s.getStartAt(), s.getDurationMinutes()))
                .toList();
    }

    /** Ghi nhận một buổi đã dạy. Snapshot mọi giá trị dùng để tính công. */
    @Transactional
    public SessionRecordDto record(Long teacherId, RecordTeachingRequest req) {
        ClassSession session = null;
        Long classId = req.classId();
        LocalDateTime startedAt = req.startedAt();
        Integer duration = req.durationMinutes();

        if (req.sessionId() != null) {
            session = sessionRepository.findById(req.sessionId())
                    .orElseThrow(() -> new NotFoundException("Buổi học không tồn tại"));
            classId = session.getClassId();
            // Mặc định lấy từ lịch; giáo viên vẫn ghi đè được vì thời lượng THỰC TẾ mới là cái tính công.
            if (startedAt == null) startedAt = session.getStartAt();
            if (duration == null) duration = session.getDurationMinutes();
            if (session.getStatus() == ClassSession.Status.CANCELLED) {
                throw new BadRequestException("Buổi học đã bị huỷ, không thể ghi công.");
            }
        }

        if (classId == null) throw new BadRequestException("Thiếu lớp của buổi dạy.");
        if (startedAt == null) throw new BadRequestException("Thiếu thời điểm bắt đầu buổi dạy.");
        if (duration == null || duration <= 0) {
            throw new BadRequestException("Thời lượng buổi dạy phải lớn hơn 0 phút.");
        }
        assertTeachesClass(teacherId, classId);
        assertNotInFuture(startedAt);
        assertNoDoubleCount(teacherId, startedAt, null);
        // Kỳ đã nộp trở đi thì đóng băng: không thêm công vào một kỳ manager đang xem hoặc đã duyệt.
        periodService.assertRecordEditable(teacherId, startedAt.toLocalDate());

        TeacherClass cls = classRepository.findById(classId).orElse(null);
        TeacherSessionRecord rec = TeacherSessionRecord.builder()
                .teacherId(teacherId)
                .classId(classId)
                .sessionId(session != null ? session.getId() : null)
                .orgId(cls != null ? cls.getOrgId() : null)          // org của LỚP, không phải của người ghi
                .classNameSnapshot(cls != null ? cls.getName() : null)
                .startedAt(startedAt)
                .durationMinutes(duration)
                .teacherRole(parseRole(req.teacherRole()))
                .note(req.note())
                .build();
        return toDto(recordRepository.save(rec));
    }

    /** Sửa một dòng công (thời lượng thực tế, ghi chú, vai trò). */
    @Transactional
    public SessionRecordDto updateRecord(Long teacherId, Long recordId, RecordTeachingRequest req) {
        TeacherSessionRecord rec = ownedRecord(teacherId, recordId);
        // Kỳ CHỨA dòng công hiện tại phải còn mở…
        periodService.assertRecordEditable(teacherId, rec.getStartedAt().toLocalDate());

        if (req.startedAt() != null && !req.startedAt().equals(rec.getStartedAt())) {
            assertNotInFuture(req.startedAt());
            assertNoDoubleCount(teacherId, req.startedAt(), recordId);
            // …và kỳ ĐÍCH cũng vậy, nếu không đây là đường chuyển công vào một kỳ đã chốt.
            periodService.assertRecordEditable(teacherId, req.startedAt().toLocalDate());
            rec.setStartedAt(req.startedAt());
        }
        if (req.durationMinutes() != null) {
            if (req.durationMinutes() <= 0) {
                throw new BadRequestException("Thời lượng buổi dạy phải lớn hơn 0 phút.");
            }
            rec.setDurationMinutes(req.durationMinutes());
        }
        if (req.teacherRole() != null) rec.setTeacherRole(parseRole(req.teacherRole()));
        if (req.note() != null) rec.setNote(req.note());

        return toDto(recordRepository.save(rec));
    }

    @Transactional
    public void deleteRecord(Long teacherId, Long recordId) {
        TeacherSessionRecord rec = ownedRecord(teacherId, recordId);
        periodService.assertRecordEditable(teacherId, rec.getStartedAt().toLocalDate());
        recordRepository.delete(rec);
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    private TeacherSessionRecord ownedRecord(Long teacherId, Long recordId) {
        TeacherSessionRecord rec = recordRepository.findById(recordId)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy dòng công"));
        // Bảng công là dữ liệu cá nhân của từng giáo viên — không ai sửa của người khác, kể cả
        // giáo viên chính của cùng lớp. Manager sẽ duyệt ở luồng riêng (kỳ công), không sửa trực tiếp.
        if (!rec.getTeacherId().equals(teacherId)) {
            throw new ForbiddenException("Bạn không có quyền sửa dòng công này");
        }
        return rec;
    }

    private void assertTeachesClass(Long teacherId, Long classId) {
        if (!classTeacherRepository.existsByIdClassIdAndIdTeacherId(classId, teacherId)) {
            throw new ForbiddenException("Bạn không dạy lớp này");
        }
    }

    /** Không ghi công cho buổi chưa diễn ra — nếu không, đây là kênh khai công trước khi làm. */
    private void assertNotInFuture(LocalDateTime startedAt) {
        if (startedAt.isAfter(LocalDateTime.now(QuotaVnCalendar.ZONE))) {
            throw new BadRequestException("Không thể ghi công cho buổi chưa diễn ra.");
        }
    }

    /**
     * Một giáo viên không thể đứng hai lớp cùng một thời điểm, nên một mốc bắt đầu chỉ được có một
     * dòng công. Đây là chốt chặn trả thừa công, soi đúng unique index {@code uq_tsr_teacher_start}.
     */
    private void assertNoDoubleCount(Long teacherId, LocalDateTime startedAt, Long selfRecordId) {
        recordRepository.findByTeacherIdAndStartedAt(teacherId, startedAt)
                .filter(existing -> !existing.getId().equals(selfRecordId))
                .ifPresent(existing -> {
                    throw new ConflictException(
                            "Bạn đã ghi công cho buổi bắt đầu lúc " + startedAt + ".");
                });
    }

    private static void assertValidRange(LocalDateTime from, LocalDateTime to) {
        if (from == null || to == null) throw new BadRequestException("Thiếu khoảng thời gian của kỳ.");
        if (!to.isAfter(from)) throw new BadRequestException("Kỳ công không hợp lệ.");
    }

    private List<Long> teacherClassIds(Long teacherId) {
        return classTeacherRepository.findByIdTeacherId(teacherId).stream()
                .map(ct -> ct.getId().getClassId())
                .distinct()
                .toList();
    }

    private Map<Long, String> classNames(List<Long> classIds) {
        return classRepository.findAllById(classIds).stream()
                .filter(c -> c.getName() != null)
                .collect(Collectors.toMap(TeacherClass::getId, TeacherClass::getName));
    }

    private static TeacherSessionRecord.TeacherRole parseRole(String raw) {
        if (raw == null || raw.isBlank()) return TeacherSessionRecord.TeacherRole.PRIMARY;
        try {
            return TeacherSessionRecord.TeacherRole.valueOf(raw.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new BadRequestException(
                    "Vai trò không hợp lệ (chỉ nhận PRIMARY, ASSISTANT, SUBSTITUTE).");
        }
    }

    private static SessionRecordDto toDto(TeacherSessionRecord r) {
        return new SessionRecordDto(
                r.getId(), r.getClassId(), r.getClassNameSnapshot(), r.getSessionId(),
                r.getStartedAt(), r.getDurationMinutes(), r.getTeacherRole().name(), r.getNote());
    }

    /** Ngày hôm nay theo giờ VN — dùng chung cho mọi ranh giới kỳ công. */
    public static LocalDate todayVn() {
        return LocalDate.now(QuotaVnCalendar.ZONE);
    }
}
