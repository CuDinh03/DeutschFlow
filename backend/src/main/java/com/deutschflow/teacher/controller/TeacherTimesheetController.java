package com.deutschflow.teacher.controller;

import com.deutschflow.teacher.dto.TimesheetDtos.RecordTeachingRequest;
import com.deutschflow.teacher.dto.TimesheetDtos.SessionRecordDto;
import com.deutschflow.teacher.dto.TimesheetDtos.TimesheetSummaryDto;
import com.deutschflow.teacher.dto.TimesheetPeriodDtos.PeriodDto;
import com.deutschflow.teacher.service.TimesheetPeriodService;
import com.deutschflow.teacher.service.TeacherTimesheetService;
import com.deutschflow.user.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;

/**
 * Bảng công của chính giáo viên đang đăng nhập (V263).
 *
 * <p>Theo tiền tố {@code /api/v2/teacher/**} như các controller giáo viên khác. Màn hình duyệt và
 * tổng hợp toàn tổ chức của manager sẽ nằm ở {@code /api/org/**} với {@code OrgGuard}, không đặt ở
 * đây — đó là ranh giới sẵn có của repo.
 *
 * <p>Mọi endpoint chỉ thao tác trên dữ liệu của chính principal; không nhận {@code teacherId} từ
 * client.
 */
@RestController
@RequestMapping("/api/v2/teacher/timesheet")
@RequiredArgsConstructor
@PreAuthorize("hasRole('TEACHER')")
public class TeacherTimesheetController {

    private final TeacherTimesheetService timesheetService;
    private final TimesheetPeriodService periodService;

    /** Bảng công trong kỳ [from, to) kèm các buổi đã qua mà chưa ghi công. */
    @GetMapping
    public TimesheetSummaryDto mySheet(
            @AuthenticationPrincipal User teacher,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime to) {
        return timesheetService.mySheet(teacher.getId(), from, to);
    }

    @PostMapping("/records")
    @ResponseStatus(HttpStatus.CREATED)
    public SessionRecordDto record(@AuthenticationPrincipal User teacher,
                                   @RequestBody RecordTeachingRequest req) {
        return timesheetService.record(teacher.getId(), req);
    }

    @PutMapping("/records/{recordId}")
    public SessionRecordDto updateRecord(@AuthenticationPrincipal User teacher,
                                         @PathVariable Long recordId,
                                         @RequestBody RecordTeachingRequest req) {
        return timesheetService.updateRecord(teacher.getId(), recordId, req);
    }

    // ── kỳ công ───────────────────────────────────────────────────────────────

    /** Kỳ công phủ [from, to]; tạo mới ở trạng thái OPEN nếu chưa có. */
    @PostMapping("/periods")
    public PeriodDto openPeriod(
            @AuthenticationPrincipal User teacher,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) java.time.LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) java.time.LocalDate to) {
        return periodService.openPeriod(teacher.getId(), from, to);
    }

    @GetMapping("/periods")
    public java.util.List<PeriodDto> myPeriods(@AuthenticationPrincipal User teacher) {
        return periodService.myPeriods(teacher.getId());
    }

    /** Nộp kỳ cho manager duyệt. Sau bước này, dòng công trong kỳ bị đóng băng. */
    @PostMapping("/periods/{periodId}/submit")
    public PeriodDto submit(@AuthenticationPrincipal User teacher, @PathVariable Long periodId) {
        return periodService.submit(teacher.getId(), periodId);
    }

    @DeleteMapping("/records/{recordId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteRecord(@AuthenticationPrincipal User teacher, @PathVariable Long recordId) {
        timesheetService.deleteRecord(teacher.getId(), recordId);
    }
}
