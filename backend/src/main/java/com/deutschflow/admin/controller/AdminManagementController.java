package com.deutschflow.admin.controller;

import com.deutschflow.admin.service.AdminManagementService;
import com.deutschflow.common.audit.AuditLogService;
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
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
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
    private final OfficialCefrVocabularyImportService officialCefrVocabularyImportService;
    private final GoetheOfficialWordlistImportService goetheOfficialWordlistImportService;
    private final WiktionaryIpaBatchService wiktionaryIpaBatchService;
    private final WiktionaryEnrichmentBatchService wiktionaryEnrichmentBatchService;
    private final VocabularyCleanupService vocabularyCleanupService;
    private final VocabularyResetService vocabularyResetService;
    private final VocabularyAutoTaggingService vocabularyAutoTaggingService;
    private final TagQueryService tagQueryService;
    private final AuditLogService auditLogService;

    @GetMapping("/vocabulary/taxonomy-summary")
    public Map<String, Object> vocabularyTopicTaxonomySummary() {
        return tagQueryService.topicTaxonomyCoverageSummary();
    }

    @GetMapping("/reports/overview")
    public Map<String, Object> overview() {
        return adminManagementService.overview();
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

    public record UpdateRoleRequest(@NotBlank(message = "role is required") String role) {}
    public record UpdatePlanRequest(
            @NotBlank(message = "planCode is required") String planCode,
            Long monthlyTokenLimitOverride,
            String startsAtUtc,
            String endsAtUtc
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

