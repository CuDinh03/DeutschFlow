package com.deutschflow.vocabulary.galerie.service;

import com.deutschflow.media.entity.MediaAsset;
import com.deutschflow.media.service.MediaAssetService;
import com.deutschflow.media.service.S3StorageService;
import com.deutschflow.common.quota.AiUsageLedgerService;
import com.deutschflow.speaking.exception.AiServiceException;
import com.deutschflow.user.entity.User;
import com.deutschflow.vocabulary.galerie.GaleriePromptFactory;
import com.deutschflow.vocabulary.galerie.GalerieSvgSanitizer;
import com.deutschflow.vocabulary.galerie.dto.GalerieSvgBatchResponse;
import com.deutschflow.vocabulary.service.VocabularyImageService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Unit test luồng sinh SVG: mock Anthropic client + hạ tầng, sanitizer THẬT (để luồng
 * validate chạy đúng như prod). SQL thật được cover ở GalerieSvgSchemaIntegrationTest.
 */
@ExtendWith(MockitoExtension.class)
class GalerieSvgGenerationServiceTest {

    @Mock private JdbcTemplate jdbcTemplate;
    @Mock private GalerieAnthropicClient anthropicClient;
    @Mock private S3StorageService s3StorageService;
    @Mock private MediaAssetService mediaAssetService;
    @Mock private VocabularyImageService vocabularyImageService;
    @Mock private AiUsageLedgerService aiUsageLedgerService;

    private GalerieSvgGenerationService service;

    private static final String VALID_SVG = """
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
            <rect width="1024" height="1024" fill="#F6F3EC"/>
            <path fill="#DA291C" d="M100 100 C200 50 300 150 200 200 Z"/>
            </svg>""";

    private static final Map<String, Object> APFEL_ROW = Map.of(
            "id", 42L,
            "base_form", "Apfel",
            "gender", "der",
            "image_family", "OBJEKT",
            "image_concept", "One expressive brick-red apple.",
            "meaning", "quả táo");

    private final User admin = new User();

    @BeforeEach
    void setUp() {
        admin.setId(1L);
        service = new GalerieSvgGenerationService(jdbcTemplate, new GaleriePromptFactory(),
                new GalerieSvgSanitizer(), anthropicClient, s3StorageService,
                mediaAssetService, vocabularyImageService, aiUsageLedgerService, 30);
        lenient().when(anthropicClient.isConfigured()).thenReturn(true);
        lenient().when(anthropicClient.model()).thenReturn("claude-fable-5");
    }

    private void stubHappyInfra() {
        when(jdbcTemplate.queryForList(anyString(), any(Object[].class)))
                .thenReturn(List.of(APFEL_ROW));
        when(jdbcTemplate.queryForObject(anyString(), eq(Integer.class), any(Object[].class)))
                .thenReturn(5);
        // claim CONCEPT_READY→GENERATING thành công
        when(jdbcTemplate.update(anyString(), any(Object[].class))).thenReturn(1);
    }

    @Test
    @DisplayName("happy path: SVG hợp lệ → S3 + media_asset + image_url + QA_PENDING + ledger")
    void generate_persistsSanitizedSvg() {
        stubHappyInfra();
        when(anthropicClient.complete(anyString(), anyString(), anyString()))
                .thenReturn(new GalerieAnthropicClient.SvgCompletion(
                        VALID_SVG, "claude-fable-5", 1200, 800, false, "msg_1"));
        when(s3StorageService.uploadBytes(any(), anyString(), eq("image/svg+xml")))
                .thenReturn(new S3StorageService.S3UploadResult(
                        "galerie/galerie-v1/42.svg", "https://cdn/galerie/galerie-v1/42.svg"));
        MediaAsset asset = MediaAsset.builder().url("https://cdn/galerie/galerie-v1/42.svg").build();
        when(mediaAssetService.registerGeneratedAsset(anyString(), anyString(), anyString(),
                anyString(), anyLong(), anyString(), anyString(), anyString(), anyString(),
                anyString(), any())).thenReturn(asset);

        GalerieSvgBatchResponse response = service.generateForReady(10, "A1", admin);

        assertThat(response.succeeded()).isEqualTo(1);
        assertThat(response.failed()).isZero();
        // key theo format handoff: galerie/galerie-v1/{wordId}.svg
        verify(s3StorageService).uploadBytes(any(), eq("galerie/galerie-v1/42.svg"), eq("image/svg+xml"));
        verify(vocabularyImageService).applyGeneratedImage(eq(42L), eq(asset),
                eq(GaleriePromptFactory.VERSION), eq("One expressive brick-red apple."));
        // chuyển QA_PENDING sau khi ghi artwork
        verify(jdbcTemplate).update(contains("SET image_status = ? WHERE id = ?"),
                eq("QA_PENDING"), eq(42L));
        verify(aiUsageLedgerService).record(eq(1L), eq("anthropic"), eq("claude-fable-5"),
                eq(1200), eq(800), eq(2000), eq("galerie.svg"), eq("msg_1"), any());
    }

