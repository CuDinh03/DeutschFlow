package com.deutschflow.admin.controller;

import com.deutschflow.unittest.support.MockMvcWithValidation;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.web.servlet.MockMvc;

import static org.junit.jupiter.api.Assertions.assertNotNull;

import com.deutschflow.admin.service.AdminManagementService;
import com.deutschflow.common.audit.AuditLogService;
import com.deutschflow.notification.service.UserNotificationService;
import com.deutschflow.vocabulary.service.DeepLLemmaBackfillService;
import com.deutschflow.vocabulary.service.GlosbeViEnrichmentService;
import com.deutschflow.vocabulary.service.GlosbeVocabularyImportService;
import com.deutschflow.vocabulary.service.GoetheOfficialWordlistImportService;
import com.deutschflow.vocabulary.service.GoetheVocabularyAutoImportService;
import com.deutschflow.vocabulary.service.OfficialCefrVocabularyImportService;
import com.deutschflow.vocabulary.service.TagQueryService;
import com.deutschflow.vocabulary.service.VocabularyAutoTaggingService;
import com.deutschflow.vocabulary.service.VocabularyCleanupService;
import com.deutschflow.vocabulary.service.VocabularyResetService;
import com.deutschflow.vocabulary.service.WiktionaryEnrichmentBatchService;
import com.deutschflow.vocabulary.service.WiktionaryIpaBatchService;

@ExtendWith(MockitoExtension.class)
class AdminManagementControllerUnitTest {

    private MockMvc mvc;
    @Mock
    com.deutschflow.admin.service.AdminManagementService adminManagementService;
    @Mock
    com.deutschflow.vocabulary.service.GoetheVocabularyAutoImportService goetheVocabularyAutoImportService;
    @Mock
    com.deutschflow.vocabulary.service.GlosbeVocabularyImportService glosbeVocabularyImportService;
    @Mock
    com.deutschflow.vocabulary.service.GlosbeViEnrichmentService glosbeViEnrichmentService;
    @Mock
    com.deutschflow.vocabulary.service.DeepLLemmaBackfillService deepLLemmaBackfillService;
    @Mock
    com.deutschflow.vocabulary.service.OfficialCefrVocabularyImportService officialCefrVocabularyImportService;
    @Mock
    com.deutschflow.vocabulary.service.GoetheOfficialWordlistImportService goetheOfficialWordlistImportService;
    @Mock
    com.deutschflow.vocabulary.service.WiktionaryIpaBatchService wiktionaryIpaBatchService;
    @Mock
    com.deutschflow.vocabulary.service.WiktionaryEnrichmentBatchService wiktionaryEnrichmentBatchService;
    @Mock
    com.deutschflow.vocabulary.service.VocabularyCleanupService vocabularyCleanupService;
    @Mock
    com.deutschflow.vocabulary.service.VocabularyResetService vocabularyResetService;
    @Mock
    com.deutschflow.vocabulary.service.VocabularyAutoTaggingService vocabularyAutoTaggingService;
    @Mock
    com.deutschflow.vocabulary.service.TagQueryService tagQueryService;
    @Mock
    com.deutschflow.common.audit.AuditLogService auditLogService;
    @Mock
    com.deutschflow.notification.service.UserNotificationService userNotificationService;

    @InjectMocks
    AdminManagementController controller;

    @BeforeEach
    void setup() {
        mvc = MockMvcWithValidation.standaloneWithAdvice(controller);
    }

    @Test
    void controllerConstructedAndMockMvcInitialized() {
        assertNotNull(controller);
        assertNotNull(mvc);
    }
}
