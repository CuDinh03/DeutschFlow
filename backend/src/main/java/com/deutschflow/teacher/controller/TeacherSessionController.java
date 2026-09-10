package com.deutschflow.teacher.controller;

import com.deutschflow.common.audit.AuditActor;
import com.deutschflow.common.audit.AuditLogService;
import com.deutschflow.common.audit.AuditOrgResolver;
import com.deutschflow.teacher.dto.TeacherSessionDto;
import com.deutschflow.teacher.service.TeacherSessionService;
import com.deutschflow.user.entity.User;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/teacher-sessions")
@RequiredArgsConstructor
@Slf4j
public class TeacherSessionController {

    private final TeacherSessionService sessionService;
    private final AuditLogService auditLogService;
    private final AuditOrgResolver auditOrgResolver;

    // ── Student: book ─────────────────────────────────────────────────────────

    @PostMapping
    @PreAuthorize("hasRole('STUDENT')")   // 1:1 marketplace is a B2C product for learners (G-1)
    public ResponseEntity<TeacherSessionDto> book(
            @AuthenticationPrincipal User student,
            @RequestBody @Valid BookRequest req) {
        return ResponseEntity.ok(sessionService.bookSession(
                student, req.teacherProfileId(), req.title(), req.notes(),
                req.scheduledAt(), req.durationMinutes()));
    }

    // ── Student: my sessions ──────────────────────────────────────────────────

    @GetMapping("/my")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Page<TeacherSessionDto>> mySessions(
            @AuthenticationPrincipal User student,
            @RequestParam(defaultValue = "0") int page) {
        return ResponseEntity.ok(sessionService.getStudentSessions(student.getId(), page));
    }

    // ── Teacher: incoming sessions ────────────────────────────────────────────

    /**
     * Lịch dạy của một hồ sơ. {@code TeacherSessionService.assertOwnsProfile} cho ADMIN đi thẳng
     * qua cổng chống IDOR — break-glass hợp lệ, nhưng phải để lại vết (DEC-13).
     */
    @GetMapping("/teacher")
    @PreAuthorize("hasAnyRole('TEACHER','ADMIN')")
    public ResponseEntity<Page<TeacherSessionDto>> teacherSessions(
            @AuthenticationPrincipal User actor,
            @RequestParam Long profileId,
            @RequestParam(defaultValue = "0") int page) {
        Page<TeacherSessionDto> result = sessionService.getTeacherSessions(actor, profileId, page);
        auditBreakGlass("admin.teacher_session.schedule.read", actor, profileId,
                Map.of("profileId", profileId, "page", page, "sessions", result.getNumberOfElements()));
        return ResponseEntity.ok(result);
    }

    // ── Teacher: confirm / complete / cancel ──────────────────────────────────

    @PatchMapping("/{id}/status")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<TeacherSessionDto> updateStatus(
            @AuthenticationPrincipal User actor,
            @PathVariable Long id,
            @RequestBody UpdateStatusRequest req) {
        return ResponseEntity.ok(sessionService.updateStatus(actor, id, req.status(), req.teacherNotes()));
    }

    // ── Student: submit review ────────────────────────────────────────────────

    @PostMapping("/{id}/review")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<TeacherSessionDto> submitReview(
            @AuthenticationPrincipal User student,
            @PathVariable Long id,
            @RequestBody @Valid ReviewRequest req) {
        return ResponseEntity.ok(sessionService.submitReview(student, id, req.rating(), req.reviewText()));
    }

    // ── Teacher: earnings ─────────────────────────────────────────────────────

    /**
     * Doanh thu của một hồ sơ — cùng cổng break-glass với {@link #teacherSessions}, nên cùng vết.
     *
     * <p>Vết KHÔNG chép con số doanh thu: chính nó là dữ liệu bị đọc, mà sổ hoạt động lại hiện cho
     * mọi admin nền tảng qua {@code /api/admin/audit-logs}. Ghi ĐỊNH DANH hồ sơ là đủ để trả lời
     * "ai đã xem doanh thu của tôi, lúc nào".
     */
    @GetMapping("/earnings")
    @PreAuthorize("hasAnyRole('TEACHER','ADMIN')")
    public ResponseEntity<Map<String, Object>> earnings(
            @AuthenticationPrincipal User actor,
            @RequestParam Long profileId) {
        Map<String, Object> summary = sessionService.getEarningsSummary(actor, profileId);
        auditBreakGlass("admin.teacher_session.earnings.read", actor, profileId,
                Map.of("profileId", profileId));
        return ResponseEntity.ok(summary);
    }

    // ── Admin: pending payouts ────────────────────────────────────────────────

