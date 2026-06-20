package com.deutschflow.contract;

import com.deutschflow.testsupport.AbstractPostgresIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Contract guard for the native iOS OpenAPI group ({@code /v3/api-docs/ios}) consumed by
 * {@code swift-openapi-generator}. Locks in P0 of the native handoff: full student/auth path
 * coverage, the bearer-JWT security scheme, declared servers, and typed DTO schemas for the
 * Phase 0–1 slice (so codegen emits structs, not free-form dictionaries).
 *
 * @see com.deutschflow.common.config.OpenApiConfig
 */
@SpringBootTest
@AutoConfigureMockMvc
class IosOpenApiContractTest extends AbstractPostgresIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void shouldExposeIosGroupCoveringStudentAndAuthSurface() throws Exception {
        mockMvc.perform(get("/v3/api-docs/ios"))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith("application/json"))
                // Phase 0–1 slice
                .andExpect(jsonPath("$.paths['/api/auth/login']").exists())
                .andExpect(jsonPath("$.paths['/api/auth/me']").exists())
                .andExpect(jsonPath("$.paths['/api/onboarding/route']").exists())
                .andExpect(jsonPath("$.paths['/api/today/me']").exists())
                .andExpect(jsonPath("$.paths['/api/profile/me/learning']").exists())
                .andExpect(jsonPath("$.paths['/api/vocabulary/words']").exists())
                // node tree (RoadmapTree is the chosen, typed source)
                .andExpect(jsonPath("$.paths['/api/roadmap/tree']").exists())
                .andExpect(jsonPath("$.paths['/api/roadmap/tree/node/{id}']").exists())
                // later batches must at least be reachable in the spec
                .andExpect(jsonPath("$.paths['/api/mock-exams/recommend']").exists())
                .andExpect(jsonPath("$.paths['/api/srs/schedule']").exists())
                .andExpect(jsonPath("$.paths['/api/payments/apple/verify']").exists());
    }

    @Test
    void shouldDeclareBearerJwtSecuritySchemeAndServers() throws Exception {
        mockMvc.perform(get("/v3/api-docs/ios"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.components.securitySchemes.bearerAuth.type").value("http"))
                .andExpect(jsonPath("$.components.securitySchemes.bearerAuth.scheme").value("bearer"))
                .andExpect(jsonPath("$.components.securitySchemes.bearerAuth.bearerFormat").value("JWT"))
                // global requirement so every generated operation attaches Authorization
                .andExpect(jsonPath("$.security[0].bearerAuth").exists())
                .andExpect(jsonPath("$.servers[0].url").exists());
    }

    @Test
    void shouldEmitTypedDtoSchemasForPhaseOneSlice() throws Exception {
        // Named component schemas prove the slice is typed (not collapsed to free-form objects),
        // so Swift codegen produces real structs.
        mockMvc.perform(get("/v3/api-docs/ios"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.components.schemas.AuthResponse").exists())
                .andExpect(jsonPath("$.components.schemas.TodayPlanDto").exists())
                .andExpect(jsonPath("$.components.schemas.LearningProfileResponse").exists())
                .andExpect(jsonPath("$.components.schemas.WordDto").exists())
                .andExpect(jsonPath("$.components.schemas.TreeDto").exists())
                .andExpect(jsonPath("$.components.schemas.TreeNodeLessonDto").exists());
    }

    @Test
    void shouldTypeP1Round1LightBatch() throws Exception {
        // P1 Round 1 (Progress + Srs): Map→DTO so these endpoints emit typed schemas, not
        // free-form objects. springdoc only emits a component schema when an operation references
        // it, so existence here proves the endpoint is typed.
        mockMvc.perform(get("/v3/api-docs/ios"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.components.schemas.ProgressOverviewDto").exists())
                .andExpect(jsonPath("$.components.schemas.SrsDueCountDto").exists())
                .andExpect(jsonPath("$.components.schemas.SrsStatsDto").exists());
    }

    @Test
    void shouldTypeMockExamRound2aEndpoints() throws Exception {
        // P1 Round 2a (MockExam, no-timestamp endpoints): list / questions / finish / review / coverage.
        mockMvc.perform(get("/v3/api-docs/ios"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.components.schemas.ExamSummaryDto").exists())
                .andExpect(jsonPath("$.components.schemas.ExamQuestionsDto").exists())
                .andExpect(jsonPath("$.components.schemas.ExamFinishAcceptedDto").exists())
                .andExpect(jsonPath("$.components.schemas.ExamReviewDto").exists())
                .andExpect(jsonPath("$.components.schemas.ExamCoverageDto").exists())
                // snake_case keys preserved (not flipped to camelCase)
                .andExpect(jsonPath("$.components.schemas.ExamSummaryDto.properties.cefr_level").exists())
                .andExpect(jsonPath("$.components.schemas.ExamQuestionsDto.properties.sections_json").exists());
    }

    @Test
    void shouldTypeMockExamRound2bEndpoints() throws Exception {
        // P1 Round 2b (MockExam, timestamp endpoints): start / attempts-me / result / recommend.
        mockMvc.perform(get("/v3/api-docs/ios"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.components.schemas.ExamStartDto").exists())
                .andExpect(jsonPath("$.components.schemas.ExamAttemptDto").exists())
                .andExpect(jsonPath("$.components.schemas.ExamResultDto").exists())
                .andExpect(jsonPath("$.components.schemas.ExamRecommendationDto").exists())
                .andExpect(jsonPath("$.components.schemas.ExamStatDto").exists())
                // snake_case keys + date-time timestamps preserved
                .andExpect(jsonPath("$.components.schemas.ExamAttemptDto.properties.exam_title").exists())
                .andExpect(jsonPath("$.components.schemas.ExamStartDto.properties.started_at.format").value("date-time"));
    }

    @Test
    void shouldTypeGrammarSyllabusEndpoints() throws Exception {
        // P1 Round 3 (GrammarSyllabus): topics / exercises / submit / generate / my-drafts / pending.
        mockMvc.perform(get("/v3/api-docs/ios"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.components.schemas.GrammarTopicDto").exists())
                .andExpect(jsonPath("$.components.schemas.GrammarExerciseDto").exists())
                .andExpect(jsonPath("$.components.schemas.GrammarSubmitResultDto").exists())
                .andExpect(jsonPath("$.components.schemas.GrammarGeneratedExerciseDto").exists())
                .andExpect(jsonPath("$.components.schemas.GrammarDraftDto").exists())
                .andExpect(jsonPath("$.components.schemas.GrammarPendingReviewDto").exists())
                // real→number(float) + snake_case + camelCase submit preserved
                .andExpect(jsonPath("$.components.schemas.GrammarTopicDto.properties.mastery_percent.type").value("number"))
                .andExpect(jsonPath("$.components.schemas.GrammarSubmitResultDto.properties.correctAnswer").exists());
    }

    @Test
    void shouldTypeCertificateEndpoints() throws Exception {
        // P1 Round 4 (Certificate): me (list) / claim (union) / pdf (binary).
        mockMvc.perform(get("/v3/api-docs/ios"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.components.schemas.CertificateDto").exists())
                .andExpect(jsonPath("$.components.schemas.CertificateClaimDto").exists())
                .andExpect(jsonPath("$.components.schemas.CertificateDto.properties.cefr_level").exists())
                // /claim union carries both success (alreadyHas) and error keys
                .andExpect(jsonPath("$.components.schemas.CertificateClaimDto.properties.alreadyHas").exists())
                .andExpect(jsonPath("$.components.schemas.CertificateClaimDto.properties.error").exists())
                // PDF download declared as binary (not base64 byte)
                .andExpect(jsonPath("$.paths['/api/certificates/{id}/pdf'].get.responses.200.content['application/pdf'].schema.format")
                        .value("binary"));
    }
}
