package com.deutschflow.admin.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import org.springframework.jdbc.core.JdbcTemplate;
import com.deutschflow.user.repository.UserRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.deutschflow.common.telemetry.ApiTelemetryService;
import com.deutschflow.vocabulary.service.WordQueryService;
import com.deutschflow.user.service.PersonalizationRulesetService;
import com.deutschflow.common.quota.QuotaService;
import com.deutschflow.vocabulary.service.TranslationUsageMeter;
import com.deutschflow.vocabulary.service.EnrichmentSuspendGate;
import com.deutschflow.common.config.VocabularyEnrichmentProperties;

import static org.junit.jupiter.api.Assertions.assertNotNull;

@ExtendWith(MockitoExtension.class)
class AdminManagementServiceUnitTest {
    @Mock org.springframework.jdbc.core.JdbcTemplate jdbcTemplate;
    @Mock DemoDataFilter demoDataFilter;
    @Mock com.deutschflow.user.repository.UserRepository userRepository;
    @Mock com.fasterxml.jackson.databind.ObjectMapper objectMapper;
    @Mock com.deutschflow.common.telemetry.ApiTelemetryService apiTelemetryService;
    @Mock com.deutschflow.vocabulary.service.WordQueryService wordQueryService;
    @Mock com.deutschflow.user.service.PersonalizationRulesetService personalizationRulesetService;
    @Mock com.deutschflow.common.quota.QuotaService quotaService;
    @Mock com.deutschflow.vocabulary.service.TranslationUsageMeter translationUsageMeter;
    @Mock com.deutschflow.vocabulary.service.EnrichmentSuspendGate enrichmentSuspendGate;
    @Mock com.deutschflow.common.config.VocabularyEnrichmentProperties vocabularyEnrichmentProperties;

    @InjectMocks
    AdminManagementService service;

    @org.junit.jupiter.api.BeforeEach
    void armDemoFilter() {
        // Pre-arm the demo-exclusion clause so COGS tests added to this class later don't NPE on
        // "...%s...".formatted(null). lenient() because the construction smoke test doesn't call it.
        org.mockito.Mockito.lenient().when(demoDataFilter.andExcludeDemo()).thenReturn("");
    }

    @Test
    void serviceConstructedWithMocks() {
        assertNotNull(service);
    }
}
