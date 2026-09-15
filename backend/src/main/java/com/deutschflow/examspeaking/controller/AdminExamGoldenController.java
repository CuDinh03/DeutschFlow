package com.deutschflow.examspeaking.controller;

import com.deutschflow.common.audit.AuditActor;
import com.deutschflow.common.audit.AuditLogService;
import com.deutschflow.common.audit.AuditOrgResolver;
import com.deutschflow.examspeaking.dto.GoldenView;
import com.deutschflow.examspeaking.golden.ExamGoldenService;
import com.deutschflow.user.entity.User;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import com.deutschflow.common.exception.BadRequestException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;

import java.util.List;
import java.util.Map;

/**
 * G.1 Golden set (ADMIN): danh sách phiên mock đã có kết quả máy → phiếu chấm tay của giám khảo
 * người → so sánh đồng thuận máy↔người (gate ra mắt: đạt/trượt ≥85%, ±1 band ≥90%) → CSV →
 * regrade (regression, TỐN token LLM — chỉ chạy khi hiệu chuẩn).
 *
 * <p><b>Ghi vết đường ĐỌC (DEC-13, owner chốt 09/09/2026).</b> Quy ước cũ của repo là "mọi mutation
 * ghi vết, mọi đường đọc câm". Với màn này quy ước đó sai: {@link #detail} là đường DUY NHẤT trong
 * cả hệ thống trả về GIỌNG NÓI THẬT của học viên ({@link GoldenView.TurnLine#audioUrl()} là link
 * presigned ~1h), và chiến dịch hiệu chuẩn có học viên dưới 18 tuổi. Đọc ở đây là một thao tác chạm
 * dữ liệu của trung tâm, nên phải để lại vết mà chính giám đốc trung tâm đó đọc được.
 *
 * <p><b>Vết chỉ mang ĐỊNH DANH và SỐ LƯỢNG.</b> Không transcript, không {@code audioUrl}: sổ hoạt
 * động hiển thị cho giám đốc trung tâm VÀ cho mọi admin nền tảng qua {@code /api/admin/audit-logs},
 * nên chép nội dung vào metadata là mở thêm một cửa rò rỉ ngay trong công cụ dựng ra để đóng cửa.
 */
@RestController
@RequestMapping("/api/admin/speaking/exam/golden")
@PreAuthorize("hasRole('ADMIN')")
@RequiredArgsConstructor
@Slf4j
public class AdminExamGoldenController {

    /** Byte Order Mark UTF-8 cho file CSV tải về (Excel Windows nhận diện UTF-8). */
    static final String UTF8_BOM = "\uFEFF";

    private final ExamGoldenService goldenService;
    private final AuditLogService auditLogService;
    private final AuditOrgResolver auditOrgResolver;
    private final JdbcTemplate jdbcTemplate;

    @GetMapping("/sessions")
    public List<GoldenView.SessionRow> sessions(@RequestParam(required = false) String provider,
                                                @RequestParam(required = false) String level) {
        return goldenService.listSessions(provider, level);
    }

    /**
     * Phiếu chấm của MỘT phiên — kèm transcript từng lượt và, với phiên hiệu chuẩn đã đồng ý lưu
     * audio, link nghe lại giọng thật của học viên.
     *
     * <p>Tra trung tâm TRƯỚC khi gọi service, cùng nếp với {@code AdminManagementController}: đây là
     * nếp chung cho mọi đường admin chạm một đối tượng, để không phải xét lại từng đường xem service
     * có gỡ đối tượng khỏi trung tâm hay không.
     */
    @GetMapping("/sessions/{id}")
    public GoldenView.Detail detail(@AuthenticationPrincipal User user, @PathVariable long id) {
        Long touchedOrgId = orgOfSessionOwner(id);
        GoldenView.Detail out = goldenService.detail(id, user.getId());
        int turns = out.turns() == null ? 0 : out.turns().size();
        long audioTurns = out.turns() == null ? 0L : out.turns().stream()
                .filter(t -> t.audioUrl() != null && !t.audioUrl().isBlank())
                .count();
        // CÓ hay KHÔNG có audio, và bao nhiêu lượt — đủ để giám đốc biết lần đọc này có chạm giọng
        // nói hay chỉ chạm transcript. Nội dung lượt nói và link presigned thì tuyệt đối không chép.
        audit("admin.exam_golden.session.read", user, "EXAM_GOLDEN", String.valueOf(id), touchedOrgId,
                Map.of("sessionId", id, "turns", turns, "audioTurns", audioTurns, "hasAudio", audioTurns > 0));
        return out;
    }

