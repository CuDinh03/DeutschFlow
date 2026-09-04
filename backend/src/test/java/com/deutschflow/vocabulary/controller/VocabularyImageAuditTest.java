package com.deutschflow.vocabulary.controller;

import com.deutschflow.aiimage.service.UnsplashImageService;
import com.deutschflow.common.audit.AuditActor;
import com.deutschflow.common.audit.AuditLogService;
import com.deutschflow.media.entity.MediaAsset;
import com.deutschflow.user.entity.User;
import com.deutschflow.vocabulary.dto.UnsplashAttachRequest;
import com.deutschflow.vocabulary.dto.VocabularyImageReviewDecisionRequest;
import com.deutschflow.vocabulary.dto.WordImageUpdateRequest;
import com.deutschflow.vocabulary.service.VocabularyImageBatchService;
import com.deutschflow.vocabulary.service.VocabularyImageGeneratorService;
import com.deutschflow.vocabulary.service.VocabularyImageReviewService;
import com.deutschflow.vocabulary.service.VocabularyImageService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.beans.factory.ObjectProvider;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Audit R-M4 (03/09/2026): duyệt/đặt tay ảnh từ vựng là bước đưa nội dung ra người học thật, nhưng
 * cả hai controller review + admin trước đây không có field AuditLogService — không để lại vết nào.
 * B4b đã vá đúng loại quyết định này cho grammar/moderation nhưng bỏ sót nhánh ảnh từ vựng.
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("Vocabulary image review/override/unsplash — vết audit (R-M4)")
class VocabularyImageAuditTest {

    @Mock private AuditLogService auditLogService;

    private static User admin() {
        return User.builder().id(7L).email("admin@x.com").displayName("Admin")
                .passwordHash("h").role(User.Role.ADMIN).build();
    }

    @SuppressWarnings("unchecked")
    private static ArgumentCaptor<Map<String, Object>> metaCaptor() {
        return ArgumentCaptor.forClass(Map.class);
    }

    @Test
    @DisplayName("review approve: ghi admin.vocabulary.image.reviewed kèm actor thật + decision")
    void reviewApprove_writesAudit() {
        VocabularyImageReviewService reviewService = mock(VocabularyImageReviewService.class);
        when(reviewService.applyDecision(eq(42L), any())).thenReturn(new MediaAsset());
        var controller = new VocabularyImageReviewController(reviewService, auditLogService);

        controller.approve(42L,
                new VocabularyImageReviewDecisionRequest("unsplash-1", "APPROVE", "DEFAULT", "http://img"),
                admin());

        var actor = ArgumentCaptor.forClass(AuditActor.class);
        var meta = metaCaptor();
        verify(auditLogService).log(eq("admin.vocabulary.image.reviewed"), actor.capture(),
                eq("VOCABULARY"), eq("42"), meta.capture());
        assertThat(actor.getValue().id()).isEqualTo(7L);
        assertThat(meta.getValue()).containsEntry("decision", "APPROVE");
    }

    @Test
    @DisplayName("override: ghi admin.vocabulary.image.overridden kèm actor thật")
    void override_writesAudit() {
        VocabularyImageService imageService = mock(VocabularyImageService.class);
        var controller = new VocabularyImageAdminController(
                imageService, mock(VocabularyImageBatchService.class),
                mock(VocabularyImageGeneratorService.class),
                mock(ObjectProvider.class), auditLogService);

        controller.overrideImage(9L, new WordImageUpdateRequest("http://img", "FLAT"), admin());

        verify(imageService).overrideImage(9L, new WordImageUpdateRequest("http://img", "FLAT"));
        var meta = metaCaptor();
        verify(auditLogService).log(eq("admin.vocabulary.image.overridden"), any(AuditActor.class),
                eq("VOCABULARY"), eq("9"), meta.capture());
        assertThat(meta.getValue()).containsEntry("imageStyle", "FLAT");
    }

    @Test
    @DisplayName("unsplash attach: ghi admin.vocabulary.image.unsplash_attached với url đã lưu")
    void unsplashAttach_writesAudit() {
        VocabularyImageGeneratorService generator = mock(VocabularyImageGeneratorService.class);
        MediaAsset asset = mock(MediaAsset.class);
        when(asset.getUrl()).thenReturn("s3://vocab/9.png");
        when(generator.generateFromUrl(eq(9L), anyString(), anyString(), anyString(), anyString()))
                .thenReturn(asset);
        var controller = new VocabularyImageAdminController(
                mock(VocabularyImageService.class), mock(VocabularyImageBatchService.class),
                generator, mock(ObjectProvider.class), auditLogService);

        controller.attachUnsplash(9L,
                new UnsplashAttachRequest("Hund", "https://images.unsplash.com/photo-1"), admin());

        var meta = metaCaptor();
        verify(auditLogService).log(eq("admin.vocabulary.image.unsplash_attached"), any(AuditActor.class),
                eq("VOCABULARY"), eq("9"), meta.capture());
        assertThat(meta.getValue()).containsEntry("imageUrl", "s3://vocab/9.png");
    }
}
