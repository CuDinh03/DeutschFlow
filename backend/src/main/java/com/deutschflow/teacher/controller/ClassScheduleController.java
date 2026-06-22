package com.deutschflow.teacher.controller;

import com.deutschflow.teacher.dto.ClassSchedulePatternDto;
import com.deutschflow.teacher.dto.ClassSessionDto;
import com.deutschflow.teacher.dto.CreateSessionRequest;
import com.deutschflow.teacher.dto.SessionSaveResult;
import com.deutschflow.teacher.dto.UpdateSessionRequest;
import com.deutschflow.teacher.dto.UpsertPatternRequest;
import com.deutschflow.teacher.dto.UpsertPatternResult;
import com.deutschflow.teacher.service.ClassScheduleService;
import com.deutschflow.user.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Lịch buổi lớp của giáo viên (Pha 2). Tất cả endpoint ghi đều qua guard "dạy lớp này"
 * trong service (chống IDOR).
 */
@RestController
@RequestMapping("/api/v2/teacher/class-schedule")
@RequiredArgsConstructor
@PreAuthorize("hasRole('TEACHER')")
public class ClassScheduleController {

    private final ClassScheduleService service;

    /** Lịch tuần buổi lớp của giáo viên hiện tại. */
    @GetMapping("/week")
    public List<ClassSessionDto> week(
            @AuthenticationPrincipal User teacher,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime to) {
        return service.weekForTeacher(teacher.getId(), from, to);
    }

    /** Lịch cố định của một lớp. */
    @GetMapping("/classes/{classId}/patterns")
    public List<ClassSchedulePatternDto> patterns(@AuthenticationPrincipal User teacher,
                                                  @PathVariable Long classId) {
        return service.patternsForClass(teacher.getId(), classId);
    }

    /** Đặt/đổi lịch cố định cho một thứ của lớp (regenerate giữ buổi đã chỉnh tay). */
    @PutMapping("/classes/{classId}/pattern")
    public UpsertPatternResult upsertPattern(@AuthenticationPrincipal User teacher,
                                             @PathVariable Long classId,
                                             @RequestBody UpsertPatternRequest req) {
        return service.upsertPattern(teacher.getId(), classId, req);
    }

    /** Xoá lịch cố định (giữ buổi đã chỉnh tay). */
    @DeleteMapping("/patterns/{patternId}")
    public int deletePattern(@AuthenticationPrincipal User teacher, @PathVariable Long patternId) {
        return service.deletePattern(teacher.getId(), patternId);
    }

    /** Thêm một buổi lớp lẻ. */
    @PostMapping("/classes/{classId}/sessions")
    public SessionSaveResult createSession(@AuthenticationPrincipal User teacher,
                                           @PathVariable Long classId,
                                           @RequestBody CreateSessionRequest req) {
        return service.createSession(teacher.getId(), classId, req);
    }

    /** Sửa một buổi (đổi giờ/phòng/trạng thái) — cảnh báo mềm nếu trùng phòng. */
    @PatchMapping("/sessions/{id}")
    public SessionSaveResult updateSession(@AuthenticationPrincipal User teacher,
                                           @PathVariable Long id,
                                           @RequestBody UpdateSessionRequest req) {
        return service.updateSession(teacher.getId(), id, req);
    }
}
