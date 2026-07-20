package com.deutschflow.teacher.service;

import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.common.exception.ConflictException;
import com.deutschflow.common.exception.ForbiddenException;
import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.organization.service.OrgGuard;
import com.deutschflow.teacher.dto.TimesheetPeriodDtos.OrgTimesheetDto;
import com.deutschflow.teacher.dto.TimesheetPeriodDtos.PeriodDto;
import com.deutschflow.teacher.entity.TeacherSessionRecord;
import com.deutschflow.teacher.entity.TeacherTimesheetPeriod;
import com.deutschflow.teacher.entity.TeacherTimesheetPeriod.Status;
import com.deutschflow.teacher.repository.TeacherSessionRecordRepository;
import com.deutschflow.teacher.repository.TeacherTimesheetPeriodRepository;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Kỳ công + quy trình duyệt (V264): giáo viên nộp, manager duyệt / trả lại / khoá.
 *
 * <p><b>Vì sao service này tồn tại:</b> không thể trả lương từ dữ liệu sửa–xoá tự do vô thời hạn.
 * Kỳ công là ranh giới biến số công thành con số chốt được: khi kỳ đã nộp trở đi,
 * {@link TeacherTimesheetService} từ chối mọi thay đổi dòng công trong kỳ, và tổng số công được
 * chụp lại tại mỗi lần chuyển trạng thái thay vì tính động khi đọc.
 *
 * <p><b>Phạm vi khoá:</b> chỉ khoá dòng công, KHÔNG khoá {@code class_lesson_logs}. Sổ điểm danh
 * học viên là dữ liệu học vụ; đóng băng nó theo kỳ lương sẽ cản giáo viên bổ sung điểm danh sót cho
 * một buổi đã qua. Tách bảng ghi công ở V263 chính là để hai thứ này độc lập.
 */
@Service
@RequiredArgsConstructor
public class TimesheetPeriodService {

    private final TeacherTimesheetPeriodRepository periodRepository;
    private final TeacherSessionRecordRepository recordRepository;
    private final UserRepository userRepository;
    private final OrgGuard orgGuard;

    // ── phía giáo viên ────────────────────────────────────────────────────────

    /** Kỳ phủ khoảng [start, end] của giáo viên; tạo mới ở trạng thái OPEN nếu chưa có. */
    @Transactional
    public PeriodDto openPeriod(Long teacherId, LocalDate periodStart, LocalDate periodEnd) {
        assertValidRange(periodStart, periodEnd);
        TeacherTimesheetPeriod period = periodRepository
                .findByTeacherIdAndPeriodStart(teacherId, periodStart)
                .orElseGet(() -> {
                    Long orgId = userRepository.findById(teacherId).map(User::getOrgId).orElse(null);
                    return periodRepository.save(TeacherTimesheetPeriod.builder()
                            .teacherId(teacherId)
                            .orgId(orgId)                 // snapshot lúc mở kỳ
                            .periodStart(periodStart)
                            .periodEnd(periodEnd)
                            .status(Status.OPEN)
                            .build());
                });
        return toDto(period, null);
    }

    @Transactional(readOnly = true)
    public List<PeriodDto> myPeriods(Long teacherId) {
        return periodRepository.findByTeacherIdOrderByPeriodStartDesc(teacherId).stream()
                .map(p -> toDto(p, null))
                .toList();
    }

    /** Giáo viên nộp kỳ. Chốt số công tại thời điểm nộp — đó là con số manager sẽ xem. */
    @Transactional
    public PeriodDto submit(Long teacherId, Long periodId) {
        TeacherTimesheetPeriod p = ownPeriod(teacherId, periodId);
        if (p.getStatus() != Status.OPEN && p.getStatus() != Status.REJECTED) {
            throw new ConflictException("Kỳ công đang ở trạng thái " + p.getStatus() + ", không thể nộp lại.");
        }
        snapshotTotals(p);
        p.setStatus(Status.SUBMITTED);
        p.setSubmittedAt(Instant.now());
        p.setRejectReason(null);
        return toDto(periodRepository.save(p), null);
    }