    /**
     * Hàng chờ chi trả — danh sách phiên kèm tên học viên và tên giáo viên của MỌI hồ sơ.
     *
     * <p>{@code orgId} để NULL và ở riêng đường này NULL là ĐÚNG, không phải lỗ hổng: chợ 1:1 là
     * B2C, {@code TeacherSessionService.bookSession} chặn giáo viên thuộc trung tâm (G-1) nên phiên
     * ở đây không bao giờ là dữ liệu của một trung tâm — cùng lập luận đã ghi tại
     * {@code markPayoutProcessed}. Nếu sau này chợ mở cho giáo viên trung tâm thì đường này phải
     * chia vết theo từng trung tâm bị chạm, đừng gán bừa một giá trị cho cả danh sách.
     */
    @GetMapping("/admin/pending-payouts")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<List<TeacherSessionDto>> pendingPayouts(@AuthenticationPrincipal User actor) {
        List<TeacherSessionDto> pending = sessionService.getPendingPayouts();
        audit("admin.teacher_session.pending_payouts.read", actor, null, null,
                Map.of("count", pending.size()));
        return ResponseEntity.ok(pending);
    }

    @PostMapping("/admin/mark-paid")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> markPaid(@RequestBody List<Long> sessionIds,
                                         @AuthenticationPrincipal User actor) {
        sessionService.markPayoutProcessed(sessionIds, AuditActor.of(actor));
        return ResponseEntity.ok().build();
    }

    // ── Ghi vết break-glass (DEC-13) ──────────────────────────────────────────

    /**
     * Ghi vết KHI VÀ CHỈ KHI người gọi là ADMIN và không phải chủ hồ sơ.
     *
     * <p><b>Vì sao cần.</b> {@code assertOwnsProfile} có một dòng {@code if (role == ADMIN) return;}
     * — cổng chống IDOR mở thẳng cho admin nền tảng đọc lịch dạy và doanh thu của mọi giáo viên.
     * Quyền kỹ thuật đó được giữ (DEC-13), nhưng nó đang là break-glass DUY NHẤT trong repo không có
     * vết, ngược hẳn khuôn {@code AdminTeacherService.breakGlassViewTeacher}.
     *
     * <p>Giáo viên tự xem hồ sơ mình thì KHÔNG ghi: đó là công việc thường ngày, ghi vào sổ chỉ làm
     * loãng đúng thứ giám đốc cần thấy. Chỉ tra chủ hồ sơ khi actor là ADMIN, nên đường đi thường
     * ngày của giáo viên không tốn thêm truy vấn nào.
     */
    private void auditBreakGlass(String eventName, User actor, Long profileId, Map<String, Object> metadata) {
        if (actor == null || actor.getRole() != User.Role.ADMIN) {
            return;
        }
        try {
            Long ownerUserId = sessionService.teacherProfileOwnerUserId(profileId);
            if (ownerUserId != null && ownerUserId.equals(actor.getId())) {
                return;   // admin đang xem chính hồ sơ của mình — không phải break-glass
            }
            audit(eventName, actor, String.valueOf(profileId), auditOrgResolver.forUser(ownerUserId), metadata);
        } catch (Exception e) {
            log.error("Không ghi được vết break-glass {} (profileId={}): {}", eventName, profileId, e.toString());
        }
    }

    /**
     * Ghi vết mà KHÔNG bao giờ làm hỏng response.
     *
     * <p><b>Vì sao nuốt lỗi.</b> {@code audit_logs.org_id} có khoá ngoại tới {@code organizations(id)};
     * một orgId hỏng sẽ biến một lần đọc ĐÃ THÀNH CÔNG thành 500 trả về client. Tiền lệ fail-open:
     * {@code GlobalExceptionHandler} khi ghi vết blocked-attempt — nuốt kèm {@code log.error} để lỗi
     * vẫn hiện ra ở giám sát chứ không im lặng.
     *
     * <p><b>Vì sao ghi Ở CONTROLLER — ĐỪNG "sửa cho đúng chuẩn".</b> {@code AuditActor} nêu quy ước
     * ngược lại (ghi trong service để vết nằm trong transaction nghiệp vụ), và
     * {@code markPayoutProcessed} theo đúng quy ước đó vì nó là MUTATION. Các đường đọc thì không
     * theo được: {@code AuditLogService} lấy connection qua {@code DataSourceUtils} nên dùng chung
     * connection với JPA, và một INSERT trong transaction {@code readOnly = true} sẽ nổ
     * <em>"cannot execute INSERT in a read-only transaction"</em>. Dời xuống service là làm vỡ endpoint.
     */
    private void audit(String eventName, User actor, String targetId, Long touchedOrgId,
                       Map<String, Object> metadata) {
        try {
            auditLogService.log(eventName, AuditActor.of(actor), "TEACHER_SESSION", targetId,
                    touchedOrgId, metadata);
        } catch (Exception e) {
            log.error("Không ghi được vết {} (target={}): {}", eventName, targetId, e.toString());
        }
    }

    // ── Request records ───────────────────────────────────────────────────────

    public record BookRequest(
            @NotNull Long teacherProfileId,
            @NotBlank String title,
            String notes,
            @NotNull LocalDateTime scheduledAt,
            @Min(30) @Max(120) int durationMinutes
    ) {}

    public record UpdateStatusRequest(
            @NotBlank String status,
            String teacherNotes
    ) {}

    public record ReviewRequest(
            @Min(1) @Max(5) short rating,
            String reviewText
    ) {}
}
