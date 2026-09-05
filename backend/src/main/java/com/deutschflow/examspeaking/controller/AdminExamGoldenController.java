package com.deutschflow.examspeaking.controller;

import com.deutschflow.common.audit.AuditActor;
import com.deutschflow.common.audit.AuditLogService;
import com.deutschflow.examspeaking.dto.GoldenView;
import com.deutschflow.examspeaking.golden.ExamGoldenService;
import com.deutschflow.user.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import com.deutschflow.common.exception.BadRequestException;
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
 */
@RestController
@RequestMapping("/api/admin/speaking/exam/golden")
@PreAuthorize("hasRole('ADMIN')")
@RequiredArgsConstructor
public class AdminExamGoldenController {

    /** Byte Order Mark UTF-8 cho file CSV tải về (Excel Windows nhận diện UTF-8). */
    static final String UTF8_BOM = "\uFEFF";

    private final ExamGoldenService goldenService;
    private final AuditLogService auditLogService;

    @GetMapping("/sessions")
    public List<GoldenView.SessionRow> sessions(@RequestParam(required = false) String provider,
                                                @RequestParam(required = false) String level) {
        return goldenService.listSessions(provider, level);
    }

    @GetMapping("/sessions/{id}")
    public GoldenView.Detail detail(@AuthenticationPrincipal User user, @PathVariable long id) {
        return goldenService.detail(id, user.getId());
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
        auditLogService.log("admin.exam_golden.exported", AuditActor.of(user),
                "EXAM_GOLDEN", null,
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
        auditLogService.log("admin.exam_golden.regrade_batch", AuditActor.of(user),
                "EXAM_GOLDEN", null,
                Map.of("provider", String.valueOf(provider), "level", String.valueOf(level),
                        "ratedOnly", ratedOnly, "requested", out.requested(), "regraded", out.regraded(),
                        "failed", out.failed()));
        return out;
    }

    // ── Chiến dịch hiệu chuẩn: người đồng ý lưu audio + dọn audio ───────────────────────────

    @GetMapping("/participants")
    public List<GoldenView.Participant> participants() {
        return goldenService.listParticipants();
    }

    /** Body: {"userId":123,"consentedAt":"2026-08-26T10:00:00Z","note":"ký giấy 26/08"} */
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
        return goldenService.addParticipant(user.getId(), userId, consentedAt, note == null ? null : String.valueOf(note));
    }

    /** Rút lại đồng ý: gỡ khỏi chiến dịch + xoá vĩnh viễn audio đã lưu (transcript giữ nguyên). */
    @DeleteMapping("/participants/{userId}")
    public Map<String, Object> removeParticipant(@PathVariable long userId) {
        return Map.of("userId", userId, "audioDeleted", goldenService.removeParticipant(userId));
    }

    /** Xoá audio của MỘT phiên (dọn dẹp/lỗi ghi âm); transcript và điểm giữ nguyên. */
    @DeleteMapping("/sessions/{id}/audio")
    public GoldenView.PurgeResult purgeAudio(@PathVariable long id) {
        return goldenService.purgeAudio(id);
    }

}
