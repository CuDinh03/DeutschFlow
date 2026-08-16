package com.deutschflow.vocabulary.galerie;

import com.deutschflow.media.service.S3StorageService;
import com.deutschflow.testsupport.AbstractPostgresIntegrationTest;
import com.deutschflow.vocabulary.galerie.controller.GalerieAdminController;
import com.deutschflow.vocabulary.galerie.dto.GalerieSvgBatchResponse;
import com.deutschflow.vocabulary.galerie.service.GalerieAnthropicClient;
import com.deutschflow.vocabulary.galerie.service.GalerieSvgGenerationService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.test.context.support.WithMockUser;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * SQL luồng sinh SVG + decision chạy trên PostgreSQL THẬT (bài học ERR-1..3: unit mock
 * JdbcTemplate che lỗi SQL). Anthropic + S3 được mock — IT chứng minh SQL/persist/chuyển
 * trạng thái, không chứng minh chất lượng artwork.
 */
@SpringBootTest
class GalerieSvgSchemaIntegrationTest extends AbstractPostgresIntegrationTest {

    private static final String LEMMA = "__galerie_svg_it__";

    private static final String VALID_SVG = """
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
            <rect width="1024" height="1024" fill="#F6F3EC"/>
            <path fill="#DA291C" d="M100 100 C200 50 300 150 200 200 Z"/>
            </svg>""";

    @Autowired JdbcTemplate jdbcTemplate;
    @Autowired GalerieSvgGenerationService svgService;
    @Autowired GalerieAdminController controller;

    @MockBean GalerieAnthropicClient anthropicClient;
    @MockBean S3StorageService s3StorageService;

    private long wordId;

    @BeforeEach
    void seed() {
        cleanup();
        wordId = jdbcTemplate.queryForObject("""
                INSERT INTO words (dtype, base_form, cefr_level, image_family, image_concept,
                                   image_status, created_at, updated_at)
                VALUES ('Word', ?, 'A1', 'OBJEKT', 'One expressive test apple.',
                        'CONCEPT_READY', NOW(), NOW()) RETURNING id
                """, Long.class, LEMMA);
        jdbcTemplate.update("INSERT INTO word_translations (word_id, locale, meaning) VALUES (?, 'vi', ?)",
                wordId, "quả táo kiểm thử");

        when(anthropicClient.isConfigured()).thenReturn(true);
        when(anthropicClient.complete(anyString(), anyString(), anyString()))
                .thenReturn(new GalerieAnthropicClient.SvgCompletion(
                        VALID_SVG, "claude-fable-5", 1200, 800, false, "msg_it"));
        when(s3StorageService.uploadBytes(any(), anyString(), anyString()))
                .thenAnswer(inv -> new S3StorageService.S3UploadResult(
                        inv.getArgument(1), "https://cdn.test/" + inv.getArgument(1)));
    }

    @AfterEach
    void cleanup() {
        jdbcTemplate.update("DELETE FROM media_assets WHERE s3_key LIKE 'galerie/%' AND original_name LIKE '%.svg'"
                + " AND s3_key IN (SELECT 'galerie/galerie-v1/' || id || '.svg' FROM words WHERE base_form = ?)", LEMMA);
        jdbcTemplate.update("DELETE FROM words WHERE base_form = ?", LEMMA);
    }

    @Test
    @DisplayName("generateForReady: claim → SVG → media_asset + image_url + QA_PENDING trên schema thật")
    void generate_persistsArtworkOnRealSchema() {
        GalerieSvgBatchResponse response = svgService.generateForReady(5, "A1", null);

        assertThat(response.succeeded()).isEqualTo(1);
        assertThat(response.failed()).isZero();

        Map<String, Object> row = jdbcTemplate.queryForMap("""
                SELECT image_status, image_url, image_style, image_prompt FROM words WHERE id = ?
                """, wordId);
        assertThat(row.get("image_status")).isEqualTo("QA_PENDING");
        assertThat(String.valueOf(row.get("image_url"))).contains("galerie/galerie-v1/" + wordId + ".svg");
        assertThat(row.get("image_style")).isEqualTo(GaleriePromptFactory.VERSION);
        assertThat(row.get("image_prompt")).isEqualTo("One expressive test apple.");

        Integer assets = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM media_assets WHERE s3_key = ?", Integer.class,
                "galerie/" + GaleriePromptFactory.VERSION + "/" + wordId + ".svg");
        assertThat(assets).isEqualTo(1);

        // Từ đã QA_PENDING không được chọn lại ở lượt sau (guard regenerate — plan mục 15)
        GalerieSvgBatchResponse second = svgService.generateForReady(5, "A1", null);
        assertThat(second.requested()).isZero();
    }

    @Test
    @DisplayName("sanitizer chặn SVG bẩn → claim trả về CONCEPT_READY, không ghi media_asset")
    void generate_dirtySvgLeavesWordRetryable() {
        when(anthropicClient.complete(anyString(), anyString(), anyString()))
                .thenReturn(new GalerieAnthropicClient.SvgCompletion(
                        VALID_SVG.replace("</svg>", "<text x=\"1\" y=\"1\">Apfel</text></svg>"),
                        "claude-fable-5", 1200, 800, false, "msg_dirty"));

        GalerieSvgBatchResponse response = svgService.generateForReady(5, "A1", null);

        assertThat(response.failed()).isEqualTo(1);
        String status = jdbcTemplate.queryForObject(
                "SELECT image_status FROM words WHERE id = ?", String.class, wordId);
        assertThat(status).isEqualTo("CONCEPT_READY");
        verify(s3StorageService, never()).uploadBytes(any(), anyString(), anyString());
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    @DisplayName("decision endpoint: APPROVE từ QA_PENDING → APPROVED; APPROVE lần 2 → 409; REGENERATE → CONCEPT_READY sạch artwork")
    void decisionEndpoint_transitionsOnRealSchema() {
        svgService.generateForReady(5, "A1", null);

        var approved = controller.decide(wordId,
                new GalerieAdminController.GalerieDecisionRequest("approve"));
        assertThat(approved.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(jdbcTemplate.queryForObject(
                "SELECT image_status FROM words WHERE id = ?", String.class, wordId))
                .isEqualTo("APPROVED");

        var conflict = controller.decide(wordId,
                new GalerieAdminController.GalerieDecisionRequest("APPROVE"));
        assertThat(conflict.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);

        var regenerated = controller.decide(wordId,
                new GalerieAdminController.GalerieDecisionRequest("REGENERATE"));
        assertThat(regenerated.getStatusCode()).isEqualTo(HttpStatus.OK);
        Map<String, Object> row = jdbcTemplate.queryForMap(
                "SELECT image_status, image_url, image_style FROM words WHERE id = ?", wordId);
        assertThat(row.get("image_status")).isEqualTo("CONCEPT_READY");
        assertThat(row.get("image_url")).isNull();
        assertThat(row.get("image_style")).isNull();
    }
}