    @PutMapping("/sessions/{id}/ratings")
    public GoldenView.SaveResult saveRatings(@AuthenticationPrincipal User user, @PathVariable long id,
                                             @RequestBody Map<String, List<GoldenView.RatingRow>> body) {
        return goldenService.saveRatings(user.getId(), id, body == null ? null : body.get("ratings"));
    }

    @GetMapping("/compare")
    public GoldenView.CompareReport compare(@RequestParam(required = false) String provider,
                                            @RequestParam(required = false) String level) {
        return goldenService.compare(provider, level);
    }

    @GetMapping(value = "/export.csv", produces = "text/csv")
    public ResponseEntity<String> exportCsv(@RequestParam(required = false) String provider,
                                            @RequestParam(required = false) String level,
                                            @AuthenticationPrincipal User user) {
        String csv = goldenService.exportCsv(provider, level);
        // R-L7/C2 (03/09/2026): CSV này mang tên người chấm + band điểm hiệu chuẩn — export dữ liệu
        // nội bộ, phải để lại vết (ai/khi nào) và cấm cache như các export PII khác.
        //
        // orgId = null: bộ golden trải nhiều trung tâm nên không có org đơn trị để gán (xem ghi chú
        // ở #audit). Vết vẫn ghi, chỉ là rơi vào sổ hệ thống chứ không vào sổ của một giám đốc.
        audit("admin.exam_golden.exported", user, "EXAM_GOLDEN", null, null,
                Map.of("provider", String.valueOf(provider), "level", String.valueOf(level)));
        // BOM UTF-8 (U+FEFF) đứng đầu: Excel trên Windows mở CSV không BOM theo ANSI → tên người
        // chấm tiếng Việt ("Prüferin", "Nguyễn…") thành mojibake. Cùng cách với web `lib/orgCsv.ts`.
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .contentType(MediaType.parseMediaType("text/csv; charset=utf-8"))
                .header("Content-Disposition", "attachment; filename=\"golden-set.csv\"")
                .body(UTF8_BOM + csv);
    }

    /** Regression: chấm LẠI phiên trên transcript đóng băng — không ghi đè kết quả lưu. */
    @PostMapping("/sessions/{id}/regrade")
    public GoldenView.RegradeResult regrade(@AuthenticationPrincipal User user, @PathVariable long id) {
        return goldenService.regrade(id, user.getId());
    }

    /**
     * Regression harness (tài liệu gate §6.3): regrade cả bộ golden của một hệ×cấp. TỐN token thật
     * (≈12k/phiên) nên trần cứng {@link ExamGoldenService#REGRADE_BATCH_MAX} và để lại vết audit.
     */
    @PostMapping("/regrade-batch")
    public GoldenView.RegradeBatchResult regradeBatch(@AuthenticationPrincipal User user,
                                                      @RequestParam(required = false) String provider,
                                                      @RequestParam(required = false) String level,
                                                      @RequestParam(defaultValue = "true") boolean ratedOnly,
                                                      @RequestParam(defaultValue = "100") int limit) {
        if (limit < 1 || limit > ExamGoldenService.REGRADE_BATCH_MAX) {
            throw new BadRequestException("limit phải trong 1.." + ExamGoldenService.REGRADE_BATCH_MAX + " (ngân sách gate).");
        }
        GoldenView.RegradeBatchResult out = goldenService.regradeBatch(provider, level, ratedOnly, limit, user.getId());
        audit("admin.exam_golden.regrade_batch", user, "EXAM_GOLDEN", null, null,
                Map.of("provider", String.valueOf(provider), "level", String.valueOf(level),
                        "ratedOnly", ratedOnly, "requested", out.requested(), "regraded", out.regraded(),
                        "failed", out.failed()));
        return out;
    }