    @Test
    @DisplayName("model trả SVG bẩn (màu ngoài palette) → failure, KHÔNG upload S3, claim được trả về")
    void generate_dirtySvgReleasesClaim() {
        stubHappyInfra();
        when(anthropicClient.complete(anyString(), anyString(), anyString()))
                .thenReturn(new GalerieAnthropicClient.SvgCompletion(
                        VALID_SVG.replace("#DA291C", "#FF0000"),
                        "claude-fable-5", 1200, 800, false, "msg_2"));

        GalerieSvgBatchResponse response = service.generateForReady(10, null, admin);

        assertThat(response.succeeded()).isZero();
        assertThat(response.failed()).isEqualTo(1);
        assertThat(response.failures()).hasSize(1);
        assertThat(response.failures().get(0).error()).contains("palette");
        verify(s3StorageService, never()).uploadBytes(any(), anyString(), anyString());
        // release: GENERATING → CONCEPT_READY
        verify(jdbcTemplate).update(contains("AND image_status = ?"),
                eq("CONCEPT_READY"), eq(42L), eq("GENERATING"));
    }

    @Test
    @DisplayName("stop_reason=refusal (cả chuỗi fallback) → failure có chữ refusal, không lưu gì")
    void generate_refusalIsFailure() {
        stubHappyInfra();
        when(anthropicClient.complete(anyString(), anyString(), anyString()))
                .thenReturn(new GalerieAnthropicClient.SvgCompletion(
                        "", "claude-fable-5", 1200, 0, true, "msg_3"));

        GalerieSvgBatchResponse response = service.generateForReady(10, null, admin);

        assertThat(response.failed()).isEqualTo(1);
        assertThat(response.failures().get(0).error()).containsIgnoringCase("refusal");
        verify(s3StorageService, never()).uploadBytes(any(), anyString(), anyString());
    }

    @Test
    @DisplayName("chưa cấu hình (thiếu flag/key) → AiServiceException, không đụng DB")
    void generate_notConfiguredThrows() {
        when(anthropicClient.isConfigured()).thenReturn(false);

        assertThatThrownBy(() -> service.generateForReady(10, null, admin))
                .isInstanceOf(AiServiceException.class);
        verify(jdbcTemplate, never()).queryForList(anyString(), any(Object[].class));
    }

    @Test
    @DisplayName("từ bị lượt khác claim trước (claim trả 0 row) → bỏ qua, không gọi API")
    void generate_skipsWhenClaimLost() {
        when(jdbcTemplate.queryForList(anyString(), any(Object[].class)))
                .thenReturn(List.of(APFEL_ROW));
        when(jdbcTemplate.queryForObject(anyString(), eq(Integer.class), any(Object[].class)))
                .thenReturn(5);
        when(jdbcTemplate.update(anyString(), any(Object[].class))).thenReturn(0); // claim thua

        GalerieSvgBatchResponse response = service.generateForReady(10, null, admin);

        assertThat(response.succeeded()).isZero();
        verify(anthropicClient, never()).complete(anyString(), anyString(), anyString());
    }

    // ── decide ─────────────────────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("APPROVE chỉ đổi từ QA_PENDING; 0 row → false (controller map 409)")
    void decide_approve() {
        when(jdbcTemplate.update(anyString(), any(Object[].class))).thenReturn(1);
        assertThat(service.decide(42L, GalerieSvgGenerationService.Decision.APPROVE)).isTrue();
        verify(jdbcTemplate).update(contains("image_status = ?"),
                eq("APPROVED"), eq(42L), eq("QA_PENDING"));

        when(jdbcTemplate.update(anyString(), any(Object[].class))).thenReturn(0);
        assertThat(service.decide(42L, GalerieSvgGenerationService.Decision.APPROVE)).isFalse();
    }

    @Test
    @DisplayName("REGENERATE gỡ image_url/style/prompt và trả về CONCEPT_READY")
    void decide_regenerate() {
        when(jdbcTemplate.update(anyString(), any(Object[].class))).thenReturn(1);
        assertThat(service.decide(42L, GalerieSvgGenerationService.Decision.REGENERATE)).isTrue();
        verify(jdbcTemplate).update(contains("image_url = NULL"),
                eq("CONCEPT_READY"), eq(42L), eq("QA_PENDING"), eq("APPROVED"), eq("REJECTED"));
    }

    @Test
    @DisplayName("REJECT gỡ image_url, status REJECTED")
    void decide_reject() {
        when(jdbcTemplate.update(anyString(), any(Object[].class))).thenReturn(1);
        assertThat(service.decide(42L, GalerieSvgGenerationService.Decision.REJECT)).isTrue();
        verify(jdbcTemplate).update(contains("image_url = NULL"),
                eq("REJECTED"), eq(42L), eq("QA_PENDING"), eq("APPROVED"));
    }
}