    // ── phía manager (OWNER | MANAGER của tổ chức) ────────────────────────────

    /**
     * Tổng hợp bảng công toàn tổ chức. {@code reviewerOrgId} luôn lấy từ principal, không nhận từ
     * client — quy ước sẵn có của surface {@code /api/org}.
     */
    @Transactional(readOnly = true)
    public OrgTimesheetDto orgSummary(Long reviewerId, Long orgId, LocalDate from, LocalDate to) {
        assertValidRange(from, to);
        orgGuard.assertOrgAdmin(reviewerId, orgId);

        List<TeacherTimesheetPeriod> periods = periodRepository
                .findByOrgIdAndPeriodStartGreaterThanEqualAndPeriodStartLessThanEqualOrderByPeriodStartDescTeacherIdAsc(
                        orgId, from, to);
        Map<Long, String> names = teacherNames(periods);

        return new OrgTimesheetDto(
                from, to,
                (int) periods.stream().map(TeacherTimesheetPeriod::getTeacherId).distinct().count(),
                periods.stream().mapToInt(TeacherTimesheetPeriod::getTotalSessions).sum(),
                periods.stream().mapToInt(TeacherTimesheetPeriod::getTotalMinutes).sum(),
                periods.stream().map(p -> toDto(p, names.get(p.getTeacherId()))).toList());
    }

    /** Duyệt kỳ. Chốt lại số công tại thời điểm duyệt — đó là con số được trả. */
    @Transactional
    public PeriodDto approve(Long reviewerId, Long orgId, Long periodId) {
        TeacherTimesheetPeriod p = reviewablePeriod(reviewerId, orgId, periodId);
        if (p.getStatus() != Status.SUBMITTED) {
            throw new ConflictException("Chỉ duyệt được kỳ đã nộp (hiện tại: " + p.getStatus() + ").");
        }
        snapshotTotals(p);
        p.setStatus(Status.APPROVED);
        stampReview(p, reviewerId);
        return toDto(periodRepository.save(p), null);
    }

    /** Trả kỳ về cho giáo viên sửa. Bắt buộc có lý do — nếu không họ không biết phải sửa gì. */
    @Transactional
    public PeriodDto reject(Long reviewerId, Long orgId, Long periodId, String reason) {
        if (reason == null || reason.isBlank()) {
            throw new BadRequestException("Cần nêu lý do trả lại kỳ công.");
        }
        TeacherTimesheetPeriod p = reviewablePeriod(reviewerId, orgId, periodId);
        if (p.getStatus() != Status.SUBMITTED) {
            throw new ConflictException("Chỉ trả lại được kỳ đã nộp (hiện tại: " + p.getStatus() + ").");
        }
        p.setStatus(Status.REJECTED);
        p.setRejectReason(reason.trim());
        stampReview(p, reviewerId);
        return toDto(periodRepository.save(p), null);
    }

    /** Khoá kỳ — trạng thái cuối, không quay lại được. Dùng sau khi đã xuất dữ liệu cho kế toán. */
    @Transactional
    public PeriodDto lock(Long reviewerId, Long orgId, Long periodId) {
        TeacherTimesheetPeriod p = reviewablePeriod(reviewerId, orgId, periodId);
        if (p.getStatus() != Status.APPROVED) {
            throw new ConflictException("Chỉ khoá được kỳ đã duyệt (hiện tại: " + p.getStatus() + ").");
        }
        p.setStatus(Status.LOCKED);
        stampReview(p, reviewerId);
        return toDto(periodRepository.save(p), null);
    }

    // ── chốt chặn dùng bởi TeacherTimesheetService ────────────────────────────