    // ── Chiến dịch hiệu chuẩn: người đồng ý lưu audio + dọn audio ───────────────────────────

    /**
     * Danh sách người đã đồng ý lưu audio — trả về displayName + email, tức PII đích danh của học
     * viên, nên đường đọc này cũng phải có vết.
     */
    @GetMapping("/participants")
    public List<GoldenView.Participant> participants(@AuthenticationPrincipal User user) {
        List<GoldenView.Participant> out = goldenService.listParticipants();
        // orgId = null: danh sách trải mọi trung tâm, không có org đơn trị để gán (xem #audit).
        audit("admin.exam_golden.participants.read", user, "EXAM_GOLDEN", null, null,
                Map.of("count", out.size()));
        return out;
    }

    /**
     * Body: {"userId":123,"consentedAt":"2026-08-26T10:00:00Z","note":"ký giấy 26/08"}
     *
     * <p>Đây là thao tác BẬT ghi âm cho một học viên đích danh — từ đây phiên MOCK của người đó giữ
     * lại giọng nói thật trên S3. Theo DEC-13 việc BẬT đáng ghi vết hơn việc tắt, nên vết ở đây bắt
     * buộc; {@code note} là chữ tự do của admin nên chỉ ghi CÓ/KHÔNG, không chép nội dung.
     */
    @PostMapping("/participants")
    public GoldenView.Participant addParticipant(@AuthenticationPrincipal User user,
                                                 @RequestBody Map<String, Object> body) {
        Object rawId = body.get("userId");
        if (rawId == null) {
            throw new BadRequestException("userId là bắt buộc");
        }
        long userId = Long.parseLong(String.valueOf(rawId));
        Object rawAt = body.get("consentedAt");
        Instant consentedAt = rawAt == null || String.valueOf(rawAt).isBlank()
                ? Instant.now() : Instant.parse(String.valueOf(rawAt));
        Object note = body.get("note");
        String noteText = note == null ? null : String.valueOf(note);
        Long touchedOrgId = orgOfUser(userId);
        GoldenView.Participant out = goldenService.addParticipant(user.getId(), userId, consentedAt, noteText);
        audit("admin.exam_golden.participant.added", user, "USER", String.valueOf(userId), touchedOrgId,
                Map.of("userId", userId, "consentedAt", String.valueOf(out.consentedAt()),
                        "hasNote", noteText != null && !noteText.isBlank()));
        return out;
    }

    /** Rút lại đồng ý: gỡ khỏi chiến dịch + xoá vĩnh viễn audio đã lưu (transcript giữ nguyên). */
    @DeleteMapping("/participants/{userId}")
    public Map<String, Object> removeParticipant(@AuthenticationPrincipal User user, @PathVariable long userId) {
        // Tra trung tâm TRƯỚC khi service chạy: sau khi xoá bản ghi đồng ý thì không còn đường nào
        // nối phiên hiệu chuẩn về người này nữa.
        Long touchedOrgId = orgOfUser(userId);
        int audioDeleted = goldenService.removeParticipant(userId);
        audit("admin.exam_golden.participant.removed", user, "USER", String.valueOf(userId), touchedOrgId,
                Map.of("userId", userId, "audioDeleted", audioDeleted));
        return Map.of("userId", userId, "audioDeleted", audioDeleted);
    }

