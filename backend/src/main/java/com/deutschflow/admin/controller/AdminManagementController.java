package com.deutschflow.admin.controller;

import com.deutschflow.admin.service.AdminManagementService;
import com.deutschflow.admin.dto.AdminUpdateLearningProfileRequest;
import com.deutschflow.user.dto.AdminUpdateProfileRequest;
import com.deutschflow.notification.service.UserNotificationService;
import com.deutschflow.common.audit.AuditActor;
import com.deutschflow.common.audit.AuditLogService;
import com.deutschflow.common.audit.AuditOrgResolver;
import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.vocabulary.service.DeepLLemmaBackfillService;
import com.deutschflow.vocabulary.service.GlosbeViEnrichmentService;
import com.deutschflow.vocabulary.service.GlosbeVocabularyImportService;
import com.deutschflow.vocabulary.service.GoetheOfficialWordlistImportService;
import com.deutschflow.vocabulary.service.GoetheVocabularyAutoImportService;
import com.deutschflow.vocabulary.service.OfficialCefrVocabularyImportService;
import com.deutschflow.vocabulary.service.VocabularyCleanupService;
import com.deutschflow.vocabulary.service.TagQueryService;
import com.deutschflow.vocabulary.service.VocabularyAutoTaggingService;
import com.deutschflow.vocabulary.service.VocabularyResetService;
import com.deutschflow.vocabulary.service.WiktionaryIpaBatchService;
import com.deutschflow.vocabulary.service.WiktionaryEnrichmentBatchService;
import com.deutschflow.vocabulary.service.LlmViTranslationService;
import com.deutschflow.vocabulary.service.LlmDtypeFixService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.CacheManager;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;
import com.deutschflow.user.entity.User;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;

@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
@Slf4j
@PreAuthorize("hasRole('ADMIN')")
public class AdminManagementController {
    private static final Set<String> VALID_CEFR_LEVELS = Set.of("A1", "A2", "B1", "B2", "C1", "C2");

    private final AdminManagementService adminManagementService;
    private final GoetheVocabularyAutoImportService goetheVocabularyAutoImportService;
    private final GlosbeVocabularyImportService glosbeVocabularyImportService;
    private final GlosbeViEnrichmentService glosbeViEnrichmentService;
    private final DeepLLemmaBackfillService deepLLemmaBackfillService;
    private final OfficialCefrVocabularyImportService officialCefrVocabularyImportService;
    private final GoetheOfficialWordlistImportService goetheOfficialWordlistImportService;
    private final WiktionaryIpaBatchService wiktionaryIpaBatchService;
    private final WiktionaryEnrichmentBatchService wiktionaryEnrichmentBatchService;
    private final VocabularyCleanupService vocabularyCleanupService;
    private final VocabularyResetService vocabularyResetService;
    private final VocabularyAutoTaggingService vocabularyAutoTaggingService;
    private final TagQueryService tagQueryService;
    private final AuditLogService auditLogService;
    private final AuditOrgResolver auditOrgResolver;
    private final UserNotificationService userNotificationService;
    private final CacheManager cacheManager;
    private final LlmViTranslationService llmViTranslationService;
    private final LlmDtypeFixService llmDtypeFixService;
    private final JdbcTemplate jdbcTemplate;

    // ── Cache Management ──────────────────────────────────────────────────

    /**
     * Force-clear a named Caffeine cache.
     * POST /api/admin/cache/purge?name={cacheName}
     *
     * Available cache names:
     *   tags, words, subscriptionPlans, curriculum, achievements,
     *   weeklyPrompts, aiVocabCache, aiVocabShort, aiVocabQuiz, ttsAudio
     *
     * Use this as an emergency safety valve when stale cached data
     * needs to be evicted immediately (e.g. after a bulk vocab import).
     */
    @PostMapping("/cache/purge")
    public ResponseEntity<Map<String, Object>> purgeCache(
            @RequestParam String name,
            Authentication authentication
    ) {
        var cache = cacheManager.getCache(name);
        if (cache == null) {
            return ResponseEntity.badRequest().body(Map.of(
                "status", "error",
                "message", "Cache '" + name + "' not found. Available: " + cacheManager.getCacheNames()
            ));
        }
        cache.clear();
        auditLogService.log("admin.cache.purged", AuditActor.ofAuthentication(authentication),
                                "CACHE", name, Map.of("action", "clear"));
        return ResponseEntity.ok(Map.of(
            "status", "ok",
            "cache", name,
            "message", "Cache '" + name + "' cleared successfully."
        ));
    }


    @GetMapping("/vocabulary/taxonomy-summary")
    public Map<String, Object> vocabularyTopicTaxonomySummary() {
        return tagQueryService.topicTaxonomyCoverageSummary();
    }

    @GetMapping("/reports/overview")
    public Map<String, Object> overview() {
        return adminManagementService.overview();
    }

    @GetMapping("/vocabulary/enrichment/status")
    public Map<String, Object> vocabularyEnrichmentStatus() {
        return adminManagementService.vocabularyEnrichmentControlStatus();
    }

    @GetMapping("/reports/student-plan-progress")
    public List<Map<String, Object>> studentPlanProgress() {
        return adminManagementService.studentPlanProgress();
    }

    @GetMapping("/reports/api-telemetry")
    public List<Map<String, Object>> apiTelemetrySummary(
            @RequestParam(defaultValue = "7") int days
    ) {
        return adminManagementService.apiTelemetrySummary(days);
    }

    @GetMapping("/reports/api-telemetry/percentiles")
    public Map<String, Object> apiTelemetryPercentiles(
            @RequestParam(defaultValue = "7") int days,
            @RequestParam(defaultValue = "/api/plan/sessions/submit") String endpoint
    ) {
        return adminManagementService.apiTelemetryPercentiles(days, endpoint);
    }

    @GetMapping("/reports/vocabulary-quality")
    public Map<String, Object> vocabularyQuality(
            @RequestParam(defaultValue = "30") int days
    ) {
        return adminManagementService.vocabularyQualityDaily(days);
    }

    @GetMapping("/reports/personalization-ruleset")
    public Map<String, Object> personalizationRuleset() {
        return adminManagementService.personalizationRuleset();
    }

    @GetMapping("/reports/grammar-feedback-coverage")
    public List<Map<String, Object>> grammarFeedbackCoverage(
            @RequestParam(defaultValue = "7") int days
    ) {
        return adminManagementService.grammarFeedbackCoverage(days);
    }

    @GetMapping("/reports/gate-checklist")
    public List<Map<String, Object>> gateChecklist(
            @RequestParam(defaultValue = "14") int days,
            @RequestParam(defaultValue = "/api/plan/sessions/submit") String endpoint
    ) {
        return adminManagementService.gateChecklist(days, endpoint);
    }

    /** Token usage aggregated from {@code ai_token_usage_events} (real ledger), read-only. */
    @GetMapping("/reports/ai-usage-by-feature")
    public Map<String, Object> aiUsageByFeature(@RequestParam(defaultValue = "30") int days) {
        return adminManagementService.aiUsageByFeature(days);
    }

    /** Daily token cost trend for the AI cost observability dashboard. */
    @GetMapping("/reports/ai-cost-daily")
    public Map<String, Object> aiCostDaily(@RequestParam(defaultValue = "14") int days) {
        return adminManagementService.aiCostDaily(days);
    }