    /**
     * Ném lỗi nếu ngày này rơi vào một kỳ đã nộp/duyệt/khoá. Đây là ràng buộc làm cho quy trình
     * duyệt có nghĩa: không có nó, giáo viên vẫn sửa được số công sau khi manager đã duyệt.
     */
    @Transactional(readOnly = true)
    public void assertRecordEditable(Long teacherId, LocalDate onDate) {
        periodRepository
                .findByTeacherIdAndPeriodStartLessThanEqualAndPeriodEndGreaterThanEqual(
                        teacherId, onDate, onDate)
                .filter(p -> !p.isEditable())
                .ifPresent(p -> {
                    throw new ConflictException(
                            "Kỳ công " + p.getPeriodStart() + " – " + p.getPeriodEnd()
                                    + " đang ở trạng thái " + p.getStatus()
                                    + ", không thể thay đổi bản ghi công trong kỳ.");
                });
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    private TeacherTimesheetPeriod ownPeriod(Long teacherId, Long periodId) {
        TeacherTimesheetPeriod p = periodRepository.findById(periodId)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy kỳ công"));
        if (!p.getTeacherId().equals(teacherId)) {
            throw new ForbiddenException("Bạn không có quyền với kỳ công này");
        }
        return p;
    }

    /**
     * Kỳ mà người duyệt được phép xử lý. Hai lớp kiểm tra, cả hai đều cần:
     * (1) người dùng là OWNER/MANAGER đang ACTIVE của tổ chức — {@link OrgGuard} đọc DB, không tin JWT;
     * (2) kỳ đó thực sự thuộc chính tổ chức ấy, chống duyệt chéo tổ chức.
     */
    private TeacherTimesheetPeriod reviewablePeriod(Long reviewerId, Long orgId, Long periodId) {
        orgGuard.assertOrgAdmin(reviewerId, orgId);
        TeacherTimesheetPeriod p = periodRepository.findById(periodId)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy kỳ công"));
        if (p.getOrgId() == null || !p.getOrgId().equals(orgId)) {
            throw new ForbiddenException("Kỳ công không thuộc tổ chức của bạn");
        }
        return p;
    }

    private void stampReview(TeacherTimesheetPeriod p, Long reviewerId) {
        p.setReviewedBy(reviewerId);
        p.setReviewedAt(Instant.now());
    }

    /** Chụp lại tổng số công từ các dòng công trong kỳ. Gọi tại MỖI lần chuyển trạng thái. */
    private void snapshotTotals(TeacherTimesheetPeriod p) {
        List<TeacherSessionRecord> records = recordRepository
                .findByTeacherIdAndStartedAtGreaterThanEqualAndStartedAtLessThanOrderByStartedAt(
                        p.getTeacherId(),
                        p.getPeriodStart().atStartOfDay(),
                        p.getPeriodEnd().plusDays(1).atStartOfDay());   // [start, end] theo NGÀY
        p.setTotalSessions(records.size());
        p.setTotalMinutes(records.stream().mapToInt(TeacherSessionRecord::getDurationMinutes).sum());
    }

    private Map<Long, String> teacherNames(List<TeacherTimesheetPeriod> periods) {
        List<Long> ids = periods.stream().map(TeacherTimesheetPeriod::getTeacherId).distinct().toList();
        if (ids.isEmpty()) return Map.of();
        return userRepository.findAllById(ids).stream()
                .filter(u -> u.getDisplayName() != null)
                .collect(Collectors.toMap(User::getId, User::getDisplayName));
    }

    private static void assertValidRange(LocalDate from, LocalDate to) {
        if (from == null || to == null) throw new BadRequestException("Thiếu khoảng thời gian của kỳ.");
        if (to.isBefore(from)) throw new BadRequestException("Kỳ công không hợp lệ.");
    }

    private static PeriodDto toDto(TeacherTimesheetPeriod p, String teacherName) {
        return new PeriodDto(
                p.getId(), p.getTeacherId(), teacherName,
                p.getPeriodStart(), p.getPeriodEnd(),
                p.getPayUnit().name(), p.getStatus().name(), p.isEditable(),
                p.getTotalSessions(), p.getTotalMinutes(),
                p.getSubmittedAt(), p.getReviewedAt(), p.getRejectReason());
    }
}
