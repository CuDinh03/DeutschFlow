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

        // Idempotent theo mốc bắt đầu: mở lại đúng kỳ cũ trả về kỳ sẵn có, không tạo trùng.
        TeacherTimesheetPeriod existing = periodRepository
                .findByTeacherIdAndPeriodStart(teacherId, periodStart)
                .orElse(null);
        if (existing != null) {
            return toDto(existing, null);
        }

        // Kỳ MỚI không được chồng lấp bất kỳ kỳ nào đã có của giáo viên. Không có chốt này thì một buổi
        // rơi vào hai kỳ: (1) snapshotTotals đếm theo khoảng ngày nên buổi đó được cộng — và trả lương —
        // ở CẢ hai kỳ; (2) assertRecordEditable khớp nhiều dòng. Ràng buộc EXCLUDE ở V267 là chốt cứng
        // phía DB; kiểm tra ở đây để trả 409 rõ nghĩa thay vì để DB ném lỗi thô.
        assertNoOverlap(teacherId, periodStart, periodEnd);

        Long orgId = userRepository.findById(teacherId).map(User::getOrgId).orElse(null);   // snapshot lúc mở
        // Chèn ATOMIC: hai request mở kỳ đồng thời cùng mốc bắt đầu không làm request thứ hai ném 500 —
        // ON CONFLICT DO NOTHING rồi cả hai tra lại kỳ đã có (idempotent).
        periodRepository.insertIfAbsent(teacherId, orgId, periodStart, periodEnd);
        return toDto(periodRepository.findByTeacherIdAndPeriodStart(teacherId, periodStart)
                .orElseThrow(() -> new IllegalStateException("Không tra lại được kỳ công vừa mở")), null);
    }

    /** Chặn mở kỳ chồng lấp: hai kỳ [a,b] và [c,d] giao nhau khi a &lt;= d AND c &lt;= b. */
    private void assertNoOverlap(Long teacherId, LocalDate start, LocalDate end) {
        periodRepository
                .findByTeacherIdAndPeriodStartLessThanEqualAndPeriodEndGreaterThanEqual(teacherId, end, start)
                .stream()
                .findFirst()
                .ifPresent(o -> {
                    throw new ConflictException(
                            "Kỳ công " + start + " – " + end + " chồng lấp kỳ đã có "
                                    + o.getPeriodStart() + " – " + o.getPeriodEnd()
                                    + ". Mỗi buổi chỉ được thuộc một kỳ công.");
                });
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
        // Nộp khi kỳ CHƯA kết thúc là đóng băng vĩnh viễn phần còn lại của kỳ: assertRecordEditable chặn
        // theo KHOẢNG NGÀY của kỳ, và không có transition nào mở lại kỳ đã duyệt/khoá — nên buổi dạy sau
        // ngày nộp sẽ KHÔNG BAO GIỜ ghi công được nữa (giáo viên mất công đã dạy thật).
        // Muốn chốt sớm thì mở kỳ ngắn hơn: openPeriod nhận from/to tuỳ ý, nên kỳ có thể kết thúc đúng
        // ngày chốt lương của trung tâm thay vì luôn trọn tháng.
        if (TeacherTimesheetService.todayVn().isBefore(p.getPeriodEnd())) {
            throw new ConflictException(
                    "Kỳ công kéo dài tới " + p.getPeriodEnd() + " nên chưa nộp được. "
                            + "Nếu cần chốt sớm, hãy mở kỳ kết thúc đúng ngày chốt.");
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

    /**
     * Xuất bảng công toàn tổ chức ra CSV cho kế toán. Đây là điểm KẾT THÚC của luồng: hệ thống cố ý
     * không lưu đơn giá và không tính tiền, nên số công đã duyệt phải rời khỏi hệ thống ở đây.
     *
     * <p>Định dạng: dấu phẩy, có BOM UTF-8 để Excel trên Windows không vỡ tiếng Việt. Mọi ô đều
     * được bọc nháy kép và escape nháy trong nội dung — tên lớp/giáo viên có thể chứa dấu phẩy.
     */
    @Transactional(readOnly = true)
    public String exportOrgCsv(Long reviewerId, Long orgId, LocalDate from, LocalDate to) {
        OrgTimesheetDto data = orgSummary(reviewerId, orgId, from, to);
        StringBuilder sb = new StringBuilder("\uFEFF");
        sb.append("Giáo viên,Kỳ bắt đầu,Kỳ kết thúc,Trạng thái,Đơn vị tính,Số buổi,Số phút,Ngày nộp,Ngày duyệt\n");
        // CHỈ xuất kỳ ĐÃ DUYỆT hoặc ĐÃ KHOÁ. orgSummary cố ý trả về mọi trạng thái vì màn hình manager
        // cần thấy kỳ SUBMITTED để bấm duyệt — nhưng file này là bàn giao cho KẾ TOÁN, nơi mỗi dòng được
        // hiểu là con số phải trả. Trộn vào đó:
        //   * OPEN      → total_sessions còn nguyên mặc định 0 (snapshotTotals chưa từng chạy), nên giáo
        //                 viên đã dạy 18 buổi lại hiện thành 0 buổi;
        //   * SUBMITTED → chưa ai duyệt, không có thẩm quyền chi trả;
        //   * REJECTED  → giữ snapshot đang tranh chấp, tức đúng con số manager đã bác bỏ.
        List<PeriodDto> payable = data.periods().stream()
                .filter(p -> Status.APPROVED.name().equals(p.status()) || Status.LOCKED.name().equals(p.status()))
                .toList();

        for (PeriodDto p : payable) {
            sb.append(csv(p.teacherName() != null ? p.teacherName() : "#" + p.teacherId())).append(',')
              .append(csv(String.valueOf(p.periodStart()))).append(',')
              .append(csv(String.valueOf(p.periodEnd()))).append(',')
              .append(csv(p.status())).append(',')
              .append(csv(p.payUnit())).append(',')
              .append(p.totalSessions()).append(',')
              .append(p.totalMinutes()).append(',')
              .append(csv(p.submittedAt() == null ? "" : p.submittedAt().toString())).append(',')
              .append(csv(p.reviewedAt() == null ? "" : p.reviewedAt().toString())).append('\n');
        }
        return sb.toString();
    }

    /** Bọc một ô CSV: luôn có nháy kép, nháy bên trong nhân đôi (RFC 4180). */
    private static String csv(String raw) {
        String v = raw == null ? "" : raw;
        return '"' + v.replace("\"", "\"\"") + '"';
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
                .stream()
                .filter(p -> !p.isEditable())
                .findFirst()
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
                        p.getPeriodEnd().plusDays(1).atStartOfDay())    // [start, end] theo NGÀY
                .stream()
                .filter(r -> belongsToPeriodOrg(p, r))
                .toList();
        p.setTotalSessions(records.size());
        p.setTotalMinutes(records.stream().mapToInt(TeacherSessionRecord::getDurationMinutes).sum());
    }

    /**
     * Dòng công có được tính vào kỳ này không, xét theo tổ chức. Kỳ snapshot org NHÀ của giáo viên
     * (V264), còn dòng công snapshot org của LỚP đã dạy. Chỉ loại khi CẢ HAI org đều biết và khác
     * nhau: giáo viên dạy chéo trung tâm không được dồn công org khác sang kỳ của org nhà — nếu không
     * manager org A thấy (và trả lương) cả buổi thuộc org B. Dòng công org=null (lớp chưa gắn org) vẫn
     * tính, giữ nguyên hành vi ca đơn-tổ-chức thông thường.
     */
    private static boolean belongsToPeriodOrg(TeacherTimesheetPeriod p, TeacherSessionRecord r) {
        // FAIL-CLOSED có chủ ý: kỳ thuộc một tổ chức thì CHỈ tính dòng công của chính tổ chức đó.
        // Bản trước bỏ qua khi một trong hai vế NULL, tức fail-OPEN: giáo viên dạy lớp tư (teacher_classes
        // .org_id = NULL — cột này chỉ đóng dấu lúc TẠO lớp và không bao giờ backfill) vẫn được dồn công
        // sang kỳ của trung tâm, và trung tâm trả tiền cho buổi không dạy cho họ.
        // Đánh đổi đã cân nhắc: trả THIẾU dễ phát hiện (giáo viên đối chiếu bảng công của mình rồi khiếu
        // nại) hơn trả THỪA (rò rỉ tài chính âm thầm, không ai soi). Công của lớp chưa gắn tổ chức vẫn
        // hiện đầy đủ ở mySheet của giáo viên, chỉ không vào kỳ lương của tổ chức.
        return p.getOrgId() == null
                ? r.getOrgId() == null
                : p.getOrgId().equals(r.getOrgId());
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