    /**
     * Planning summary: total AI COGS, per-active-user unit economics, a 30-day run-rate
     * projection, and the cost breakdown by model and feature. Built for pricing/capacity
     * planning, not trend charting.
     */
    @GetMapping("/reports/ai-cost-summary")
    public Map<String, Object> aiCostSummary(@RequestParam(defaultValue = "30") int days) {
        return adminManagementService.aiCostSummary(days);
    }

    /** Paginated, filtered read of the audit log (admin audit screen). */
    @GetMapping("/audit")
    public Map<String, Object> auditLogs(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String cat,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "30") int size
    ) {
        return auditLogService.readAuditLogs(q, cat, page, size);
    }

    @GetMapping("/users")
    public List<Map<String, Object>> users() {
        return adminManagementService.listUsers();
    }

    /** Admin tạo tài khoản mới (mọi vai trò). Tùy chọn gán vào tổ chức (TEACHER|MANAGER). */
    @PostMapping("/users")
    public Map<String, Object> createUser(
            @Valid @RequestBody CreateUserRequest req,
            Authentication authentication
    ) {
        Map<String, Object> created = adminManagementService.createUser(
                req.email(), req.displayName(), req.password(), req.role(), req.locale(), req.orgId(), req.orgRole());
        // DEC-13: trung tâm bị tác động lấy thẳng từ KẾT QUẢ chứ không tra lại — createUser chỉ gán
        // tổ chức khi vai trò là TEACHER/MANAGER và orgId có thật, nên req.orgId() có thể đã được
        // gửi kèm rồi bị bỏ qua, còn created."orgId" là tổ chức thực sự nhận người này.
        Long touchedOrgId = created.get("orgId") instanceof Long createdOrgId ? createdOrgId : null;
        auditLogService.log(
                "admin.user.created",
                AuditActor.ofAuthentication(authentication),
                "USER",
                String.valueOf(created.get("id")),
                touchedOrgId,
                Map.of(
                        "email", String.valueOf(created.get("email")),
                        "role", String.valueOf(created.get("role")),
                        "orgId", String.valueOf(created.get("orgId")),
                        "orgRole", String.valueOf(created.get("orgRole"))
                )
        );
        // createUser() is @Transactional and has committed by now — audit the new account to admins.
        userNotificationService.onAccountProvisioned(
                Long.parseLong(String.valueOf(created.get("id"))),
                String.valueOf(created.get("email")),
                String.valueOf(created.get("displayName")),
                "ADMIN");
        return created;
    }

    /** Khóa / mở khóa tài khoản (soft-delete). Chỉ ADMIN. Không thể tự khóa chính mình. */
    @PatchMapping("/users/{userId}/active")
    public Map<String, Object> setUserActive(
            @PathVariable Long userId,
            @Valid @RequestBody SetActiveRequest req,
            @AuthenticationPrincipal User actor,
            Authentication authentication
    ) {
        if (actor != null && actor.getId().equals(userId) && Boolean.FALSE.equals(req.active())) {
            throw new BadRequestException("Bạn không thể tự khóa tài khoản của mình.");
        }
        // Tra tổ chức TRƯỚC khi gọi service — nếp chung cho cả nhóm đường admin chạm một người, để
        // không phải xét lại từng đường xem service có gỡ người khỏi trung tâm hay không. Khoá tài
        // khoản cắt sạch phiên đang chạy, nên giám đốc phải thấy lần nhân sự của mình bị nền tảng khoá.
        Long touchedOrgId = auditOrgResolver.forUser(userId);
        Map<String, Object> updated = adminManagementService.setUserActive(userId, req.active());
        auditLogService.log(
                req.active() ? "admin.user.reactivated" : "admin.user.deactivated",
                AuditActor.ofAuthentication(authentication),
                "USER",
                String.valueOf(userId),
                touchedOrgId,
                Map.of("active", req.active())
        );
        return updated;
    }

    /** Admin đặt lại mật khẩu cho user (vận hành: gỡ default-cred / hỗ trợ quên pass). Chỉ ADMIN; audit (KHÔNG log mật khẩu). */
    @PatchMapping("/users/{userId}/password")
    public Map<String, Object> setUserPassword(
            @PathVariable Long userId,
            @Valid @RequestBody SetPasswordRequest req,
            Authentication authentication
    ) {
        // Đây là đường ĐÓNG VAI: đặt lại mật khẩu của một người rồi đăng nhập là mang đúng danh
        // tính người đó — không có bước nào khác chặn lại, và endpoint này KHÔNG gửi thông báo cho
        // người bị đổi (khác createUser và updatePlan). Vết vì vậy là chứng cứ duy nhất, và nó phải
        // rơi vào sổ của trung tâm NGƯỜI BỊ ĐỔI chứ không phải sổ trống của admin nền tảng.
        Long touchedOrgId = auditOrgResolver.forUser(userId);
        Map<String, Object> updated = adminManagementService.setUserPassword(userId, req.password());
        auditLogService.log(
                "admin.user.password.reset",
                AuditActor.ofAuthentication(authentication),
                "USER",
                String.valueOf(userId),
                touchedOrgId,
                Map.of()
        );
        return updated;
    }

    @GetMapping("/plans")
    public List<Map<String, Object>> plans() {
        return adminManagementService.listPlans();
    }

    @PatchMapping("/users/{userId}/role")
    public Map<String, Object> updateRole(
            @PathVariable Long userId,
            @Valid @RequestBody UpdateRoleRequest req,
            @AuthenticationPrincipal User actor,
            Authentication authentication
    ) {
        // Đối xứng với setUserActive: không cho admin TỰ bỏ quyền của chính mình. Trên prod có lúc
        // chỉ có đúng 1 ADMIN → tự hạ quyền = khoá cứng toàn hệ thống, chỉ gỡ được bằng DB.
        if (actor != null && actor.getId().equals(userId)
                && !"ADMIN".equalsIgnoreCase(req.role() == null ? "" : req.role().trim())) {
            throw new BadRequestException("Bạn không thể tự bỏ quyền quản trị của chính mình.");
        }
        // Tra tổ chức TRƯỚC khi gọi service, cùng một nếp với setUserActive: các đường gỡ người khỏi
        // trung tâm xoá users.org_id, tra sau là tra vào chỗ đã trống. Riêng đường này service từ
        // chối thẳng người đang là thành viên ACTIVE (để org_members khỏi lệch), nên org đọc được ở
        // đây là của người còn org_id mà tư cách thành viên đã ngưng — vẫn là người của trung tâm đó.
        Long touchedOrgId = auditOrgResolver.forUser(userId);
        Map<String, Object> updated = adminManagementService.updateUserRole(userId, req.role());
        auditLogService.log(
                "admin.user.role.updated",
                AuditActor.ofAuthentication(authentication),
                "USER",
                String.valueOf(userId),
                touchedOrgId,
                Map.of(
                        "oldRole", String.valueOf(updated.get("previousRole")),
                        "newRole", String.valueOf(updated.get("role"))
                )
        );
        return updated;
    }

    @PatchMapping("/users/{userId}/plan")
    public Map<String, Object> updatePlan(
            @PathVariable Long userId,
            @Valid @RequestBody UpdatePlanRequest req,
            Authentication authentication
    ) {
        // Gói và hạn mức token của một học viên trong trung tâm là dữ liệu vận hành của trung tâm
        // đó; giám đốc cần thấy lần nền tảng chỉnh tay.
        Long touchedOrgId = auditOrgResolver.forUser(userId);
        Map<String, Object> updated = adminManagementService.updateUserPlan(
                userId,
                req.planCode(),
                req.monthlyTokenLimitOverride(),
                req.startsAtUtc(),
                req.endsAtUtc()
        );
        auditLogService.log(
                "admin.user.plan.updated",
                AuditActor.ofAuthentication(authentication),
                "USER",
                String.valueOf(userId),
                touchedOrgId,
                Map.of(
                        "planCode", String.valueOf(updated.get("planCode")),
                        "monthlyTokenLimitOverride", String.valueOf(updated.get("monthlyTokenLimitOverride")),
                        "startsAtUtc", String.valueOf(updated.get("startsAtUtc")),
                        "endsAtUtc", String.valueOf(updated.get("endsAtUtc"))
                )
        );
        User adminActor = authentication != null ? (User) authentication.getPrincipal() : null;
        if (adminActor != null) {
            userNotificationService.onLearnerPlanChangedByAdmin(
                    userId, updated, adminActor.getId(),
                    adminActor.getEmail());
        }
        return updated;
    }

    @GetMapping("/users/{userId}/quota")
    public Map<String, Object> userQuota(@PathVariable Long userId, Authentication authentication) {
        Map<String, Object> quota = adminManagementService.userQuota(userId);
        // Hạn mức và mức tiêu thụ AI của một người là dữ liệu vận hành của trung tâm người đó — sau
        // DEC-13 thì giám đốc phải đọc được lần nền tảng soi vào. Metadata để trống có chủ ý: các
        // con số đã nằm sẵn trong bảng quota, vết chỉ cần trả lời "ai, khi nào, soi ai".
        auditRead(() -> auditLogService.log(
                "admin.user.quota.read",
                AuditActor.ofAuthentication(authentication),
                "USER",
                String.valueOf(userId),
                auditOrgResolver.forUser(userId),
                Map.of()
        ));
        return quota;
    }

    @GetMapping("/users/{userId}/usage")
    public List<Map<String, Object>> userUsage(
            @PathVariable Long userId,
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to,
            @RequestParam(required = false) Integer limit,
            Authentication authentication
    ) {
        List<Map<String, Object>> rows = adminManagementService.userUsage(userId, from, to, limit);
        auditRead(() -> auditLogService.log(
                "admin.user.usage.read",
                AuditActor.ofAuthentication(authentication),
                "USER",
                String.valueOf(userId),
                auditOrgResolver.forUser(userId),
                // Khoảng thời gian + số dòng: đủ để giám đốc biết PHẠM VI bị đọc, mà không chép một
                // dòng ledger nào (mỗi dòng mang model, feature, requestId của một lần dùng thật).
                Map.of(
                        "fromUtc", String.valueOf(from),
                        "toUtc", String.valueOf(to),
                        "limit", String.valueOf(limit),
                        "returnedCount", rows.size()
                )
        ));
        return rows;
    }

    @GetMapping("/classes")
    public List<Map<String, Object>> classesList(Authentication authentication) {
        List<Map<String, Object>> classes = adminManagementService.listClasses();
        auditClassListRead(authentication, classes.size());
        return classes;
    }

    @PostMapping("/classes/{classId}/students/bulk-assign")
    public Map<String, Object> bulkAssignStudents(
            @PathVariable Long classId,
            @RequestBody @Valid BulkAssignStudentsRequest request,
            Authentication authentication
    ) {
        // Đối tượng bị tác động ở đây là LỚP, nên tra theo lớp: học viên được gán có thể chưa
        // thuộc trung tâm nào, còn lớp thì luôn nói đúng sổ nào phải nhận vết này.
        Long touchedOrgId = auditOrgResolver.forClass(classId);
        Map<String, Object> result = adminManagementService.bulkAssignStudents(classId, request.studentIds());
        auditLogService.log(
                "admin.class.students.bulk_assigned",
                AuditActor.ofAuthentication(authentication),
                "CLASS",
                String.valueOf(classId),
                touchedOrgId,
                Map.of("assignedCount", result.get("assignedCount"))
        );
        return result;
    }

    @GetMapping("/users/{userId}/learning-detail")
    public Map<String, Object> userLearningDetail(@PathVariable Long userId, Authentication authentication) {
        Map<String, Object> detail = adminManagementService.userLearningDetail(userId);
        // 🔴 Đường đọc nội dung học viên nhạy nhất của console admin: khối speakingAi.recentErrors
        // mang wrongSpan/correctedSpan — MẢNH CÂU học viên thực sự nói, không phải số liệu tổng hợp.
        // Web gọi endpoint này mỗi lần mở modal chi tiết (không đợi bấm thêm), nên nó cũng là đường
        // đọc nội dung có tần suất cao nhất.
        //
        // Vết ghi SỐ LƯỢNG mảnh câu bị phơi ra và tuyệt đối không chép mảnh nào: audit_logs là bảng
        // append-only giữ vĩnh viễn (V303) và MỌI admin nền tảng đọc được qua /api/admin/audit —
        // chép nội dung vào đây là mở thêm một cửa rò rỉ đúng thứ dữ liệu vết này sinh ra để canh.
        auditRead(() -> auditLogService.log(
                "admin.user.learning_detail.read",
                AuditActor.ofAuthentication(authentication),
                "USER",
                String.valueOf(userId),
                auditOrgResolver.forUser(userId),
                Map.of("recentErrorCount", nestedListSize(detail, "speakingAi", "recentErrors"))
        ));
        return detail;
    }

    @PutMapping("/users/{userId}/learning-profile")
    public Map<String, Object> updateLearningProfile(
            @PathVariable Long userId,
            @RequestBody @Valid AdminUpdateLearningProfileRequest request,
            Authentication authentication
    ) {
        Long touchedOrgId = auditOrgResolver.forUser(userId);
        Map<String, Object> result = adminManagementService.adminUpdateLearningProfile(userId, request);
        // Audit F-M3 (03/09/2026): admin ghi đè hồ sơ học tập của một người — trình độ, mục tiêu,
        // lộ trình — tức đổi thẳng nội dung họ sẽ được học. Trước đây không để lại vết nào, nên
        // người học thấy lộ trình đổi mà không ai giải thích được vì sao.
        auditLogService.log(
                "admin.user.learning_profile.updated",
                AuditActor.ofAuthentication(authentication),
                "USER",
                String.valueOf(userId),
                touchedOrgId,
                learningProfileAuditMeta(request)
        );
        return result;
    }

    /**
     * Admin override: cập nhật displayName / phoneNumber trực tiếp không cần OTP.
     * PATCH /api/admin/users/{userId}/profile
     */
    @PatchMapping("/users/{userId}/profile")
    public Map<String, Object> adminUpdateProfile(
            @PathVariable Long userId,
            @Valid @RequestBody AdminUpdateProfileRequest request,
            Authentication authentication
    ) {
        Long touchedOrgId = auditOrgResolver.forUser(userId);
        Map<String, Object> result = adminManagementService.adminUpdateProfile(userId, request);
        auditLogService.log(
                "admin.user.profile.updated",
                AuditActor.ofAuthentication(authentication),
                "USER",
                String.valueOf(userId),
                touchedOrgId,
                // Audit F-M4 (03/09/2026): KHÔNG ghi phoneNumber vào metadata. audit_logs là bảng
                // giữ vĩnh viễn và màn hình audit cho ADMIN nào cũng đọc được, nên số điện thoại
                // dạng rõ ở đây là một bản sao PII sống lâu hơn cả chính hồ sơ người dùng. Ghi
                // việc SỐ ĐÃ ĐỔI là đủ để truy vết; giá trị thì tra trong bảng users.
                Map.of(
                        "displayName", String.valueOf(result.getOrDefault("displayName", "")),
                        "phoneNumberChanged", request.phoneNumber() != null
                )
        );
        return result;
    }

    // ── Interview Transcript (Admin) ─────────────────────────────────────

    @GetMapping("/users/{userId}/interview-sessions")
    public List<Map<String, Object>> userInterviewSessions(
            @PathVariable Long userId,
            Authentication authentication
    ) {
        List<Map<String, Object>> sessions = adminManagementService.userInterviewSessions(userId);
        // 🔴 Danh mục hội thoại của một người, kèm interviewReportJson (nhận xét về chính họ). Vết
        // ghi số phiên đọc được, không chép vị trí ứng tuyển / persona / báo cáo.
        auditRead(() -> auditLogService.log(
                "admin.user.interview_sessions.read",
                AuditActor.ofAuthentication(authentication),
                "USER",
                String.valueOf(userId),
                auditOrgResolver.forUser(userId),
                Map.of("sessionCount", sessions.size())
        ));
        return sessions;
    }

    @GetMapping("/users/{userId}/interview-sessions/{sessionId}/messages")
    public List<Map<String, Object>> userInterviewMessages(
            @PathVariable Long userId,
            @PathVariable Long sessionId,
            Authentication authentication
    ) {
        List<Map<String, Object>> messages = adminManagementService.userInterviewMessages(userId, sessionId);
        // 🔴 Đọc TRỌN transcript hội thoại — từng lượt học viên nói và từng lời chữa.
        //
        // Đường dẫn nói "interview-sessions" nhưng service KHÔNG lọc session_mode: nó chỉ kiểm phiên
        // có thuộc người này không, nên mở được cả hội thoại tự do (COMMUNICATION) lẫn bài học chứ
        // không riêng phỏng vấn. Vì vậy vết ghi sessionMode TRA TỪ BẢNG chứ không suy từ tên đường
        // dẫn — giám đốc đọc sổ phải biết admin đã mở loại hội thoại nào. Nội dung tin nhắn không
        // bao giờ vào metadata: chỉ định danh phiên và số lượt.
        auditRead(() -> auditLogService.log(
                "admin.user.interview_messages.read",
                AuditActor.ofAuthentication(authentication),
                "USER",
                String.valueOf(userId),
                auditOrgResolver.forUser(userId),
                Map.of(
                        "sessionId", sessionId,
                        "sessionMode", speakingSessionMode(sessionId),
                        "messageCount", messages.size()
                )
        ));
        return messages;
    }

    @PostMapping("/vocabulary/glosbe-vi/enrich/batch")
    public Map<String, Object> runGlosbeViBatch(
            @RequestParam(required = false) Integer limit,
            @RequestParam(defaultValue = "false") boolean resetCursor,
            Authentication authentication
    ) {
        Map<String, Object> result = glosbeViEnrichmentService.runBatch(limit, resetCursor);
        auditLogService.log("admin.vocabulary.glosbe-vi.batch.triggered", AuditActor.ofAuthentication(authentication),
                                "VOCABULARY_IMPORT", "glosbe-vi",
                Map.of("viUpserts", result.getOrDefault("viUpserts", 0), "status", result.get("status")));
        return result;
    }

    @PostMapping("/vocabulary/glosbe-vi/enrich/one")
    public Map<String, Object> runGlosbeViOne(
            @RequestParam long wordId,
            Authentication authentication
    ) {
        return glosbeViEnrichmentService.enrichOne(wordId);
    }

    /**
     * LLM DE→VI translation — stable replacement for Glosbe scraping.
     * Batch 50 words per LLM call. Cost: ~$0.024 for 10k words.
     * Admin UI: POST /api/admin/vocabulary/llm-vi/enrich/batch?limit=50
     */
    @PostMapping("/vocabulary/llm-vi/enrich/batch")
    public Map<String, Object> runLlmViBatch(
            @RequestParam(required = false) Integer limit,
            @RequestParam(defaultValue = "false") boolean resetCursor,
            Authentication authentication
    ) {
        Map<String, Object> result = llmViTranslationService.runBatch(limit, resetCursor);
        auditLogService.log("admin.vocabulary.llm-vi.batch.triggered", AuditActor.ofAuthentication(authentication),
                                "VOCABULARY_IMPORT", "llm-vi",
                Map.of("translated", result.getOrDefault("translated", 0), "status", result.get("status")));
        return result;
    }

    /**
     * Phase 1: Fix word dtype (part-of-speech) using suffix rules + LLM.
     * Dry-run by default — set dryRun=false to actually apply fixes.
     * POST /api/admin/vocabulary/dtype-fix/batch?limit=200&useLlm=true&dryRun=true
     */
    @PostMapping("/vocabulary/dtype-fix/batch")
    public Map<String, Object> runDtypeFixBatch(
            @RequestParam(required = false) Integer limit,
            @RequestParam(defaultValue = "true")  boolean useLlm,
            @RequestParam(defaultValue = "true")  boolean dryRun,
            Authentication authentication
    ) {
        Map<String, Object> result = llmDtypeFixService.runBatch(limit, useLlm, dryRun);
        if (!dryRun) {
            auditLogService.log("admin.vocabulary.dtype-fix.batch.triggered", AuditActor.ofAuthentication(authentication),
                                        "VOCABULARY_IMPORT", "dtype-fix",
                    Map.of("totalFixed", result.getOrDefault("totalFixed", 0),
                            "status", result.get("status")));
        }
        return result;
    }

    @PostMapping("/vocabulary/deepl-lemma-backfill/batch")
    public Map<String, Object> runDeepLLemmaBackfillBatch(
            @RequestParam(required = false) Integer limit,
            @RequestParam(defaultValue = "false") boolean resetCursor,
            Authentication authentication
    ) {
        Map<String, Object> result = deepLLemmaBackfillService.runBatch(limit, resetCursor);
        auditLogService.log(
                "admin.vocabulary.deepl-lemma-backfill.batch.triggered",
                AuditActor.ofAuthentication(authentication),
                "VOCABULARY_IMPORT",
                "deepl-lemma-backfill",
                Map.of(
                        "enUpserts", result.getOrDefault("enUpserts", 0),
                        "viUpserts", result.getOrDefault("viUpserts", 0),
                        "status", String.valueOf(result.get("status"))
                )
        );
        return result;
    }

    @PostMapping("/vocabulary/goethe/official-wordlist/import")
    public Map<String, Object> importGoetheOfficialPdfWordlist(Authentication authentication) {
        Map<String, Object> result = goetheOfficialWordlistImportService.importFromClasspathTsv();
        auditLogService.log(
                "admin.vocabulary.goethe-official-wordlist.import.triggered",
                AuditActor.ofAuthentication(authentication),
                "VOCABULARY_IMPORT",
                "goethe-official-tsv",
                result
        );
        return result;
    }

    @PostMapping("/vocabulary/goethe/import")
    public Map<String, Object> importGoetheVocabulary(Authentication authentication) {
        Map<String, Object> result = goetheVocabularyAutoImportService.importGoetheVocabularyA1ToC1();
        Map<String, Object> metadata = new LinkedHashMap<>();
        metadata.put("managedUniqueImported", result.get("managedUniqueImported"));
        metadata.put("inserted", result.get("inserted"));
        metadata.put("updated", result.get("updated"));
        metadata.put("duplicatesSkipped", result.get("duplicatesSkipped"));
        auditLogService.log(
                "admin.vocabulary.goethe.import.triggered",
                AuditActor.ofAuthentication(authentication),
                "VOCABULARY_IMPORT",
                "goethe-a1-c1",
                metadata
        );
        return result;
    }

    @PostMapping("/vocabulary/glosbe/import")
    public Map<String, Object> importGlosbeVocabulary(
            @RequestParam(required = false) Integer maxPages,
            @RequestParam(required = false) Integer maxWords,
            Authentication authentication
    ) {
        Map<String, Object> result = glosbeVocabularyImportService.importFromGlosbe(maxPages, maxWords);
        Map<String, Object> metadata = new LinkedHashMap<>();
        metadata.put("status", result.get("status"));
        metadata.put("pagesVisited", result.get("pagesVisited"));
        metadata.put("processedWords", result.get("processedWords"));
        metadata.put("inserted", result.get("inserted"));
        metadata.put("updated", result.get("updated"));
        metadata.put("errors", result.get("errors"));
        metadata.put("nextCursor", result.get("nextCursor"));
        auditLogService.log(
                "admin.vocabulary.glosbe.import.triggered",
                AuditActor.ofAuthentication(authentication),
                "VOCABULARY_IMPORT",
                "glosbe-de-vi",
                metadata
        );
        return result;
    }

    @PostMapping("/vocabulary/cefr/import")
    public Map<String, Object> importCefrCuratedVocabulary(Authentication authentication) {
        Map<String, Object> result = officialCefrVocabularyImportService.importCuratedCefrVocabulary();
        Map<String, Object> metadata = new LinkedHashMap<>();
        metadata.put("pickedTotal", result.get("pickedTotal"));
        metadata.put("inserted", result.get("inserted"));
        metadata.put("updated", result.get("updated"));
        metadata.put("levelCounts", result.get("levelCounts"));
        metadata.put("deeplCharsEstimated", result.get("deeplCharsEstimated"));
        auditLogService.log(
                "admin.vocabulary.cefr-curated.import.triggered",
                AuditActor.ofAuthentication(authentication),
                "VOCABULARY_IMPORT",
                "cefr-curated-10k",
                metadata
        );
        return result;
    }

    /**
     * Gán lại cấp CEFR cho TOÀN BỘ bảng words theo wordlist Goethe chính thức; từ ngoài wordlist về NULL
     * (chưa phân cấp). Chạy có chủ đích — KHÔNG tự chạy lúc khởi động vì thao tác này ghi lại cả kho.
     */
    @PostMapping("/vocabulary/cefr/reclassify")
    public Map<String, Object> reclassifyCefrLevels(Authentication authentication) {
        Map<String, Object> result = officialCefrVocabularyImportService.reclassifyAllWords();
        auditLogService.log(
                "admin.vocabulary.cefr.reclassify.triggered",
                AuditActor.ofAuthentication(authentication),
                "VOCABULARY_IMPORT",
                "cefr-reclassify",
                result
        );
        return result;
    }

    @PostMapping("/vocabulary/cefr/import/sample")
    public Map<String, Object> importCefrCuratedSample(Authentication authentication) throws IOException {
        Map<String, Object> result = officialCefrVocabularyImportService.importFromClasspathSample();
        auditLogService.log(
                "admin.vocabulary.cefr-curated.sample.import.triggered",
                AuditActor.ofAuthentication(authentication),
                "VOCABULARY_IMPORT",
                "cefr-curated-sample",
                result
        );
        return result;
    }

    @PostMapping("/vocabulary/ipa/batch")
    public Map<String, Object> runWiktionaryIpaBatch(
            @RequestParam(required = false) Integer limit,
            @RequestParam(defaultValue = "false") boolean resetCursor,
            Authentication authentication
    ) {
        Map<String, Object> result = wiktionaryIpaBatchService.runBatch(limit, resetCursor);
        Map<String, Object> metadata = new LinkedHashMap<>();
        metadata.put("ipaFilled", result.get("ipaFilled"));
        metadata.put("ipaMissing", result.get("ipaMissing"));
        metadata.put("processedRows", result.get("processedRows"));
        metadata.put("lastProcessedWordId", result.get("lastProcessedWordId"));
        metadata.put("resetCursor", result.get("resetCursor"));
        auditLogService.log(
                "admin.vocabulary.ipa.batch.triggered",
                AuditActor.ofAuthentication(authentication),
                "VOCABULARY_IMPORT",
                "wiktionary-ipa",
                metadata
        );
        return result;
    }

    @PostMapping("/vocabulary/wiktionary/enrich/batch")
    public Map<String, Object> runWiktionaryEnrichBatch(
            @RequestParam(required = false) Integer limit,
            @RequestParam(defaultValue = "false") boolean resetCursor,
            Authentication authentication
    ) {
        Map<String, Object> result = wiktionaryEnrichmentBatchService.runBatch(limit, resetCursor);
        Map<String, Object> metadata = new LinkedHashMap<>();
        metadata.put("ipaFilled", result.get("ipaFilled"));
        metadata.put("enUpserts", result.get("enUpserts"));
        metadata.put("deUpserts", result.get("deUpserts"));
        metadata.put("processedRows", result.get("processedRows"));
        metadata.put("lastProcessedWordId", result.get("lastProcessedWordId"));
        metadata.put("resetCursor", result.get("resetCursor"));
        auditLogService.log(
                "admin.vocabulary.wiktionary.enrich.batch.triggered",
                AuditActor.ofAuthentication(authentication),
                "VOCABULARY_IMPORT",
                "wiktionary-enrich",
                metadata
        );
        return result;
    }

    /**
     * Phase 2 Tier 2 — Enrich gender for Nouns missing der/die/das via Wiktionary.
     * Idempotent, always fetches first N nouns without gender.
     * POST /api/admin/vocabulary/wiktionary/gender/batch?limit=100
     */
    @PostMapping("/vocabulary/wiktionary/gender/batch")
    public Map<String, Object> runGenderEnrichBatch(
            @RequestParam(required = false) Integer limit,
            Authentication authentication
    ) {
        Map<String, Object> result = wiktionaryEnrichmentBatchService.runGenderOnlyBatch(limit);
        auditLogService.log("admin.vocabulary.gender.batch.triggered", AuditActor.ofAuthentication(authentication),
                                "VOCABULARY_IMPORT", "wiktionary-gender",
                Map.of("genderFilled", result.getOrDefault("genderFilled", 0),
                        "status", result.get("status")));
        return result;
    }

    /**
     * Phase 3 — Enrich words missing IPA phonetic OR EN meaning via Wiktionary.
     * Idempotent — A1/A2 words first.
     * POST /api/admin/vocabulary/wiktionary/missing-data/batch?limit=100
     */
    @PostMapping("/vocabulary/wiktionary/missing-data/batch")
    public Map<String, Object> runMissingDataEnrichBatch(
            @RequestParam(required = false) Integer limit,
            Authentication authentication
    ) {
        Map<String, Object> result = wiktionaryEnrichmentBatchService.runMissingDataBatch(limit);
        auditLogService.log("admin.vocabulary.missing-data.batch.triggered", AuditActor.ofAuthentication(authentication),
                                "VOCABULARY_IMPORT", "wiktionary-missing-data",
                Map.of("ipaFilled", result.getOrDefault("ipaFilled", 0),
                        "enFilled", result.getOrDefault("enFilled", 0),
                        "status", result.get("status")));
        return result;
    }

    @PostMapping("/vocabulary/wiktionary/enrich/one")
    public Map<String, Object> runWiktionaryEnrichOne(
            @RequestParam long wordId,
            Authentication authentication
    ) {
        Map<String, Object> result = wiktionaryEnrichmentBatchService.enrichOne(wordId);
        auditLogService.log(
                "admin.vocabulary.wiktionary.enrich.one.triggered",
                AuditActor.ofAuthentication(authentication),
                "VOCABULARY_IMPORT",
                "wiktionary-enrich-one",
                Map.of("wordId", wordId, "status", result.get("status"))
        );
        return result;
    }

    @PostMapping("/vocabulary/cleanup/concatenated-lemmas")
    public Map<String, Object> cleanupConcatenatedLemmas(
            @RequestParam(required = false) Integer limit,
            @RequestParam(defaultValue = "true") boolean dryRun,
            Authentication authentication
    ) {
        Map<String, Object> result = vocabularyCleanupService.deleteConcatenatedLemmas(limit, dryRun);
        auditLogService.log(
                "admin.vocabulary.cleanup.concatenated-lemmas.triggered",
                AuditActor.ofAuthentication(authentication),
                "VOCABULARY_CLEANUP",
                "concatenated-lemmas",
                Map.of("limit", result.get("limit"), "dryRun", dryRun, "matched", result.get("matched"), "deleted", result.get("deleted"))
        );
        return result;
    }

    /**
     * POST /api/admin/vocabulary/cleanup/control-char-lemmas?limit=200&dryRun=true
     *
     * Sửa lemma dính TAB/CR/LF — di chứng bộ trích PDF Goethe cũ (đã vá ở #356).
     * Dry-run mặc định: trả về KẾ HOẠCH từng dòng (repair hay delete) mà không ghi gì.
     * Khác {@code concatenated-lemmas} vốn chỉ bắt chuỗi KHÔNG dấu cách và luôn xoá.
     */
    @PostMapping("/vocabulary/cleanup/control-char-lemmas")
    public Map<String, Object> cleanupControlCharLemmas(
            @RequestParam(required = false) Integer limit,
            @RequestParam(defaultValue = "true") boolean dryRun,
            Authentication authentication
    ) {
        Map<String, Object> result = vocabularyCleanupService.repairControlCharLemmas(limit, dryRun);
        auditLogService.log(
                "admin.vocabulary.cleanup.control-char-lemmas.triggered",
                AuditActor.ofAuthentication(authentication),
                "VOCABULARY_CLEANUP",
                "control-char-lemmas",
                Map.of("limit", result.get("limit"), "dryRun", dryRun,
                        "matched", result.get("matched"),
                        "repaired", result.get("repaired"),
                        "deleted", result.get("deleted"))
        );
        return result;
    }

    /**
     * POST /api/admin/vocabulary/cleanup/stuffed-meanings?limit=200&dryRun=true
     *
     * Cắt phần nhồi (câu ví dụ, trích dẫn nguồn, danh sách đồng nghĩa, bảng biến cách) khỏi
     * {@code meaning_en}. Dry-run mặc định trả về danh sách trước/sau. KHÔNG xoá bản dịch nào.
     */
    @PostMapping("/vocabulary/cleanup/stuffed-meanings")
    public Map<String, Object> cleanupStuffedMeanings(
            @RequestParam(required = false) Integer limit,
            @RequestParam(defaultValue = "true") boolean dryRun,
            Authentication authentication
    ) {
        Map<String, Object> result = vocabularyCleanupService.repairStuffedMeanings(limit, dryRun);
        auditLogService.log(
                "admin.vocabulary.cleanup.stuffed-meanings.triggered",
                AuditActor.ofAuthentication(authentication),
                "VOCABULARY_CLEANUP",
                "stuffed-meanings",
                Map.of("limit", result.get("limit"), "dryRun", dryRun,
                        "scanned", result.get("scanned"),
                        "updated", result.get("updated"))
        );
        return result;
    }

    @PostMapping("/vocabulary/auto-tag/batch")
    public Map<String, Object> autoTagBatch(
            @AuthenticationPrincipal User user,
            @RequestParam(required = false) Integer limit,
            @RequestParam(defaultValue = "true")  boolean dryRun,
            @RequestParam(defaultValue = "false") boolean resetTags,
            Authentication authentication
    ) {
        Map<String, Object> result = vocabularyAutoTaggingService.runBatch(
                user == null ? 0L : user.getId(),
                limit, dryRun, resetTags);
        if (!dryRun) {
            auditLogService.log(
                    "admin.vocabulary.auto-tag.batch.triggered",
                    AuditActor.ofAuthentication(authentication),
                    "VOCABULARY_TAGGING",
                    "auto-tag",
                    Map.of("limit", String.valueOf(limit), "resetTags", resetTags,
                            "wordsTagged", result.getOrDefault("wordsTagged", 0))
            );
        }
        return result;
    }

    @PostMapping("/vocabulary/reset")
    public Map<String, Object> resetAndReimportVocabulary(
            @RequestParam(required = false) String confirm,
            @RequestParam(defaultValue = "200") int wiktionaryLimit,
            Authentication authentication
    ) {
        // Audit R-H1: guard confirm + all-or-nothing nằm trong SERVICE (mọi entry point đều qua);
        // ở đây chỉ truyền xuống. Vết audit dưới ghi ngoài transaction của service nên kể cả
        // khi reset ROLLED_BACK vẫn còn dấu ai đã bấm.
        Map<String, Object> result = vocabularyResetService.resetAndReimport(confirm, wiktionaryLimit);
        auditLogService.log(
                "admin.vocabulary.reset.triggered",
                AuditActor.ofAuthentication(authentication),
                "VOCABULARY_RESET",
                "full-reset",
                Map.of("wiktionaryLimit", wiktionaryLimit, "status", result.get("status"))
        );
        return result;
    }

    @PatchMapping("/vocabulary/{wordId}")
    public Map<String, Object> updateWord(
            @PathVariable long wordId,
            @RequestBody Map<String, Object> body,
            Authentication authentication
    ) {
        Map<String, Object> result = vocabularyCleanupService.updateWord(wordId, body);
        auditLogService.log(
                "admin.vocabulary.word.updated",
                AuditActor.ofAuthentication(authentication),
                "VOCABULARY",
                String.valueOf(wordId),
                Map.of("fields", body.keySet())
        );
        return result;
    }

    @GetMapping("/vocabulary/debug/search")
    public Map<String, Object> debugSearchVocabulary(
            @RequestParam String q,
            @RequestParam(required = false) Integer limit
    ) {
        return vocabularyCleanupService.searchWordsByBaseForm(q, limit);
    }

    @GetMapping("/debug/db-info")
    public Map<String, Object> debugDbInfo() {
        return vocabularyCleanupService.dbInfo();
    }

    @GetMapping("/vocabulary/debug/concatenated-lemmas")
    public Map<String, Object> debugConcatenatedLemmas(
            @RequestParam(required = false) Integer limit
    ) {
        return vocabularyCleanupService.sampleConcatenatedLemmas(limit);
    }

    @GetMapping("/vocabulary/debug/translations")
    public Map<String, Object> debugTranslations(
            @RequestParam long wordId
    ) {
        return vocabularyCleanupService.debugTranslations(wordId);
    }


    // ─── Phase 4: Quality Review ─────────────────────────────────────────────

    /**
     * GET /api/admin/vocabulary/review/queue
     * Lấy danh sách từ chưa được review, ưu tiên A1/A2 và dtype=Noun.
     */
    @GetMapping("/vocabulary/review/queue")
    public Map<String, Object> getReviewQueue(
            @RequestParam(required = false, defaultValue = "50") int limit,
            @RequestParam(required = false) String cefrLevel,
            @RequestParam(required = false) String dtype,
            Authentication authentication
    ) {
        int cap = Math.min(Math.max(1, limit), 200);

        // SECURITY: bind cefrLevel/dtype as query parameters (never string-concatenate them).
        // The previous `replace("'","")` filter was bypassable (e.g. $$..$$, ::text--, unicode
        // quotes), turning an admin-gated read into a full-DB injection. CEFR is additionally
        // whitelisted as defence-in-depth.
        StringBuilder sql = new StringBuilder(
                "SELECT w.id, w.base_form, w.dtype, w.cefr_level, w.phonetic," +
                "  n.gender, w.admin_review_notes," +
                "  (SELECT meaning FROM word_translations WHERE word_id = w.id AND locale = 'vi' LIMIT 1) AS meaning_vi," +
                "  (SELECT meaning FROM word_translations WHERE word_id = w.id AND locale = 'en' LIMIT 1) AS meaning_en" +
                " FROM words w LEFT JOIN nouns n ON n.id = w.id" +
                " WHERE w.reviewed_by_admin = FALSE"
        );
        List<Object> params = new ArrayList<>();
        if (cefrLevel != null && !cefrLevel.isBlank()) {
            String normalized = cefrLevel.trim().toUpperCase();
            if (!VALID_CEFR_LEVELS.contains(normalized)) {
                throw new BadRequestException("Invalid cefrLevel");
            }
            sql.append(" AND w.cefr_level = ?");
            params.add(normalized);
        }
        if (dtype != null && !dtype.isBlank()) {
            sql.append(" AND w.dtype = ?");
            params.add(dtype);
        }
        sql.append(" ORDER BY CASE COALESCE(w.cefr_level,'ZZ') WHEN 'A1' THEN 1 WHEN 'A2' THEN 2 WHEN 'B1' THEN 3" +
                   " WHEN 'B2' THEN 4 WHEN 'C1' THEN 5 WHEN 'C2' THEN 6 ELSE 99 END," +
                   " CASE WHEN w.dtype = 'Noun' THEN 0 ELSE 1 END, w.id ASC LIMIT ").append(cap);

        var items = jdbcTemplate.queryForList(sql.toString(), params.toArray());
        var total = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM words WHERE reviewed_by_admin = FALSE", Integer.class);
        return Map.of("items", items, "total", total, "limit", cap);
    }

    /**
     * PATCH /api/admin/vocabulary/{wordId}/review
     * Admin đánh dấu từ đã review (có thể thay đổi dtype, gender, ghi notes).
     * Body: { reviewed: true, dtype: "Verb", gender: "DER", notes: "..." }
     */
    @PatchMapping("/vocabulary/{wordId}/review")
    public Map<String, Object> reviewWord(
            @PathVariable long wordId,
            @RequestBody Map<String, Object> body,
            Authentication authentication
    ) {
        boolean reviewed = Boolean.TRUE.equals(body.get("reviewed"));
        // Null-safe: chỉ nhận String thật. Trước đây `(String) body.get(...)` ép thô — client gửi
        // dtype/gender/notes là số/object trong JSON sẽ ClassCastException → 500 thay vì bỏ qua.
        String notes = asString(body.get("notes"));
        String newDtype  = asString(body.get("dtype"));
        String newGender = asString(body.get("gender"));

        // Update words table
        jdbcTemplate.update(
                "UPDATE words SET reviewed_by_admin = ?, admin_review_notes = COALESCE(?, admin_review_notes)," +
                "  reviewed_at = CASE WHEN ? THEN NOW() ELSE reviewed_at END," +
                "  dtype = COALESCE(NULLIF(?, ''), dtype), updated_at = NOW() WHERE id = ?",
                reviewed, notes, reviewed, newDtype, wordId
        );

        // Update gender if provided and word is Noun
        if (newGender != null && !newGender.isBlank()) {
            jdbcTemplate.update(
                    "INSERT INTO nouns (id, gender, noun_type) VALUES (?, ?, 'STARK')" +
                    " ON CONFLICT (id) DO UPDATE SET gender = EXCLUDED.gender",
                    wordId, newGender
            );
        }

        auditLogService.log("admin.vocabulary.reviewed", AuditActor.ofAuthentication(authentication),
                                "VOCABULARY_REVIEW", String.valueOf(wordId),
                Map.of("reviewed", reviewed, "dtype", newDtype != null ? newDtype : "",
                        "gender", newGender != null ? newGender : ""));

        return Map.of("wordId", wordId, "reviewed", reviewed, "status", "OK");
    }

    /**
     * GET /api/admin/vocabulary/review/stats
     * Thống kê số từ đã/chưa review theo cefr_level và dtype.
     */
    @GetMapping("/vocabulary/review/stats")
    public Map<String, Object> getReviewStats() {
        var byLevel = jdbcTemplate.queryForList(
                "SELECT cefr_level, COUNT(*) FILTER (WHERE reviewed_by_admin) AS reviewed," +
                "  COUNT(*) FILTER (WHERE NOT reviewed_by_admin) AS pending, COUNT(*) AS total" +
                " FROM words GROUP BY cefr_level ORDER BY" +
                " CASE COALESCE(cefr_level,'ZZ') WHEN 'A1' THEN 1 WHEN 'A2' THEN 2" +
                " WHEN 'B1' THEN 3 WHEN 'B2' THEN 4 WHEN 'C1' THEN 5 WHEN 'C2' THEN 6 ELSE 99 END");
        var totals = jdbcTemplate.queryForMap(
                "SELECT COUNT(*) FILTER (WHERE reviewed_by_admin) AS reviewed," +
                "  COUNT(*) FILTER (WHERE NOT reviewed_by_admin) AS pending, COUNT(*) AS total FROM words");
        return Map.of("byLevel", byLevel, "totals", totals);
    }

    public record UpdateRoleRequest(@NotBlank(message = "role is required") String role) {}

    public record CreateUserRequest(
            @NotBlank(message = "email is required") String email,
            @NotBlank(message = "displayName is required") String displayName,
            @NotBlank(message = "password is required") String password,
            @NotBlank(message = "role is required") String role,
            String locale,
            Long orgId,
            String orgRole
    ) {}

    public record SetActiveRequest(@NotNull(message = "active is required") Boolean active) {}

    public record SetPasswordRequest(@NotBlank(message = "password is required") String password) {}
    public record UpdatePlanRequest(
            @NotBlank(message = "planCode is required") String planCode,
            Long monthlyTokenLimitOverride,
            String startsAtUtc,
            String endsAtUtc
    ) {}

    public record BulkAssignStudentsRequest(
            List<Long> studentIds
    ) {}

    /** Null-safe cast: giá trị JSON không phải chuỗi → null (tránh ClassCastException → 500). */
    private static String asString(Object v) {
        return v instanceof String s ? s : null;
    }

    // ── Ghi vết ĐƯỜNG ĐỌC (DEC-13) ───────────────────────────────────────
    //
    // Quy ước cũ của repo: mọi mutation ghi vết, mọi đường đọc câm. DEC-13 (owner chốt 09/09/2026)
    // bỏ vế sau — admin nền tảng giữ quyền kỹ thuật, nhưng MỌI thao tác chạm dữ liệu một trung tâm,
    // kể cả chỉ đọc, phải ghi vết mà chính giám đốc trung tâm đó đọc được.
    //
    // Ghi TAY tại controller chứ không bằng @Aspect: repo chưa dùng @Aspect ở đâu, và một aspect
    // vẫn phải được cấu hình từng endpoint để đoán "lần gọi này chạm trung tâm nào" từ tham số bất
    // kỳ. Vài điểm gọi tay thì grep ra được và đọc được ngay tại chỗ.

    /**
     * Ghi vết cho một đường ĐỌC — mọi lỗi ghi vết bị nuốt, kèm {@code log.error}.
     *
     * <p><b>Fail-open có tiếng, cố ý.</b> Cột {@code audit_logs.org_id} có KHOÁ NGOẠI tới
     * {@code organizations(id)} (V315), nên một orgId hỏng — trung tâm vừa bị xoá, dữ liệu lệch —
     * ném ngay ở INSERT và biến một lần ĐỌC ĐÃ THÀNH CÔNG thành 500 trả về client, tức làm hỏng
     * đúng chức năng mà vết chỉ định quan sát. Tiền lệ cùng lựa chọn: nhánh ghi vết blocked-attempt
     * trong {@code GlobalExceptionHandler} ("lỗi ghi vết không được đổi response của client").
     * {@code log.error} là phần "có tiếng": mất vết vẫn nổi lên ở giám sát chứ không im lặng.
     *
     * <p>Việc tra tổ chức nằm TRONG lambda nên cũng được che: {@link AuditOrgResolver} chạm DB, và
     * một cú vấp ở đó cũng không được phép giết lần đọc.
     *
     * <p>🪤 <b>Ghi ở CONTROLLER, đừng "sửa cho đúng chuẩn" bằng cách đẩy xuống service.</b>
     * {@link AuditActor} nêu quy ước NGƯỢC LẠI (ghi ở controller thì vết nằm ngoài transaction
     * nghiệp vụ) — quy ước đó dành cho MUTATION. Với đường đọc thì không áp dụng được: các phương
     * thức đọc là {@code @Transactional(readOnly = true)}, mà {@code AuditLogService} dùng chung
     * connection qua {@code DataSourceUtils}, nên INSERT audit bên trong sẽ nổ
     * <em>"cannot execute INSERT in a read-only transaction"</em> và giết endpoint.
     */
    private void auditRead(Runnable auditWrite) {
        try {
            auditWrite.run();
        } catch (Exception e) {
            log.error("Không ghi được vết đường đọc admin: {}", e.getMessage(), e);
        }
    }

    /**
     * Vết cho lần admin đọc DANH SÁCH LỚP — một dòng cho MỖI trung tâm có lớp trong kết quả
     * (AC-ORG-CT-02).
     *
     * <p><b>Vì sao không phải một vết duy nhất.</b> {@code listClasses()} không có WHERE, không phân
     * trang, không nhận tham số lọc: một lần gọi đọc lớp của MỌI trung tâm, nên không tồn tại một
     * {@code orgId} đơn trị để gán. Ghi một dòng {@code org_id = NULL} thì đúng chữ mà vô dụng — sổ
     * của giám đốc lọc {@code AND org_id = ?} nên dòng NULL không bao giờ lọt vào, tức thao tác chạm
     * dữ liệu của họ vẫn vô hình, đúng thứ DEC-13 cấm. Một dòng mỗi trung tâm nói đúng sự thật:
     * admin đã đọc danh sách lớp của từng trung tâm đó.
     *
     * <p><b>Vì sao không thêm tham số lọc {@code orgId} rồi ghi vết theo nó.</b> Siết phạm vi
     * endpoint thuộc PR sau; và web hiện KHÔNG gửi tham số nào, nên bộ lọc mới sẽ không có ai dùng —
     * sổ của giám đốc vẫn trống và AC-ORG-CT-02 vẫn trượt ngay trong đợt này.
     *
     * <p>Giá: đúng MỘT truy vấn gộp, phản chiếu nguyên FROM/JOIN của {@code listClasses()} để không
     * kê khai một trung tâm mà kết quả thực tế không có dòng nào (JOIN users loại lớp có teacher_id
     * mồ côi). Vòng lặp dài bằng số trung tâm CÓ LỚP — một con số nghiệp vụ, không do người dùng
     * điều khiển.
     */
    private void auditClassListRead(Authentication authentication, int returnedCount) {
        auditRead(() -> {
            List<Map<String, Object>> perOrg = jdbcTemplate.queryForList("""
                    SELECT c.org_id AS "orgId", COUNT(*) AS "classCount"
                    FROM teacher_classes c
                    JOIN users u ON u.id = c.teacher_id
                    WHERE c.org_id IS NOT NULL
                    GROUP BY c.org_id
                    """);
            AuditActor actor = AuditActor.ofAuthentication(authentication);
            for (Map<String, Object> row : perOrg) {
                if (!(row.get("orgId") instanceof Number orgId)) {
                    continue;
                }
                auditLogService.log(
                        // Đặt tên và gắn đích theo khuôn admin.org.timesheet.exported — tiền lệ gần
                        // nhất: một tài sản CỦA trung tâm bị đọc trọn, target là chính trung tâm đó.
                        // Không dùng target_type CLASS: dòng này nói về CẢ danh sách lớp của một
                        // trung tâm, không về một lớp nào, nên sẽ phải để target_id rỗng.
                        "admin.org.class_list.read",
                        actor,
                        "ORG",
                        String.valueOf(orgId.longValue()),
                        orgId.longValue(),
                        Map.of(
                                "orgClassCount", String.valueOf(row.get("classCount")),
                                "returnedCount", returnedCount
                        )
                );
            }
        });
    }

    /**
     * Kiểu phiên nói THẬT tra từ bảng ({@code COMMUNICATION | INTERVIEW | …}), {@code "UNKNOWN"} nếu
     * không đọc được. Một câu SELECT một cột theo khoá chính — đủ rẻ để chạy trên đường đọc.
     */
    private String speakingSessionMode(Long sessionId) {
        String mode = jdbcTemplate.query(
                "SELECT session_mode FROM ai_speaking_sessions WHERE id = ?",
                rs -> rs.next() ? rs.getString(1) : null,
                sessionId);
        return mode == null ? "UNKNOWN" : mode;
    }

    /** Đếm phần tử của một danh sách lồng trong body trả về — chỉ SỐ LƯỢNG, không chạm nội dung. */
    private static int nestedListSize(Map<String, Object> body, String section, String key) {
        if (body != null
                && body.get(section) instanceof Map<?, ?> sectionMap
                && sectionMap.get(key) instanceof List<?> list) {
            return list.size();
        }
        return 0;
    }

    /**
     * Chỉ ghi các trường THỰC SỰ được đặt (partial update — trường null không áp dụng), và ghi giá
     * trị vì đây đều là enum hẹp (goalType/level/speed) chứ không phải dữ liệu tự do của người dùng.
     */
    private Map<String, Object> learningProfileAuditMeta(AdminUpdateLearningProfileRequest request) {
        Map<String, Object> meta = new LinkedHashMap<>();
        if (request.goalType() != null) meta.put("goalType", request.goalType());
        if (request.targetLevel() != null) meta.put("targetLevel", request.targetLevel());
        if (request.currentLevel() != null) meta.put("currentLevel", request.currentLevel());
        if (request.learningSpeed() != null) meta.put("learningSpeed", request.learningSpeed());
        if (request.industry() != null) meta.put("industry", request.industry());
        if (request.sessionsPerWeek() != null) meta.put("sessionsPerWeek", request.sessionsPerWeek());
        if (request.minutesPerSession() != null) meta.put("minutesPerSession", request.minutesPerSession());
        return meta;
    }
}