    /** Xoá audio của MỘT phiên (dọn dẹp/lỗi ghi âm); transcript và điểm giữ nguyên. */
    @DeleteMapping("/sessions/{id}/audio")
    public GoldenView.PurgeResult purgeAudio(@AuthenticationPrincipal User user, @PathVariable long id) {
        Long touchedOrgId = orgOfSessionOwner(id);
        GoldenView.PurgeResult out = goldenService.purgeAudio(id);
        audit("admin.exam_golden.audio.purged", user, "EXAM_GOLDEN", String.valueOf(id), touchedOrgId,
                Map.of("sessionId", id, "deleted", out.deleted(), "failed", out.failed()));
        return out;
    }

    // ── Ghi vết: helper fail-open ───────────────────────────────────────────────────────────

    /**
     * Ghi vết mà KHÔNG bao giờ làm hỏng response.
     *
     * <p><b>Vì sao nuốt lỗi.</b> Cột {@code audit_logs.org_id} có khoá ngoại tới {@code organizations(id)};
     * một orgId hỏng (trung tâm vừa bị xoá, dữ liệu lệch) sẽ biến một lần đọc ĐÃ THÀNH CÔNG thành
     * 500 trả về client — đúng thứ mà một lớp ghi vết không được phép gây ra. Tiền lệ ở
     * {@code GlobalExceptionHandler} (vết blocked-attempt) cũng nuốt kèm {@code log.error}: lỗi phải
     * hiện ra ở giám sát chứ không im lặng.
     *
     * <p><b>Vì sao ghi Ở CONTROLLER chứ không ở service — ĐỪNG "sửa cho đúng chuẩn".</b>
     * {@code AuditActor} nêu quy ước NGƯỢC LẠI (ghi trong service để vết nằm trong transaction
     * nghiệp vụ). Quy ước đó không áp dụng được cho các đường ĐỌC ở đây: chúng là
     * {@code @Transactional(readOnly = true)}, mà {@code AuditLogService} lấy connection qua
     * {@code DataSourceUtils} nên dùng chung connection với JPA ⇒ INSERT sẽ nổ
     * <em>"cannot execute INSERT in a read-only transaction"</em>. Dời lời gọi này xuống service là
     * làm vỡ endpoint, không phải dọn dẹp.
     */
    private void audit(String eventName, User actor, String targetType, String targetId,
                       Long touchedOrgId, Map<String, Object> metadata) {
        try {
            auditLogService.log(eventName, AuditActor.of(actor), targetType, targetId, touchedOrgId, metadata);
        } catch (Exception e) {
            log.error("Không ghi được vết {} (target={}/{}): {}", eventName, targetType, targetId, e.toString());
        }
    }

    /**
     * Trung tâm của CHỦ NHÂN phiên thi nói. {@code GoldenView.Detail} không mang {@code userId} (màn
     * chấm cố ý ẩn danh người học với giám khảo), nên tra thẳng bảng phiên rồi mới qua
     * {@link AuditOrgResolver} — giữ đúng một chỗ duy nhất ánh xạ người → trung tâm.
     *
     * <p>Trả {@code null} khi phiên không tồn tại, chủ phiên là người dùng B2C, hoặc chính câu tra
     * lỗi: cùng lý do fail-open ở {@link #audit} — không được để bước ghi vết đánh sập một lần đọc.
     */
    private Long orgOfSessionOwner(long sessionId) {
        try {
            Long ownerUserId = jdbcTemplate.query(
                    "SELECT user_id FROM speaking_exam_sessions WHERE id = ?",
                    rs -> rs.next() ? (Long) rs.getObject(1) : null,
                    sessionId);
            return auditOrgResolver.forUser(ownerUserId);
        } catch (Exception e) {
            log.error("Không tra được trung tâm của phiên thi nói {}: {}", sessionId, e.toString());
            return null;
        }
    }

    /** Như {@link #orgOfSessionOwner} nhưng cho đối tượng là một NGƯỜI (chiến dịch hiệu chuẩn). */
    private Long orgOfUser(long userId) {
        try {
            return auditOrgResolver.forUser(userId);
        } catch (Exception e) {
            log.error("Không tra được trung tâm của người dùng {}: {}", userId, e.toString());
            return null;
        }
    }

}
