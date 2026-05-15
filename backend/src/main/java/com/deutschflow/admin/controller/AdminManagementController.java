package com.deutschflow.admin.controller;

import com.deutschflow.admin.service.AdminManagementService;
import com.deutschflow.admin.dto.AdminUpdateLearningProfileRequest;
import com.deutschflow.user.dto.AdminUpdateProfileRequest;
import com.deutschflow.notification.service.UserNotificationService;
import com.deutschflow.common.audit.AuditLogService;
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
import lombok.RequiredArgsConstructor;
import org.springframework.cache.CacheManager;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;
import com.deutschflow.user.entity.User;

import java.io.IOException;
import java.util.List;
import java.util.LinkedHashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AdminManagementController {
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
        auditLogService.log("admin.cache.purged", null,
                actorEmail(authentication), actorRole(authentication),
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

    @GetMapping("/users")
    public List<Map<String, Object>> users() {
        return adminManagementService.listUsers();
    }

    @GetMapping("/plans")
    public List<Map<String, Object>> plans() {
        return adminManagementService.listPlans();
    }

    @PatchMapping("/users/{userId}/role")
    public Map<String, Object> updateRole(
            @PathVariable Long userId,
            @Valid @RequestBody UpdateRoleRequest req,
            Authentication authentication
    ) {
        Map<String, Object> updated = adminManagementService.updateUserRole(userId, req.role());
        auditLogService.log(
                "admin.user.role.updated",
                null,
                actorEmail(authentication),
                actorRole(authentication),
                "USER",
                String.valueOf(userId),
                Map.of("newRole", String.valueOf(updated.get("role")))
        );
        return updated;
    }

    @PatchMapping("/users/{userId}/plan")
    public Map<String, Object> updatePlan(
            @PathVariable Long userId,
            @Valid @RequestBody UpdatePlanRequest req,
            Authentication authentication
    ) {
        Map<String, Object> updated = adminManagementService.updateUserPlan(
                userId,
                req.planCode(),
                req.monthlyTokenLimitOverride(),
                req.startsAtUtc(),
                req.endsAtUtc()
        );
        auditLogService.log(
                "admin.user.plan.updated",
                null,
                actorEmail(authentication),
                actorRole(authentication),
                "USER",
                String.valueOf(userId),
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
    public Map<String, Object> userQuota(@PathVariable Long userId) {
        return adminManagementService.userQuota(userId);
    }

    @GetMapping("/users/{userId}/usage")
    public List<Map<String, Object>> userUsage(
            @PathVariable Long userId,
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to,
            @RequestParam(required = false) Integer limit
    ) {
        return adminManagementService.userUsage(userId, from, to, limit);
    }

    @GetMapping("/classes")
    public List<Map<String, Object>> classesList() {
        return adminManagementService.listClasses();
    }

    @PostMapping("/classes/{classId}/students/bulk-assign")
    public Map<String, Object> bulkAssignStudents(
            @PathVariable Long classId,
            @RequestBody @Valid BulkAssignStudentsRequest request,
            Authentication authentication
    ) {
        Map<String, Object> result = adminManagementService.bulkAssignStudents(classId, request.studentIds());
        auditLogService.log(
                "admin.class.students.bulk_assigned",
                null,
                actorEmail(authentication),
                actorRole(authentication),
                "CLASS",
                String.valueOf(classId),
                Map.of("assignedCount", result.get("assignedCount"))
        );
        return result;
    }

    @GetMapping("/users/{userId}/learning-detail")
    public Map<String, Object> userLearningDetail(@PathVariable Long userId) {
        return adminManagementService.userLearningDetail(userId);
    }

    @PutMapping("/users/{userId}/learning-profile")
    public Map<String, Object> updateLearningProfile(
            @PathVariable Long userId,
            @RequestBody @Valid AdminUpdateLearningProfileRequest request
    ) {
        return adminManagementService.adminUpdateLearningProfile(userId, request);
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
        Map<String, Object> result = adminManagementService.adminUpdateProfile(userId, request);
        auditLogService.log(
                "admin.user.profile.updated",
                null,
                actorEmail(authentication),
                actorRole(authentication),
                "USER",
                String.valueOf(userId),
                Map.of(
                        "displayName", String.valueOf(result.getOrDefault("displayName", "")),
                        "phoneNumber", String.valueOf(result.getOrDefault("phoneNumber", ""))
                )
        );
        return result;
    }

    // ── Interview Transcript (Admin) ─────────────────────────────────────

    @GetMapping("/users/{userId}/interview-sessions")
    public List<Map<String, Object>> userInterviewSessions(@PathVariable Long userId) {
        return adminManagementService.userInterviewSessions(userId);
    }

    @GetMapping("/users/{userId}/interview-sessions/{sessionId}/messages")
    public List<Map<String, Object>> userInterviewMessages(
            @PathVariable Long userId,
            @PathVariable Long sessionId
    ) {
        return adminManagementService.userInterviewMessages(userId, sessionId);
    }

    @PostMapping("/vocabulary/glosbe-vi/enrich/batch")
    public Map<String, Object> runGlosbeViBatch(
            @RequestParam(required = false) Integer limit,
            @RequestParam(defaultValue = "false") boolean resetCursor,
            Authentication authentication
    ) {
        Map<String, Object> result = glosbeViEnrichmentService.runBatch(limit, resetCursor);
        auditLogService.log("admin.vocabulary.glosbe-vi.batch.triggered", null,
                actorEmail(authentication), actorRole(authentication),
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
        auditLogService.log("admin.vocabulary.llm-vi.batch.triggered", null,
                actorEmail(authentication), actorRole(authentication),
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
            auditLogService.log("admin.vocabulary.dtype-fix.batch.triggered", null,
                    actorEmail(authentication), actorRole(authentication),
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
                null,
                actorEmail(authentication),
                actorRole(authentication),
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
                null,
                actorEmail(authentication),
                actorRole(authentication),
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
                null,
                actorEmail(authentication),
                actorRole(authentication),
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
                null,
                actorEmail(authentication),
                actorRole(authentication),
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
                null,
                actorEmail(authentication),
                actorRole(authentication),
                "VOCABULARY_IMPORT",
                "cefr-curated-10k",
                metadata
        );
        return result;
    }

    @PostMapping("/vocabulary/cefr/import/sample")
    public Map<String, Object> importCefrCuratedSample(Authentication authentication) throws IOException {
        Map<String, Object> result = officialCefrVocabularyImportService.importFromClasspathSample();
        auditLogService.log(
                "admin.vocabulary.cefr-curated.sample.import.triggered",
                null,
                actorEmail(authentication),
                actorRole(authentication),
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
                null,
                actorEmail(authentication),
                actorRole(authentication),
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
                null,
                actorEmail(authentication),
                actorRole(authentication),
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
        auditLogService.log("admin.vocabulary.gender.batch.triggered", null,
                actorEmail(authentication), actorRole(authentication),
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
        auditLogService.log("admin.vocabulary.missing-data.batch.triggered", null,
                actorEmail(authentication), actorRole(authentication),
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
                null,
                actorEmail(authentication),
                actorRole(authentication),
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
                null,
                actorEmail(authentication),
                actorRole(authentication),
                "VOCABULARY_CLEANUP",
                "concatenated-lemmas",
                Map.of("limit", result.get("limit"), "dryRun", dryRun, "matched", result.get("matched"), "deleted", result.get("deleted"))
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
                    null,
                    actorEmail(authentication),
                    actorRole(authentication),
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
            @RequestParam(defaultValue = "200") int wiktionaryLimit,
            Authentication authentication
    ) {
        Map<String, Object> result = vocabularyResetService.resetAndReimport(wiktionaryLimit);
        auditLogService.log(
                "admin.vocabulary.reset.triggered",
                null,
                actorEmail(authentication),
                actorRole(authentication),
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
                null,
                actorEmail(authentication),
                actorRole(authentication),
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
        StringBuilder sql = new StringBuilder(
                "SELECT w.id, w.base_form, w.dtype, w.cefr_level, w.phonetic," +
                "  n.gender, w.admin_review_notes," +
                "  (SELECT meaning FROM word_translations WHERE word_id = w.id AND locale = 'vi' LIMIT 1) AS meaning_vi," +
                "  (SELECT meaning FROM word_translations WHERE word_id = w.id AND locale = 'en' LIMIT 1) AS meaning_en" +
                " FROM words w LEFT JOIN nouns n ON n.id = w.id" +
                " WHERE w.reviewed_by_admin = FALSE"
        );
        if (cefrLevel != null && !cefrLevel.isBlank()) sql.append(" AND w.cefr_level = '").append(cefrLevel.replace("'", "")).append("'");
        if (dtype    != null && !dtype.isBlank())     sql.append(" AND w.dtype = '").append(dtype.replace("'", "")).append("'");
        sql.append(" ORDER BY CASE COALESCE(w.cefr_level,'ZZ') WHEN 'A1' THEN 1 WHEN 'A2' THEN 2 WHEN 'B1' THEN 3" +
                   " WHEN 'B2' THEN 4 WHEN 'C1' THEN 5 WHEN 'C2' THEN 6 ELSE 99 END," +
                   " CASE WHEN w.dtype = 'Noun' THEN 0 ELSE 1 END, w.id ASC LIMIT ").append(cap);

        var items = jdbcTemplate.queryForList(sql.toString());
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
        String notes = body.containsKey("notes") ? (String) body.get("notes") : null;
        String newDtype  = body.containsKey("dtype")  ? (String) body.get("dtype")  : null;
        String newGender = body.containsKey("gender") ? (String) body.get("gender") : null;

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

        auditLogService.log("admin.vocabulary.reviewed", null,
                actorEmail(authentication), actorRole(authentication),
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
    public record UpdatePlanRequest(
            @NotBlank(message = "planCode is required") String planCode,
            Long monthlyTokenLimitOverride,
            String startsAtUtc,
            String endsAtUtc
    ) {}

    public record BulkAssignStudentsRequest(
            List<Long> studentIds
    ) {}

    private String actorEmail(Authentication authentication) {
        return authentication == null ? null : authentication.getName();
    }

    private String actorRole(Authentication authentication) {
        if (authentication == null || authentication.getAuthorities() == null || authentication.getAuthorities().isEmpty()) {
            return null;
        }
        return authentication.getAuthorities().iterator().next().getAuthority();
    }
}


